import Thread from './thread';
import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

/**
 *
 */
export let workerId: number;

/**
 * Worker threads performing tasks
 */
const threads: Thread[] = [];



async function connectToRouter() {
    const workerIdReq = await util.post(API_SERVER_URL + '/worker/enlist', { ncores: navigator.hardwareConcurrency });
    if (workerIdReq.status !== 200)
        console.error('enlist request failed!', workerIdReq.status);
    workerId = Number(workerIdReq.text);
}

async function spawnWorkerThreads() {
    const nproc = navigator.hardwareConcurrency;
    for (let i = 0; i < nproc; i++) {
        threads.push(new Thread(i));
    }
}


async function main() {
    await spawnWorkerThreads();
    await connectToRouter();
}