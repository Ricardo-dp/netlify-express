const firebaseAdmin = require("firebase-admin")
const config = require("./config")

const googleServiceAccount = require("./google-service-account.json")

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(googleServiceAccount),
    storageBucket: config.firebase.storageBucket,
    databaseURL: config.firebase.databaseURL
})

exports.firebase = firebaseAdmin
