const firebase = require("firebase-admin");
const googleServiceAccount = require("../google-service-account.json")

firebase.initializeApp({
    credential: firebase.credential.cert(googleServiceAccount),
})

export {firebase};
