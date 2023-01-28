// This script gets run by webworker threads

import { API_SERVER_URL } from '../lib/globals';
import { Task, IPCMessage } from './thread';
import { post } from '../lib/util';

// Prevent Tasks from spawning additional workers
// const Worker_copy = self.Worker;
self.Worker = function Worker() {
    throw new Error('Cannot spawn additional web workers');
} as any;

// Worker ID this thread is associated with
let workerId: number;

// Authentication token
let authToken: string;

// Handle communications from the host
onmessage = async function (m: MessageEvent<IPCMessage>) {
    switch(m.data.type) {
        // Do task
        case IPCMessage.Type.H2C_NEW_TASK:
            doTask(m.data.args)
                .then(() => postMessage(new IPCMessage(IPCMessage.Type.C2H_NEXT_TASK)))
                .catch(e => postMessage(new IPCMessage(IPCMessage.Type.C2H_FAIL, e)));
            break;

        // Update workerId and authToken
        case IPCMessage.Type.H2C_AUTH:
            [workerId, authToken] = m.data.args;
            break;

        // Call the users atexit handler
        case IPCMessage.Type.H2C_KILL:
            if (taskUtilsObject)
                taskUtilsObject.atexit();
            break;

        default:
            console.error('invalid message', m);
    }
}

/**
 * A set of utilities for the user
 */
export class TaskUtils {
    /**
     * This gets called right before the user closes the tab
     */
    atexit: CallableFunction = function () {
        this.log('no atexit handler provided, change the value of the `atexit` property of your TaskUtils object');
    };

    /**
     * @param task Current task being run
     */
    constructor(public task: Task) {
    	console.log(this);
    }

    /**
     * Write a log which you can view in the function's manage page from the portal
     * @param message Message to write
     */
    async log(message: string) {
        const ret = post(
            `${API_SERVER_URL}/worker/log/${this.task.taskId}`,
            { workerId, message, type: 'LOG' },
            authToken,
        );
        console.log(`[wt][${this.task.taskId}]:`, message);
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

let taskUtilsObject: TaskUtils = null;
async function doTask(t: Task) {
	console.log('dotask: ', t);
    const m = await getFn(t.functionId);
    taskUtilsObject = new TaskUtils(t);
    await m.default(t.additionalData, taskUtilsObject);
    taskUtilsObject = null;
}
