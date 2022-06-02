const firebaseAdmin = require("firebase-admin")
const config = require("./config")

const googleServiceAccount = require("./google-service-account.json")

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(googleServiceAccount),
})

exports.firebase = firebaseAdmin
