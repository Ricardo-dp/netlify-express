const axios = require('axios')
const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')

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

app.post('/webhooks/hellodoctor', withBearerTokenAuthentication, async (req, res) => {
	res.sendStatus(201)
})

const port = process.env.PORT || 3000

app.listen(port, () => {
	console.log(`Server running on ${port}/`)
})

async function createHelloDoctorUser(userID, email) {
	const auth = firebase.auth()

	const createHelloDoctorUserResponse = await publicApi.post(`/users`, {email}).catch(error => console.warn(`error creating user ${userID}`, error))

	if (createHelloDoctorUserResponse?.status !== 200) {
		console.warn("[createHelloDoctorUserResponse]", createHelloDoctorUserResponse?.data)
		throw 'bad_request'
	}

	const {uid: helloDoctorUID} = createHelloDoctorUserResponse.data

	await auth.setCustomUserClaims(userID, {helloDoctorUID})

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
