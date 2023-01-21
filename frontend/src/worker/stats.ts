
// Statistics to track
// - Something like load average
// - Utilization rate (time spent working on tasks / total time)
// - Average time spent in queue
// - Average time processing jobs
// - Total Number of tasks completed
// - Uptime

import moment from "moment";

import type { Task } from "./thread";
import type WorkerApp from "./worker";

// Also we have to put this on the page and make it look cool and shit


const statsView = document.getElementById('stats-view');

let uptimeStart = moment();

function updateStats(app: WorkerApp) {
    // Average time in spent in queue for items in queue
    const avg = (ns: number[]) => ns.reduce((p, n) => p + n, 0) / ns.length;
    const allTasks: Task[] = [...app.taskQueue, ...app.activeTasks(), ...app.completedTasks()];
    const avgQueueTime = avg(allTasks.map(t => t.timeSpentInQueue()));
    const avgRunTime = avg(allTasks.map(t => t.runtime()).filter(ms => ms !== undefined));

    statsView.innerHTML = `
        Active Threads: ${app.activeThreads()}/${app.nproc}<br/>
        Uptime: ${uptimeStart.fromNow(true)}<br/>
        Average Queue Time: ${moment.duration(avgQueueTime)}<br/>
        Average Runtime ${moment.duration(avgQueueTime)}
    `;
}

export default function init(app: WorkerApp) {
    return setInterval(() => updateStats(app), 250);
}