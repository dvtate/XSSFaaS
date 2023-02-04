// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:work');

import * as db from './db';

import { Router } from 'express';
const router = Router();

import { text } from 'body-parser';
import { requireAuthMiddleware } from './auth';
// TODO require auth
router.post(
    '/task/:functionId',
    text({type: '*/*'}),
    // requireAuthMiddleware,
    async (req, res) => {
        // Get params
        const { functionId } = req.params;
        // const { userId } = req.session;
        const invokeToken = decodeURIComponent(String(req.query.key));
        const additionalData = req.body;

        // Verify they have right invokeToken
        const fn = await db.queryProm(
            'SELECT userId FROM Functions WHERE functionId=? AND invokeToken=?',
            [functionId, invokeToken],
            true,
        );
        if (fn instanceof Error) {
            console.error(fn);
            return res.status(500).send('db error');
        }
        if (fn.length === 0)
            return res.status(404).send('no function with given key');

        // Add task to database
        const resp = await db.queryProm(
            'INSERT INTO Tasks (functionId, additionalData, arriveTs) VALUES (?, ?, ?)',
            [functionId, additionalData, Date.now()],
            false,
        );
        if (resp instanceof Error) {
            debug('database error');
            console.error(resp);
        }


        // Notify the router that there's new work?
        res.send('received');

        debug('new task');
    },
);

export default router;
