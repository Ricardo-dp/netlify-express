"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebase = void 0;
var firebase = require("firebase-admin");
exports.firebase = firebase;
var googleServiceAccount = require("../google-service-account.json");
firebase.initializeApp({
    credential: firebase.credential.cert(googleServiceAccount),
});
//# sourceMappingURL=clients.js.map