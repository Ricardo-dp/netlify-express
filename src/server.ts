import {Request, Response} from "express-serve-static-core";

const apn = require('apn');
const axios = require('axios');
const bodyParser = require('body-parser')
const cors = require('cors');
const express = require('express');
const {v4: uuid} = require('uuid');

const {config} = require('../config');

import {withBearerTokenAuthentication} from './auth';
import {firebase} from './clients';
import {DocumentSnapshot, MulticastMessage, QuerySnapshot} from "./types";

const firestore = firebase.firestore();
const messaging = firebase.messaging();

const app = express()
app.use(express.static('public'))
app.use(cors())

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const helloDoctorApiClient = axios.create({
	baseURL: config.publicApiHost,
	headers: {
		'Content-Type': 'application/json',
		'X-Api-Key': config.demoApiKey,
		'X-Api-Secret': config.demoApiSecret
	}
});

app.get('/users/me/hellodoctor', withBearerTokenAuthentication, async (req: Request, res: Response) => {
	const userID = req.header('x-user-uid')

	const auth = firebase.auth()

	const user = await auth.getUser(userID).catch((error: Error) => console.warn(`error getting user ${userID}`, error))

	if (!user) {
		res.sendStatus(500)
		return
	}

	if (!user.customClaims?.helloDoctorUID) {
		res.sendStatus(404)
		return
	}

	const {helloDoctorUID} = user.customClaims

	getHelloDoctorUserRefreshToken(helloDoctorUID)
		.then(refreshToken => {
			res.send({uid: helloDoctorUID, refreshToken})
		})
		.catch(error => {
			console.warn("[getUserRefreshTokenResponse]", error)
			res.sendStatus(500)
		})
})

app.post('/users/me/hellodoctor', withBearerTokenAuthentication, async (req: Request, res: Response) => {
	const userID = req.header('x-user-uid')

	const auth = firebase.auth()

	const user = await auth.getUser(userID).catch((error: Error) => console.warn(`error getting user ${userID}`, error))

	if (!user) {
		res.sendStatus(404)
		return
	}

	if (user.customClaims?.helloDoctorUID) {
		res.status(500)
		res.send("already_registered")
		return
	}

	createHelloDoctorUser(user.uid, user.email)
		.then(async helloDoctorUID => {
			const refreshToken = await getHelloDoctorUserRefreshToken(helloDoctorUID)

			res.send({uid: helloDoctorUID, refreshToken})
		})
		.catch(error => {
			console.warn("[createHelloDoctorUserResponse]", error)
			res.sendStatus(500)
		});
})

app.post('/webhooks/hellodoctor', async (req: Request, res: Response) => {
	const {type: notificationType, data} = req.body;

	const {videoRoomSID, recipientUserID, callerDisplayName} = data;

	const userQuerySnapshot = await firestore.collection("users")
		.where("helloDoctorUserID", "==", recipientUserID)
		.get();

	if (userQuerySnapshot.empty) {
		console.warn(`no HD user found with ID ${recipientUserID}`);
		res.sendStatus(200);
		return;
	}

	const userSnapshot = userQuerySnapshot.docs[0];
	const userDevicesSnapshot = await userSnapshot.ref.collection("devices").get();

	const fcmPromise = deliverFCMNotifications(userDevicesSnapshot, notificationType, videoRoomSID, callerDisplayName);
	const pushKitPromise = deliverPushKitNotifications(userDevicesSnapshot, notificationType, videoRoomSID, callerDisplayName);

	await Promise.all([fcmPromise, pushKitPromise]).catch((error) => console.warn('error delivering notifications', error));

	res.sendStatus(200);
});

const port = process.env.PORT || 3023

app.listen(port, () => {
	console.log(`Server running on ${port}/`)
});

async function deliverFCMNotifications(userDevicesSnapshot: QuerySnapshot, notificationType: string, videoRoomSID: string, callerDisplayName: string): Promise<void> {
	function fcmDeviceFilter(deviceSnapshot: DocumentSnapshot) {
		switch (notificationType) {
			case "incomingVideoCall":
				return deviceSnapshot.get("fcmToken") && !deviceSnapshot.get("apnsToken");
			default:
				return deviceSnapshot.get("fcmToken")
		}
	}

	const fcmTokens = userDevicesSnapshot.docs
		.filter(fcmDeviceFilter)
		.map((snapshot: DocumentSnapshot) => snapshot.get("fcmToken"));

	if (fcmTokens.length === 0) {
		return;
	}

	const message: MulticastMessage = {
		tokens: fcmTokens,
		data: {
			type: notificationType,
			videoRoomSID: videoRoomSID || "",
			callerDisplayName: callerDisplayName || ""
		},
		android: {
			priority: "high"
		}
	}

	await messaging.sendMulticast(message);
}

const apnOptions = {
	cert: './keys/aps.cer.pem',
	key: './keys/aps.key.pem',
	production: false
};

const apnProvider = new apn.Provider(apnOptions);

async function deliverPushKitNotifications(userDevicesSnapshot: QuerySnapshot, notificationType: string, videoRoomSID: string, callerDisplayName: string): Promise<void> {
	if (notificationType !== "incomingVideoCall") {
		return;
	}

	const apnsTokens = userDevicesSnapshot.docs
		.filter(snapshot => snapshot.get("apnsToken"))
		.map(snapshot => snapshot.get("apnsToken"));

	const promises = apnsTokens.map(apnsToken => {
		const pushKitNotification = new apn.Notification();
		pushKitNotification.expiry = Math.round((new Date().getTime()) / 1000 + 10);
		pushKitNotification.topic = 'com.hellodoctormx.RNHelloDoctorExampleApp.voip';
		pushKitNotification.pushType = 'voip';
		pushKitNotification.payload = {
			type: notificationType,
			callUUID: uuid(),
			videoRoomSID,
			callerDisplayName
		}

		return apnProvider.send(pushKitNotification, apnsToken)
	});

	await Promise.all(promises);
}

async function createHelloDoctorUser(userID: string, email: string) {
	const auth = firebase.auth()

	const createHelloDoctorUserResponse = await helloDoctorApiClient
		.post(`/users`, {email, thirdPartyUserID: userID})
		.catch((error: Error) => console.warn(`error creating user ${userID}`, error))

	if (createHelloDoctorUserResponse?.status !== 200) {
		console.warn("[createHelloDoctorUserResponse]", createHelloDoctorUserResponse?.data)
		throw 'bad_request'
	}

	const {uid: helloDoctorUID} = createHelloDoctorUserResponse.data

	await auth.setCustomUserClaims(userID, {helloDoctorUID})

	await firestore.doc(`users/${userID}`).update({helloDoctorUserID: helloDoctorUID});

	return helloDoctorUID
}

async function getHelloDoctorUserRefreshToken(helloDoctorUID: string) {
	const getUserRefreshTokenResponse = await helloDoctorApiClient.get(`/users/${helloDoctorUID}/refresh-token`)

	if (getUserRefreshTokenResponse.status !== 200) {
		console.warn("[getUserRefreshTokenResponse]", getUserRefreshTokenResponse.data)
		throw 'bad_request'
	}

	return getUserRefreshTokenResponse.data.token
}
