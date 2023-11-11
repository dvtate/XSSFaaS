// This script gets run by webworker threads

import { API_SERVER_URL } from '../lib/globals';
import { Task, IPCMessage } from './thread';
import { TaskUtils, authTokenRef } from './taskutils';

// Prevent Tasks from spawning additional workers
// const Worker_copy = self.Worker;
self.Worker = function Worker() {
    throw new Error('Cannot spawn additional web workers');
} as any;

// Worker ID this thread is associated with
let workerId: number;

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
            [workerId, authTokenRef.authToken] = m.data.args;
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

const jobFnCache: { [id: string] : any } = {};
async function getFn(id: string) {
    return jobFnCache[id]
        || (jobFnCache[id] = await import(
            /* webpackIgnore: true */
            `${API_SERVER_URL}/worker/asset/${encodeURIComponent(authTokenRef.authToken)}/${id}/index.js`
        ));
}

let taskUtilsObject: TaskUtils = null;
async function doTask(t: Task) {
    const m = await getFn(t.functionId);
    taskUtilsObject = new TaskUtils(t, authTokenRef.authToken, workerId);
    await m.default(t.additionalData, taskUtilsObject);
    taskUtilsObject = null;
}
