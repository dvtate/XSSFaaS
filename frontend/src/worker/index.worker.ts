// This script gets run by webworker threads

import { API_SERVER_URL } from '../lib/globals';
import { Task, IPCMessage } from './thread';

// Prevent Tasks from spawning additional workers
// TODO paid plan lol
const Worker_copy = globalThis.Worker;
globalThis.Worker = function Worker() {
    throw new Error('Cannot spawn additional web workers');
} as any;


onmessage = async function (m: MessageEvent<IPCMessage>) {
    switch(m.data.type) {
        case IPCMessage.Type.H2C_NEW_TASK:
            // Do task
            doTask(m.data.args)
                .then(() => postMessage(new IPCMessage(IPCMessage.Type.C2H_NEXT_TASK)))
                .catch(e => postMessage(new IPCMessage(IPCMessage.Type.C2H_FAIL, e)));
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

// TODO this should write logs to server
class HostUtils {
    constructor(public task: Task) {}
    log(m: string) {
        // TODO use {api}/worker/log/:taskId endpoint
        console.log(m);
    }
}

async function doTask(t: Task) {
    const f = await getFn(t.functionId);
    await f(t.additionalData, new HostUtils(t));
}
