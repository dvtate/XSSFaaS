// This script gets run by webworker threads

import { API_SERVER_URL } from '../lib/globals';
import { Task, IPCMessage } from './thread';
import { post } from '../lib/util';

// Prevent Tasks from spawning additional workers
const Worker_copy = self.Worker;
self.Worker = function Worker() {
    throw new Error('Cannot spawn additional web workers');
} as any;

// Worker ID this thread is associated with
let workerId: number;

// Handle communication between host
onmessage = async function (m: MessageEvent<IPCMessage>) {
    switch(m.data.type) {
        // Do task
        case IPCMessage.Type.H2C_NEW_TASK:
            doTask(m.data.args)
                .then(() => postMessage(new IPCMessage(IPCMessage.Type.C2H_NEXT_TASK)))
                .catch(e => postMessage(new IPCMessage(IPCMessage.Type.C2H_FAIL, e)));
            break;

        // Update workerId
        case IPCMessage.Type.H2C_WORKERID:
            workerId = m.data.args;
            break;

        default:
            console.error('invalid message', m);
    }
}

/**
 * A set of utilities for the user
 */
class HostUtils {
    /**
     * @param task Current task being run
     */
    constructor(public task: Task) {}

    /**
     * Write a log which you can view in the function's manage page from the portal
     * @param message Message to write
     */
    async log(message: string) {
        // TODO use {api}/worker/log/:taskId endpoint
        const ret = post(
            `${API_SERVER_URL}/worker/log/${this.task.taskId}`,
            { workerId, message, type: 'LOG' },
        );
        console.log(`[wt][${this.task.taskId}]`, message);
        return ret;
    }

    /**
     * ID for worker this task is running on
     */
    get workerId() {
        return workerId;
    }
}

const jobFnCache: { [id: string] : any } = {};
async function getFn(id: string) {
    return jobFnCache[id]
        || (jobFnCache[id] = await import(
            /* webpackIgnore: true */
            `${API_SERVER_URL}/worker/asset/${id}/index.js`
        ));
}

async function doTask(t: Task) {
    const f = await getFn(t.functionId);
    await f.default(t.additionalData, new HostUtils(t));
}
