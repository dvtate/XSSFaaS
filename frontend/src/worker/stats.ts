
// Statistics to track
// - Something like load average
// - Utilization rate (time spent working on tasks / total time)
// - Average time spent in queue
// - Average time processing jobs
// - Total Number of tasks completed
// - Uptime

import type { Task } from "./thread";
import type WorkerApp from "./worker";

const statsView = document.getElementById('stats-view');

let uptimeStart = Date.now();

/**
 * Uptime string
 * @param ms duration in milliseconds
 * @returns english string representation
 */
function msToString(ms: number): string {
    const ms_mins = ms / 1000 / 60
        , days = Math.floor(ms_mins / 60 / 24)
        , hrs = Math.floor(ms_mins / 60) % 24
        , mins = Math.floor(ms_mins) % 60
        , secs = Math.floor(((ms / 1000) % 60))
        , msecs = ('' + (ms % 1000) / 1000).slice(1)
        , sigfig2 = (n: number) => ('0' + n).substring(-2);
    return `${hrs}:${sigfig2(mins)}:${sigfig2(secs)}${msecs
        }${days > 0 ? ` and ${days.toLocaleString()} days` : ''}`;
};

function updateStats(app: WorkerApp) {
    let ret = `Active Threads: ${app.activeThreads()}/${app.nproc
        }<br/>Uptime: ${msToString(Date.now() - uptimeStart)}<br/>`;

    const allTasks: Task[] = [...app.taskQueue, ...app.activeTasks(), ...app.completedTasks()];
    if (allTasks.length == 0) {
        statsView.innerHTML = ret;
        return;
    }

    const avg = (ns: number[]) => ns.reduce((p, n) => p + n, 0) / ns.length;
    const avgQueueTime = avg(allTasks.map(t => t.timeSpentInQueue()));
    const avgRunTime = avg(allTasks.map(t => t.runtime()).filter(ms => ms !== undefined));
    statsView.innerHTML = `${ret
        }Average Queue Time: ${msToString(avgQueueTime)
        }<br/>Average Runtime ${msToString(avgRunTime)}<br/>`;
}

export default function init(app: WorkerApp) {
    return setInterval(() => updateStats(app), 250);
}