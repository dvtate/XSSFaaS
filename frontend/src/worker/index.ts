import Thread from './thread';
import * as util from '../lib/util';
import { API_SERVER_URL, ENABLE_GEO_FEATURE, ROUTER_SERVER_URL } from '../lib/globals';
import { Log, writeLog } from './logging';

// Prevent user from closing tab
// https://stackoverflow.com/questions/14746851/execute-javascript-function-before-browser-reloads-closes-browser-exits-page
window.addEventListener("beforeunload", function(evt) {
    // Cancel the event (if necessary)
    evt.preventDefault();
    // Google Chrome requires returnValue to be set
    evt.returnValue = '';

    // TODO send CLEAR_QUEUE message to router
    return null;
});


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
    async function newWorkerId() {
        // Get some data which is important
        const ipInfo = ENABLE_GEO_FEATURE
            ? await fetch('https://ipinfo.io', { headers: { Accepts : 'application/json' }}).then(r => r.json())
            : null;

        // Request new workerId from api server
        const workerIdReq = await util.post(
            API_SERVER_URL + '/worker/enlist',
            { ncores: navigator.hardwareConcurrency, ipInfo },
        );
        if (workerIdReq.status !== 200)
            console.error('enlist request failed!', workerIdReq.status);
        writeLog(new Log(Log.Type.S_INFO, 'Connected to API server as worker ' + workerId));

        // Store workerId
        workerId = Number(workerIdReq.text);
        util.setCookie('workerId', workerIdReq.text, Infinity);
    }

    // Verify we have workerId
    if (!util.getCookie('workerId'))
        await newWorkerId();

    // TODO once router server finished
    // Try to connect to router server with auth token and workerId
    // if invalid auth token => redirect to login page
    // if invalid workerid => generate new one

}

async function main() {
    // Verify logged in
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