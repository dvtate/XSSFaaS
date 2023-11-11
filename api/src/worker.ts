// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:worker');

import * as db from './db';

import { Router } from 'express';
const router = Router();

import { requireAuthMiddleware, authUserSafe } from './auth';

// Sends data about the worker so that we can add it to database
// Gives back a workerId
// WorkerId used to communicate with router and authentication
router.post('/enlist', requireAuthMiddleware, async (req, res) => {
    const { ncores, acceptForeignWork } = req.body;
    const { userId } = req.session;

    const selectQuery = 'SELECT MAX(workerId) as workerId FROM Workers;';
    const query = process.env.NO_TELEMETRY
        ? await db.queryProm(
            'INSERT INTO Workers (userId, threads, acceptForeignWork) VALUES (?, ?, ?);' + selectQuery,
            [userId, ncores, acceptForeignWork],
            false,
        )
        : await db.queryProm(
            'INSERT INTO Workers (userId, threads, userAgent, ip, acceptForeignWork) VALUES (?, ?, ?, ?, ?);' + selectQuery,
            [userId, ncores, req.headers['user-agent'], req.ip, acceptForeignWork],
            false,
        );

    if (query instanceof Error) {
        debug('database error');
        console.error(query);
        res.status(500).send('database error');
    }

    res.json(query[1][0].workerId);
    debug('New worker ', userId, query[1][0].workerId);
});

// Write log for task
router.post('/log/:taskId', requireAuthMiddleware, async (req, res) => {
    const { taskId } = req.params;
    const { message, type, workerId } = req.body;
    const { userId } = req.session;

    // Verify worker has permission to log for this task and that task is not already completed
    const t = await db.queryProm(
        'SELECT functionId FROM Tasks T INNER JOIN Workers W ON T.workerId = W.workerId'
        + ' WHERE T.workerId=? AND taskId=? AND userId=?'
        + (type === 'CRASH' ? '' : ' AND endTs IS NULL'),
        [workerId, taskId, userId],
        false,
    );
    if (t instanceof Error) {
        debug('database error:');
        console.error(t);
        return res.status(500).send('database error');
    }
    if (t.length === 0)
        return res.status(401).send('unauthorized');

    // Write log to server
    const l = await db.queryProm(
        'INSERT INTO TaskLogs (taskId, logType, message, ts) VALUES (?, ?, ?, ?);',
        [taskId, type, message, Date.now()],
        false,
    );
    if (l instanceof Error) {
        debug('database error');
        console.error(l);
        return res.status(500).send('database error');
    }
    res.send('ok');
});

// Get asset
router.get('/asset/:authToken/:functionId/:fname', async (req, res) => {
    const { functionId, fname, authToken } = req.params;

    // Authenticate
    const user = await authUserSafe(decodeURIComponent(authToken));
    if (user.error) {
        debug(user.error);
        return res.status(500).send('auth error');
    }
    if (!user.userId)
        return res.status(403).send('unauthorized');

    // Check for incomlete tasks
    // TODO redis would be a better fit for this
    const tasks = await db.queryProm('SELECT taskId FROM Tasks '
        + 'WHERE endTs IS NULL AND functionId = ? AND workerId IN '
        + '(SELECT workerId FROM Workers WHERE userId = ?)',
        [functionId, user.userId],
        true,
    );
    if (tasks instanceof Error) {
        debug(tasks);
        return res.status(500).send('db error');
    }
    if (tasks.length === 0)
        return res.status(403).send('unauthorized');

    // TODO use location stored in database in case multiple upload dirs
    // const location = await db.queryProm(
    //     'SELECT location FROM FunctionAssets WHERE functionId=? AND filename=?',
    //     [functionId, fname],
    //     true,
    // );
    // if (location instanceof Error) {
    //     debug(location);
    //     return res.status(500).send('db error');
    // }
    // if (location.length === 0)
    //     return res.sendStatus(404);
    // return res.sendFile(`${process.env.UPLOADS_DIR}/${functionId}/${fname}`);

    res.sendFile(`${process.env.UPLOADS_DIR}/${functionId}/${fname}`);
});

export default router;
