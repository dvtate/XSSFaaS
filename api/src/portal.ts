
// External imports
import {  unlink } from 'fs/promises';
import { fstat, } from "fs";

import fileUpload, { UploadedFile } from 'express-fileupload';
import crypto from 'crypto';
import validator from 'validator';

// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:portal');

// Internal imports
import * as db from './db';
import { generateToken, getPasswordHash, requireAuthMiddleware } from './auth';

// Express Router
import { Router } from 'express';
const router = Router();

// User signup
router.post('/user/signup', async (req, res) => {
    // Extract relevant fields
    const { name, password, email } = req.body;
    if (!name)
        return res.status(400).send('missing name');
    if (!email)
        return res.status(400).send('missing email');
    if (!password)
        return res.status(400).send('missing password');
    if (!validator.isEmail(email))
        return res.status(400).send('invalid email');

    // Verify email not duplicate
    const dupEmail = await db.queryProm('SELECT 1 FROM Users WHERE email = ?;', [email], true);
    if (dupEmail instanceof Error) {
        debug(dupEmail);
        return res.status(500).send('database error');
    }
    if (dupEmail.length)
        return res.status(400).send('email already in use');

    // Put user into the database
    let userId: number;
    for (;;) {
        // Make pw hash
        userId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        const pwHash = getPasswordHash(userId, password);

        // Try to create user
        const result = await db.queryProm(
            'INSERT INTO Users (userId, name, email, passwordHash, creationTs) VALUES (?, ?, ?, ?, ?);',
            [userId, name, email, pwHash, Date.now()],
            false,
        );

        if (result instanceof Error) {
            // Duplicate userId
            if (result.message.match(/Duplicate entry '.+' for key 'PRIMARY'/))
                continue;

            debug(result);
            return res.status(500).send(result);
        }

        break;
    }

    // Log the user in
    const token = await generateToken(userId, req.body.stayLoggedIn);
    res.cookie('authToken', token, { maxAge: 12 * 60 * 60 * 1000 });
    res.send('Welcome');

    debug('New user: ', email, name);
});

// User login
router.post('/user/login', async (req, res) => {
    const { email, password, stayLoggedIn } = req.body;

    const user = await db.queryProm('SELECT userId, passwordHash FROM Users WHERE email = ?;', [email], true);
    if (user instanceof Error) {
        debug(user);
        return res.status(500).send(user);
    }
    if (!user[0])
        return res.status(401).send('wrong email');
    if (getPasswordHash(user[0].userId, password) !== user[0].passwordHash)
        return res.status(401).send('wrong password');

    res.send(await generateToken(user[0].userId, stayLoggedIn));
    debug('User logged in', email);
});

// List a user's functions
router.get('/functions/', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;

    const fns = await db.queryProm(
        'SELECT functionId, name, about, creationTs, preventReuse, optSpec, allowForeignWorkers'
        + ' FROM Functions WHERE userId = ?;',
        [userId],
        true,
    );
    if (fns instanceof Error)
        return res.status(500).send(fns);

    res.json(fns);
});

// Describe a function
router.get('/function/:fnId', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;
    const { fnId } = req.params;

    const fnq = await db.queryProm(
        'SELECT functionId, name, about, creationTs, preventReuse, optSpec, allowForeignWorkers, invokeToken'
        + ' FROM Functions WHERE functionId = ? AND userId = ?;',
        [fnId, userId],
        true,
    );
    if (fnq instanceof Error)
        return res.status(500).send(fnq);
    if (fnq.length === 0)
        return res.status(404).send('not found');
    const fn = fnq[0];

    const logCount = await db.queryProm(`
        SELECT COUNT(*) AS numLogs
        FROM TaskLogs INNER JOIN Tasks ON TaskLogs.taskId = Tasks.taskId
        WHERE functionId = ?;`, [fnId], true);
    if (logCount instanceof Error)
        debug(logCount);
    else
        fn.logCount = logCount[0].numLogs;

    const assets = await db.queryProm(
        'SELECT assetId, sizeBytes, fileName, creationTs, modifiedTs '
        + 'FROM FunctionAssets WHERE functionId = ?;',
        [fnId],
        true,
    );
    if (assets instanceof Error)
        debug(assets);
    fn.assets = assets instanceof Error ? [] : assets;

    res.json(fn);
});

// List workers
router.get('/workers', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;
    const workers = await db.queryProm(
        'SELECT workerId, connectTs, lastSeenTs, threads, userAgent, ip FROM Workers WHERE userId=?',
        [userId],
        true,
    );
    if (workers instanceof Error) {
        debug(workers);
        return res.status(500).send('db error');
    }
    res.json(workers);
});

// Create function
router.post('/function', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;
    const { name, about, preventReuse, optSpec, allowForeignWorkers } = req.body;
    const ts = Date.now();
    const token = crypto.randomBytes(24).toString("base64");
    const qr = await db.queryProm(
        `INSERT INTO Functions (functionid, userId, name, about, creationTs, preventReuse, optSpec, allowForeignWorkers, invokeToken)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?);
        SELECT functionId FROM Functions WHERE creationTs = ?;`,
        [userId, name, about, ts, preventReuse, optSpec, allowForeignWorkers, token, ts],
        false,
    );
    if (qr instanceof Error) {
        debug(qr);
        return res.status(500).send('db error');
    }
    const { functionId } = qr[1][0];
    debug('New function ', functionId);
    res.send(functionId);
});

// Alter function
// TODO method should be PATCH
router.post('/function/:functionId/alter', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;
    const { functionId } = req.params;
    const fields = ['name', 'about', 'preventReuse', 'optSpec', 'allowForeignWorkers'];
    const { field, value } = req.body;
    if (!fields.includes(field))
        return res.status(400).send('invalid field');

    const q = await db.queryProm(
        `UPDATE Functions SET ${field} = ? WHERE functionId = ? AND userId = ?;`,
        [value, functionId, userId],
        false,
    );

    if (q instanceof Error) {
        debug(q);
        return res.status(500).send('db error');
    }

    res.status(200).send('ok');
});

/**
 * Delete a FunctionaAsset
 * @param assetId id for asset to delete
 * @param userId optional userid to prevent user abuse
 * @returns true on success, false on not found, error on error
 */
async function deleteFunctionAsset(assetId:string, userId?: number): Promise<boolean | Error> {
    // Get local path to asset
    const userCheck = userId 
        ? ' AND functionId IN (SELECT functionId FROM Functions WHERE userId = ?)'
        : '';
    let q = await db.queryProm(
        'SELECT location FROM FunctionAssets WHERE assetId = ?' + userCheck,
        userId ? [assetId, userId] : [assetId],
        true,
    );
    if (q instanceof Error)
        return q;
    if (!q.length)
        return false;
    const { location } = q[0];

    // Remove asset from DB
    q = await db.queryProm(
        'DELETE FROM FunctionAssets WHERE assetId = ?' + userCheck,
        userId ? [assetId, userId] : [assetId],
        false,
    );
    if (q instanceof Error)
        return q;

    // Delete asset
    try {
        await unlink(location);
    } catch (e) {
        debug('failed to unlink file ', location);
        return e;
    }
}

// Delete asset
router.delete('/asset/:assetId', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;
    const { assetId } = req.params;

    // Delete asset
    const ret = await deleteFunctionAsset(assetId, userId);

    // Handle failures
    if (!ret)
        return res.status(404).send('asset not found');
    if (ret instanceof Error) {
        debug('failed to delete asset', ret);
        return res.status(500).send('server error');
    }

    // Success
    res.status(200).send('ok');
    debug('Deleted asset ', assetId, location);
});

/**
 * Remove a function and all of it's associated data
 * @param functionId id of function to be deleted
 */
async function deleteFunction(functionId: string) {
    // Delete function assets
    const assets = await db.queryProm('SELECT assetId FROM FunctionAssets WHERE functionId=?', [functionId], true);
    if (assets instanceof Error)
        throw assets;
    else
        await Promise.all(assets.map(a => deleteFunctionAsset(a.assetId)));

    // Queries required to delete the function (order matters)
    const queries: Array<[string, string[]]> = [
        ['DELETE FROM TaskLogs WHERE taskId IN (SELECT taskId FROM Tasks WHERE functionId = ?)', [functionId]],
        ['DELETE FROM Tasks WHERE functionId = ?', [functionId]],
        ['DELETE FROM Functions WHERE functionId = ?', [functionId]],
    ];

    // Execute the queries in order
    for (const q of queries) {
        const r = await db.queryProm(...q, false);
        if (r instanceof Error)
            throw r;
    }
    debug('Deleted function', functionId);
}

// Delete function
router.delete('/function/:functionId', requireAuthMiddleware, async (req, res) => {
    const { userId } = req.session;
    const { functionId } = req.params;

    // Check if they own this function
    const ownedFn = await db.queryProm(
        'SELECT creationTs FROM Functions WHERE functionId = ? AND userId = ?',
        [functionId, userId],
        true,
    );
    if (ownedFn instanceof Error) {
        debug(ownedFn);
        return res.status(500).send('db error');
    }
    if (ownedFn.length == 0) {
        debug('unauthorized to delete function');
        return res.status(404).send("You don't own a function with this ID");
    }

    deleteFunction(functionId)
        .then(() => res.status(200).send('ok'))
        .catch(e => {
            debug(e);
            res.status(500).send('db error');
        });
});

// Upload function asset
const fileUploadMiddleware = fileUpload({
    safeFileNames: true,
    preserveExtension: true,
    // useTempDir: true,
    // tempFileDir: process.env.UPLOAD_DIR,
    abortOnLimit: true, // send 413 when file is too big
    limits: { fileSize: 20 * 1024 * 1024 },
    createParentPath: true,
});
router.post('/function/:functionId/asset/upload', requireAuthMiddleware, fileUploadMiddleware, async (req, res) => {
    const { functionId } = req.params;
    if (!req.files || Object.keys(req.files).length === 0)
        return res.status(400).send('missing files');

    const files = Object.keys(req.files)
        .filter(k => k.startsWith('file_'))
        .map(k => req.files[k]) as UploadedFile[];

    const mvProm = (f: fileUpload.UploadedFile, path: string) =>
        new Promise<void>((resolve, reject) =>
            f.mv(path, e => e
                ? reject(e)
                : resolve()
            ));

    // Move files to uploads dir and make db entries
    const proms = [];
    files.forEach(f => {
        const path = `${process.env.UPLOADS_DIR}/${functionId}/${f.name}`;
        proms.push(mvProm(f, path))
        const ts = Date.now();
        proms.push(db.queryProm(`INSERT INTO FunctionAssets
            (functionId, location, fileName, sizeBytes, creationTs, modifiedTs)
            VALUES (?, ?, ?, ?, ?, ?);`,
            [functionId, path, f.name, f.size, ts, ts],
            false,
        ));
    });
    Promise.all(proms)
        .then(() => res.send('ok'))
        .catch(err => {
            debug(err);
            res.status(500).send('failed to upload');
        });

    debug('Stored %d assets', files.length);
});

// Access FunctionAsset
router.get('/assets/:functionId/:fname', requireAuthMiddleware, async (req, res) => {
    const { functionId , fname } = req.params;
    res.sendFile(`${process.env.UPLOADS_DIR}/${functionId}/${fname}`, err => {
        if (!err)
            return;
        debug(err);
        // TODO fallback to use database storage location
    });
});

// Get logs for a function
// ?limit: get param to cap result
// TODO proper pagination
router.get('/function/:functionId/logs', requireAuthMiddleware, async (req, res) => {
    // Get params
    const { functionId } = req.params;
    const { limit } = req.query;
    const { userId } = req.session;

    // Verify user authorized to fxn
    const userOwnsFn = await db.queryProm(
        `SELECT COUNT(*) FROM Functions WHERE functionId = ? AND userId = ?`,
        [functionId, userId],
        true);
    if (userOwnsFn instanceof Error || !userOwnsFn.length)
        return res.status(404).send("you don't have a function with that id");

    // Parse limit param
    let n: string;
    try {
        n = String(limit ? Number(limit) : 1000);
    } catch (e) {
        return res.status(400).send('invalid limit parameter');
    }

    // Get logs from db
    const logs = await db.queryProm(
        `SELECT logType, message, ts, L.taskId FROM TaskLogs L INNER JOIN Tasks T ON L.taskId=T.taskId WHERE functionId = ? ORDER BY ts DESC LIMIT ${n}`,
        [functionId],
        true,
    );
    if (logs instanceof Error)
        return res.status(500).send('db error');
    res.json(logs);
});

// TODO
// User logout
// Update user
// User delete
// User stats
// Enable/Disable worker (to allow safe shutdown)
// delete user

export default router;
