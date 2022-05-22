import Thread from './thread';
import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';
import { Log, writeLog } from './logging';

/**
 * Unique identifier associated with this instance
 */
export let workerId: number;

/**
 * Worker threads performing tasks
 */
const threads: Thread[] = [];

/**
 * Establish connection to router server
 */
async function connectToRouter() {
    const workerIdReq = await util.post(API_SERVER_URL + '/worker/enlist', { ncores: navigator.hardwareConcurrency });
    if (workerIdReq.status !== 200)
        console.error('enlist request failed!', workerIdReq.status);
    workerId = Number(workerIdReq.text);
    writeLog(new Log(Log.Type.S_INFO, 'Connected to API server as worker ' + workerId));
}


async function main() {
    if (!util.getCookie('authToken'))
        window.location.href = '/portal/login.html';

    // Spawn threads
    const nproc = navigator.hardwareConcurrency;
    for (let i = 0; i < nproc; i++)
        threads.push(new Thread(i));
    writeLog(new Log(Log.Type.S_INFO, `Spawned ${nproc} worker threads`));
    await connectToRouter();
}

main();