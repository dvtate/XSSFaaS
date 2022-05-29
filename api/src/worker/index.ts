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
    const { userId } = req.session;

    const selectQuery = 'SELECT MAX(workerId) as workerId FROM Workers;';
    const query = process.env.NO_TELEMETRY
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

    res.json(query[1][0].workerId);

});

// Write log for task
router.post('/log/:taskId', requireAuthMiddleware, async (req, res) => {
    const { taskId } = req.params;
    const { message, type, workerId } = req.body;
    const { userId } = req.session;

    // TODO verify worker has permission to log for this task
    //      and that task is not already completed

    // Write log to server
    await db.queryProm(
        'INSERT INTO TaskLogs (taskId, logType, message, ts) VALUES (?, ?, ?, ?, ?);',
        [taskId, type, message, Date.now()],
        false,
    );
});

// Get files relevant to given function id from db

export default router;