// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:worker');

import * as db from '../db';

import { Router } from 'express';
const router = Router();

import { requireAuthMiddleware } from '../auth';

// Sends data about the worker so that we can add it to database
// Gives back a workerId
// WorkerId used to communicate with router and authentication
router.post('/enlist', requireAuthMiddleware, async (req, res) => {
    const { ncores } = req.body;
    const userId = String(req.session);

    const selectQuery = 'SELECT MAX(workerId) FROM WORKERS;';
    const workerId = process.env.NO_TELEMETRY
        ? await db.queryProm(
            'INSERT INTO Workers (userId, threads) VALUES (?, ?);' + selectQuery,
            [userId, ncores],
            false,
        )
        : await db.queryProm(
            'INSERT INTO Workers (userId, threads, userAgent, ip) VALUES (?, ?, ?, ?);' + selectQuery,
            [userId, ncores, req.headers['user-agent'], req.ip],
            false,
        );

    console.log(workerId);

});

// Write log for task
router.post('/log/:workerId/:fnId', async (req, res) => {
    const { fnId, workerId } = req.params;
    const { message, type } = req.body;

    // Write log to server
    await db.queryProm(
        'INSERT INTO FunctionLogs (functionId, workerId, logType, message, ts) VALUES (?, ?, ?, ?, ?);',
        [fnId, workerId, type, message, Date.now()],
        false,
    );
});

// Get files relevant to given function id from db

export default router;