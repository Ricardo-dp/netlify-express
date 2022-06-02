const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const {withBearerTokenAuthentication} = require("./auth")
const {firebase} = require("./firebase")

const app = express()
app.use(express.static('public'))
app.use(cors())

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get("/users/me/hellodoctor", withBearerTokenAuthentication, async (req, res) => {
	const userID = req.headers['x-user-uid']

	const auth = firebase.auth()

	try {
		const user = await auth.getUser(userID)
		res.send(user)
	} catch(error) {
		res.sendStatus(404);
	}
})

app.post("/users/me/hellodoctor", withBearerTokenAuthentication, async (req, res) => {
	res.sendStatus(201)
})

app.post("/webhooks/hellodoctor", withBearerTokenAuthentication, async (req, res) => {
	res.sendStatus(201)
})

const port = process.env.PORT || 3000

app.listen(port, () => {
	console.log(`Server running on ${port}/`)
})
