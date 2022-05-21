// This script gets run by webworker threads

import { API_SERVER_URL } from '../globals';

import { Task, IPCMessage } from './thread';

let taskQueue: Task[] = [];

onmessage = function (m: MessageEvent<IPCMessage>) {
    switch(m.data.type) {
        case IPCMessage.Type.H2C_CANCEL_TASK:
            taskQueue = taskQueue.filter(t => t.id !== m.data.args);
            break;

        case IPCMessage.Type.H2C_NEW_TASK:
            taskQueue.push(m.data.args);
            break;

        case IPCMessage.Type.H2C_EMPTY_QUEUE:
            taskQueue = [];
            break;

        default:
            console.error('invalid message type', m.data.type);
    }
}


const jobFnCache: { [id: string] : any } = {};

async function getFn(id: string) {
    return jobFnCache[id]
        || (jobFnCache[id] = await import(
            /* webpackIgnore: true */
            `${API_SERVER_URL}/${id}/index.js`
        ));
}


class HostUtils {
    constructor(public task: Task) {}
    log(m: string) {
        console.log(m);
    }
}


async function doTask(t: Task) {
    const f = await getFn(t.fnId);
    await f(t.additionalData, new HostUtils(t));
}

async function main() {
    // Sleep function
    const delay = async (ms: number): Promise<void> =>
        new Promise(resolve => setTimeout(resolve, ms));


    // TODO refactor this so that it doesn't tick when no tasks until new message received
    for (;;) {
        // Wait until there's a task to do
        if (taskQueue.length === 0) {
            await delay(100);
            continue;
        }

        // Do task
        const task = taskQueue.shift();
        postMessage(new IPCMessage(IPCMessage.Type.C2H_NEXT_TASK));
        await doTask(task);
    }
}

main();