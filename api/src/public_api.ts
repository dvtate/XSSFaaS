

// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:public');

// Internal imports
import * as db from './db';

// Create Router
import { Router } from 'express';
const router = Router();

router.get('/stats', async (req, res) => {
    try {
        const [completedTasksCount, stats] = await Promise.all([
            db.queryProm('SELECT COUNT(*) FROM Tasks WHERE endTs IS NOT NULL AND FAILED=0', [], true),
            fetch(`http://127.0.0.1:${process.env.INTERNAL_PORT}`).then(r => r.json()),
        ]);
        if (completedTasksCount instanceof Error)
            throw completedTasksCount;
        
        res.json({
            completedTasks: completedTasksCount,
            workers: stats.workers,
            threads: stats.threads,
            loadavg: stats.loadAverage,
        });
    } catch (e) {
        debug(e);
    }
});

// Export router
export default router;