import { NextFunction, Request, Response } from "express";
import * as db from "./db";
import crypto from "crypto";
import Debugger from 'debug';

const debug = Debugger('core:auth');
const { PW_SALT } = process.env;

// subsystem generates random tokens used to authenticate app users

// creates a login token for user
// returns token


/**
 *
 * @param userId
 * @param duration
 * @returns
 */
export async function generateToken(userId: string, stayLoggedIn: boolean = false) {
    const duration = stayLoggedIn ? "interval 6 month" : "interval 12 hour";

    for (; ;) {
        // generate token
        // 48 random bytes produces a 64 char of b64 encoded token
        const token = crypto.randomBytes(48).toString("base64");
        // add token to db
        const error = await db.queryProm(`INSERT INTO AuthTokens (authToken, userId, authTokenExpiration)
                VALUES (?, ?, NOW() + ${duration})`,
            [token, userId]);

        if (!(error instanceof Error))
            return token;
        if (!error.message.match(/Duplicate entry/))
            throw error;
    }
}

/**
 * validates user authentication token
 * @param token auth token
 * @returns user's id
 */
export async function authUser(token: string) {
    if (token.startsWith("Bearer "))
        token = token.substr(7);

    const tok: any = await db.queryProm("SELECT userId, authTokenExpiration<NOW() exp FROM AuthTokens WHERE authToken=?",
        [token], true);
    if (tok instanceof Error)
        throw tok;

    if (tok.length == 0 || !tok[0]) {
        debug("Token not found in database: %s", token);
        throw Error("invalid token");
    }
    if (tok[0].exp) {
        debug("Token for user %d expired: %s", tok[0].userId, token);
        throw Error("token expired");
    }
    return tok[0].userId;
}

/**
 * Same as authUser but does not throw
 * @param token auth token
 * @returns object containing either userId or error fields
 */
export async function authUserSafe(token: string) {
    if (!token)
        return { error: "Missing Authorization header" };

    let userId
    try {
        userId = await authUser(token);
    } catch (error) {
        return { error: error.toString() };
    }
    return { userId };
}

export function getPasswordHash(userId: string, password: string) {
    return crypto
        .createHash('sha512')
        .update(`${userId}${PW_SALT}${password}`)
        .digest('hex')
}

// Extend express with our middleware
declare global {
    namespace Express {
        export interface Request {
            session?: any;
        }
    }
};

export async function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const user = await authUser(req.get("Authorization"));
    } catch (e) {
        debug('auth failed');
        debug(e);
        req.session = e;
    }
    return next();
}
