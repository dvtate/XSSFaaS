import { NextFunction, Request, Response } from "express";
import * as db from "./db";
import Debugger from 'debug';

const debug = Debugger('xss:rtr:auth');

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

// Extend express with our middleware
declare global {
    namespace Express {
        export interface Request {
            session?:
                { userId: number };
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
