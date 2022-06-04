import { NextFunction, Request, Response } from "express";
import * as db from "./db";
import crypto from "crypto";
import Debugger from 'debug';

const debug = Debugger('xss:rtr:auth');
const { PW_SALT } = process.env;

/**
 * Make an oauth token for the user
 * @param userId user to authenticate
 * @param stayLoggedIn should we increase the login duration to 6 months?
 * @returns valid auth token
 */
export async function generateToken(userId: number, stayLoggedIn: boolean = false) {
    const duration = stayLoggedIn ? "interval 6 month" : "interval 12 hour";

    for (;;) {
        // generate token
        // 48 random bytes produces a 64 char of b64 encoded token
        const token = crypto.randomBytes(48).toString("base64");
        // add token to db
        const error = await db.queryProm(`INSERT INTO AuthTokens (authToken, userId, authTokenExpiration)
                VALUES (?, ?, NOW() + ${duration})`,
            [token, String(userId)]);

        if (!(error instanceof Error))
            return token;
        if (!error.message.match(/Duplicate entry/))
            throw error;
    }
}

/**
 * Validates user authentication token
 * @param token auth token
 * @returns user's id
 */
export async function authUser(token: string) {
    if (token.startsWith("Bearer "))
        token = token.substring(7);

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
    return Number(tok[0].userId);
}

/**
 * Same as authUser but does not throw
 * @param token auth token
 * @returns object containing either userId or error field
 */
export async function authUserSafe(token: string) {
    if (!token)
        return { error: "Missing Authorization header" };

    try {
        return { userId: await authUser(token) };
    } catch (error) {
        return { error: error.toString() };
    }
}

/**
 * 1 way SHA-512 hash with a salt and the randomly generated userId
 * @param userId user's userId
 * @param password password to hash
 * @returns sha-512 hex string
 */
export function getPasswordHash(userId: number, password: string) {
    return crypto
        .createHash('sha512')
        .update(`${userId}${PW_SALT}${password}`)
        .digest('hex')
}

// Extend express with our middleware
declare global {
    namespace Express {
        export interface Request {
            session?: { userId: number };
        }
    }
};

export async function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const user = await authUserSafe(req.get("Authorization"));
    if (user.error)
        return res.status(401).send(user.error);
    req.session = user as any;
    return next();
}
