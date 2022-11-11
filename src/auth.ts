import {firebase} from './clients';

export async function withBearerTokenAuthentication(req, res, next) {
    const auth = firebase.auth()

    try {
        const apiBearerToken = getHeaderBearerToken(req)

        const validJWT = await auth.verifyIdToken(apiBearerToken)
        req.headers["x-user-uid"] = validJWT.uid

        return next()
    } catch(error) {
        console.warn(`[unauthorized:BAD_FIREBASE_JWT] ${req.method} ${req.path})`, error)
        res.sendStatus(401)
    }
}

const getHeaderBearerToken = (req) => {
    console.log(req)
    const bearerRegex = /Bearer (.*)/

    const authHeaderValue = req.header("authorization")

    if (bearerRegex.test(authHeaderValue)) {
        return bearerRegex.exec(authHeaderValue)[1]
    } else {
        throw "invalid_token"
    }
}
