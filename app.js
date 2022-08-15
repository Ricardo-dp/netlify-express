const axios = require('axios')
const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const {firestore} = require("firebase-admin");
const apn = require("apn");
const { v4: uuid } = require("uuid");

const config = require('./config')
const {withBearerTokenAuthentication} = require('./auth')
const {firebase} = require('./firebase')

const app = express()
app.use(express.static('public'))
app.use(cors())

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const publicApi = axios.create({
	baseURL: config.publicApiHost,
	headers: {
		'Content-Type': 'application/json',
		'X-Api-Key': config.demoApiKey,
		'X-Api-Secret': config.demoApiSecret
	}
})

app.get('/users/me/hellodoctor', withBearerTokenAuthentication, async (req, res) => {
	const userID = req.headers['x-user-uid']

	const auth = firebase.auth()

	const user = await auth.getUser(userID).catch(error => console.warn(`error getting user ${userID}`, error))

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

app.post('/users/me/hellodoctor', withBearerTokenAuthentication, async (req, res) => {
	const userID = req.headers['x-user-uid']

	const auth = firebase.auth()

	const user = await auth.getUser(userID).catch(error => console.warn(`error getting user ${userID}`, error))

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
		})
})

const apnOptions = {
	cert: './keys/aps.cer.pem',
	key: './keys/aps.key.pem',
	production: false
};

const apnProvider = new apn.Provider(apnOptions);

app.post('/webhooks/hellodoctor', async (req, res) => {
	const {type: notificationType, data} = req.body;

	const {videoRoomSID, recipientUserID, callerDisplayName} = data;

	const firestore = firebase.firestore();
	const messaging = firebase.messaging();

	const userQuerySnapshot = await firestore.collection("users")
		.where("helloDoctorUserID", "==", recipientUserID)
		.get();

	if (userQuerySnapshot.empty) {
		console.warn(`no HD user found with ID ${recipientUserID}`);
		return;
	}

	const userSnapshot = userQuerySnapshot.docs[0];
	const userDevicesSnapshot = await userSnapshot.ref.collection("devices").get();

	function fcmDeviceFilter(deviceSnapshot) {
		switch (notificationType) {
			case "incomingVideoCall":
				return deviceSnapshot.get("fcmToken") && !deviceSnapshot.get("apnsToken");
			default:
				return deviceSnapshot.get("fcmToken")
		}
	}

	function deliverFCMNotifications() {
		const fcmTokens = userDevicesSnapshot.docs
			.filter(fcmDeviceFilter)
			.map(snapshot => snapshot.get("fcmToken"));

		if (fcmTokens.length === 0) {
			return;
		}

		const message = {
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

		return messaging.sendMulticast(message);
	}

	function deliverPushKitNotifications() {
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

		return Promise.all(promises);
	}

	const fcmPromise = deliverFCMNotifications();
	const pushKitPromise = deliverPushKitNotifications();

	await Promise.all([fcmPromise, pushKitPromise]).catch((error) => console.warn('error delivering notifications', error));

	res.sendStatus(200);
});

const port = process.env.PORT || 3023

app.listen(port, () => {
	console.log(`Server running on ${port}/`)
})

async function createHelloDoctorUser(userID, email) {
	const auth = firebase.auth()

	const createHelloDoctorUserResponse = await publicApi
		.post(`/users`, {email, thirdPartyUserID: userID})
		.catch(error => console.warn(`error creating user ${userID}`, error))

	if (createHelloDoctorUserResponse?.status !== 200) {
		console.warn("[createHelloDoctorUserResponse]", createHelloDoctorUserResponse?.data)
		throw 'bad_request'
	}

	const {uid: helloDoctorUID} = createHelloDoctorUserResponse.data

	await auth.setCustomUserClaims(userID, {helloDoctorUID})

	await firestore().doc(`users/${userID}`).update({helloDoctorUserID: helloDoctorUID});

	return helloDoctorUID
}

async function getHelloDoctorUserRefreshToken(helloDoctorUID) {
	const getUserRefreshTokenResponse = await publicApi.get(`/users/${helloDoctorUID}/refresh-token`)

	if (getUserRefreshTokenResponse.status !== 200) {
		console.warn("[getUserRefreshTokenResponse]", getUserRefreshTokenResponse.data)
		throw 'bad_request'
	}

	return getUserRefreshTokenResponse.data.token
}
