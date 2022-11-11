"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var apn = require('apn');
var axios = require('axios');
var bodyParser = require('body-parser');
var cors = require('cors');
var express = require('express');
var uuid = require('uuid').v4;
var config = require('../config').config;
var auth_1 = require("./auth");
var clients_1 = require("./clients");
var firestore = clients_1.firebase.firestore();
var messaging = clients_1.firebase.messaging();
var app = express();
app.use(express.static('public'));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var helloDoctorApiClient = axios.create({
    baseURL: config.publicApiHost,
    headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.demoApiKey,
        'X-Api-Secret': config.demoApiSecret
    }
});
app.get('/users/me/hellodoctor', auth_1.withBearerTokenAuthentication, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userID, auth, user, helloDoctorUID;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                userID = req.header('x-user-uid');
                auth = clients_1.firebase.auth();
                return [4 /*yield*/, auth.getUser(userID).catch(function (error) { return console.warn("error getting user ".concat(userID), error); })];
            case 1:
                user = _b.sent();
                if (!user) {
                    res.sendStatus(500);
                    return [2 /*return*/];
                }
                if (!((_a = user.customClaims) === null || _a === void 0 ? void 0 : _a.helloDoctorUID)) {
                    res.sendStatus(404);
                    return [2 /*return*/];
                }
                helloDoctorUID = user.customClaims.helloDoctorUID;
                getHelloDoctorUserRefreshToken(helloDoctorUID)
                    .then(function (refreshToken) {
                    res.send({ uid: helloDoctorUID, refreshToken: refreshToken });
                })
                    .catch(function (error) {
                    console.warn("[getUserRefreshTokenResponse]", error);
                    res.sendStatus(500);
                });
                return [2 /*return*/];
        }
    });
}); });
app.post('/users/me/hellodoctor', auth_1.withBearerTokenAuthentication, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userID, auth, user;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                userID = req.header('x-user-uid');
                auth = clients_1.firebase.auth();
                return [4 /*yield*/, auth.getUser(userID).catch(function (error) { return console.warn("error getting user ".concat(userID), error); })];
            case 1:
                user = _b.sent();
                if (!user) {
                    res.sendStatus(404);
                    return [2 /*return*/];
                }
                if ((_a = user.customClaims) === null || _a === void 0 ? void 0 : _a.helloDoctorUID) {
                    res.status(500);
                    res.send("already_registered");
                    return [2 /*return*/];
                }
                createHelloDoctorUser(user.uid, user.email)
                    .then(function (helloDoctorUID) { return __awaiter(void 0, void 0, void 0, function () {
                    var refreshToken;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, getHelloDoctorUserRefreshToken(helloDoctorUID)];
                            case 1:
                                refreshToken = _a.sent();
                                res.send({ uid: helloDoctorUID, refreshToken: refreshToken });
                                return [2 /*return*/];
                        }
                    });
                }); })
                    .catch(function (error) {
                    console.warn("[createHelloDoctorUserResponse]", error);
                    res.sendStatus(500);
                });
                return [2 /*return*/];
        }
    });
}); });
app.post('/webhooks/hellodoctor', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, notificationType, data, videoRoomSID, recipientUserID, callerDisplayName, userQuerySnapshot, userSnapshot, userDevicesSnapshot, fcmPromise, pushKitPromise;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, notificationType = _a.type, data = _a.data;
                videoRoomSID = data.videoRoomSID, recipientUserID = data.recipientUserID, callerDisplayName = data.callerDisplayName;
                return [4 /*yield*/, firestore.collection("users")
                        .where("helloDoctorUserID", "==", recipientUserID)
                        .get()];
            case 1:
                userQuerySnapshot = _b.sent();
                if (userQuerySnapshot.empty) {
                    console.warn("no HD user found with ID ".concat(recipientUserID));
                    res.sendStatus(200);
                    return [2 /*return*/];
                }
                userSnapshot = userQuerySnapshot.docs[0];
                return [4 /*yield*/, userSnapshot.ref.collection("devices").get()];
            case 2:
                userDevicesSnapshot = _b.sent();
                fcmPromise = deliverFCMNotifications(userDevicesSnapshot, notificationType, videoRoomSID, callerDisplayName);
                pushKitPromise = deliverPushKitNotifications(userDevicesSnapshot, notificationType, videoRoomSID, callerDisplayName);
                return [4 /*yield*/, Promise.all([fcmPromise, pushKitPromise]).catch(function (error) { return console.warn('error delivering notifications', error); })];
            case 3:
                _b.sent();
                res.sendStatus(200);
                return [2 /*return*/];
        }
    });
}); });
var port = process.env.PORT || 3023;
app.listen(port, function () {
    console.log("Server running on ".concat(port, "/"));
});
function deliverFCMNotifications(userDevicesSnapshot, notificationType, videoRoomSID, callerDisplayName) {
    return __awaiter(this, void 0, void 0, function () {
        function fcmDeviceFilter(deviceSnapshot) {
            switch (notificationType) {
                case "incomingVideoCall":
                    return deviceSnapshot.get("fcmToken") && !deviceSnapshot.get("apnsToken");
                default:
                    return deviceSnapshot.get("fcmToken");
            }
        }
        var fcmTokens, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fcmTokens = userDevicesSnapshot.docs
                        .filter(fcmDeviceFilter)
                        .map(function (snapshot) { return snapshot.get("fcmToken"); });
                    if (fcmTokens.length === 0) {
                        return [2 /*return*/];
                    }
                    message = {
                        tokens: fcmTokens,
                        data: {
                            type: notificationType,
                            videoRoomSID: videoRoomSID || "",
                            callerDisplayName: callerDisplayName || ""
                        },
                        android: {
                            priority: "high"
                        }
                    };
                    return [4 /*yield*/, messaging.sendMulticast(message)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var apnOptions = {
    cert: './keys/aps.cer.pem',
    key: './keys/aps.key.pem',
    production: false
};
var apnProvider = new apn.Provider(apnOptions);
function deliverPushKitNotifications(userDevicesSnapshot, notificationType, videoRoomSID, callerDisplayName) {
    return __awaiter(this, void 0, void 0, function () {
        var apnsTokens, promises;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (notificationType !== "incomingVideoCall") {
                        return [2 /*return*/];
                    }
                    apnsTokens = userDevicesSnapshot.docs
                        .filter(function (snapshot) { return snapshot.get("apnsToken"); })
                        .map(function (snapshot) { return snapshot.get("apnsToken"); });
                    promises = apnsTokens.map(function (apnsToken) {
                        var pushKitNotification = new apn.Notification();
                        pushKitNotification.expiry = Math.round((new Date().getTime()) / 1000 + 10);
                        pushKitNotification.topic = 'com.hellodoctormx.RNHelloDoctorExampleApp.voip';
                        pushKitNotification.pushType = 'voip';
                        pushKitNotification.payload = {
                            type: notificationType,
                            callUUID: uuid(),
                            videoRoomSID: videoRoomSID,
                            callerDisplayName: callerDisplayName
                        };
                        return apnProvider.send(pushKitNotification, apnsToken);
                    });
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createHelloDoctorUser(userID, email) {
    return __awaiter(this, void 0, void 0, function () {
        var auth, createHelloDoctorUserResponse, helloDoctorUID;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    auth = clients_1.firebase.auth();
                    return [4 /*yield*/, helloDoctorApiClient
                            .post("/users", { email: email, thirdPartyUserID: userID })
                            .catch(function (error) { return console.warn("error creating user ".concat(userID), error); })];
                case 1:
                    createHelloDoctorUserResponse = _a.sent();
                    if ((createHelloDoctorUserResponse === null || createHelloDoctorUserResponse === void 0 ? void 0 : createHelloDoctorUserResponse.status) !== 200) {
                        console.warn("[createHelloDoctorUserResponse]", createHelloDoctorUserResponse === null || createHelloDoctorUserResponse === void 0 ? void 0 : createHelloDoctorUserResponse.data);
                        throw 'bad_request';
                    }
                    helloDoctorUID = createHelloDoctorUserResponse.data.uid;
                    return [4 /*yield*/, auth.setCustomUserClaims(userID, { helloDoctorUID: helloDoctorUID })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, firestore.doc("users/".concat(userID)).update({ helloDoctorUserID: helloDoctorUID })];
                case 3:
                    _a.sent();
                    return [2 /*return*/, helloDoctorUID];
            }
        });
    });
}
function getHelloDoctorUserRefreshToken(helloDoctorUID) {
    return __awaiter(this, void 0, void 0, function () {
        var getUserRefreshTokenResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, helloDoctorApiClient.get("/users/".concat(helloDoctorUID, "/refresh-token"))];
                case 1:
                    getUserRefreshTokenResponse = _a.sent();
                    if (getUserRefreshTokenResponse.status !== 200) {
                        console.warn("[getUserRefreshTokenResponse]", getUserRefreshTokenResponse.data);
                        throw 'bad_request';
                    }
                    return [2 /*return*/, getUserRefreshTokenResponse.data.token];
            }
        });
    });
}
//# sourceMappingURL=server.js.map