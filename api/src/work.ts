// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:worker');

import * as db from './db';

import { Router } from 'express';
const router = Router();

import { requireAuthMiddleware } from './auth';

// TODO require auth
router.post(
    '/task/:functionId',
    // requireAuthMiddleware,
    async (req, res) => {
        // Get params
        const { functionId } = req.params;
        // const { userId } = req.session;
        const additionalData = JSON.stringify(req.body);

        /// Verify user is authorized to make this request
        // const fn = await db.queryProm('SELECT userId FROM Functions WHERE functionId=?', [functionId], true);
        // if (fn instanceof Error)
        //     return res.status(500).send('db error');
        // if (fn[0].userId !== userId)
        //     return res.status(401).send('unauthorized');

        // Add task to database
        await db.queryProm(
            'INSERT INTO Tasks (functionId, additionalData, arriveTs) VALUES (?, ?, ?)',
            [functionId, additionalData, String(Date.now())],
            false,
        );

        // Notify the router that there's new work?
        res.send('received');
    },
);

export default router;