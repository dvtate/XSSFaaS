import * as util from '../lib/util';
import WorkerApp from './worker';
import { Log, writeLog } from './logging';
import statsInit from './stats';

/**
 * Singleton Worker app instance
 */
export let app: WorkerApp;


// For now this is the only controls given to the user
const ctlBtn = document.getElementById('btn-start-stop') as HTMLButtonElement;
ctlBtn.onclick = startWorking;

const nprocInp = document.getElementById('inp-nproc') as HTMLInputElement;
nprocInp.value = String(navigator.hardwareConcurrency);

main();

function main() {
    // Get GET params
    const getParams = util.getGetParams();

    // Authorization via url
    if (getParams['authToken'])
        util.setCookie('authToken', getParams['authToken'], 1000 * 60 * 60);
    else if (!util.getCookie('authToken')) {
        console.warn(util.getCookie('authToken'));
        window.location.href = '/portal/login.html';
    }

    // Set the number of webworker threads
    if (getParams['n']) {
        const n = getParams['n'];
        const nn = Number(n);
        if (n[0] === '+')
            nprocInp.value = String(navigator.hardwareConcurrency + Number(n.slice(1)));
        else if (['x', '*'].includes(n[0]))
            nprocInp.value = String(navigator.hardwareConcurrency * Number(n.slice(1)));
        else if (isNaN(nn) || nn === 0) {
            writeLog(new Log(Log.Type.S_FATAL, `Invalid number of processors n = ${n
                } setting to hardware recommended`));
        } else if (nn < 0) {
            const n = navigator.hardwareConcurrency - nn;
            if (n > 0)
                nprocInp.value = String(n);
            if (n <= 0) {
                writeLog(new Log(Log.Type.S_FATAL,
                    `Specified ${-nn} less than the number of processors but the host only has ${
                    navigator.hardwareConcurrency} processors`));
                return;
            }
        } else {
            nprocInp.value = n;
        }
    }

    // Start without user interaction?
    if (getParams['start'] !== undefined)
        startWorking();
    else
        writeLog(new Log(Log.Type.S_INFO, 'Press the Start button when ready'));
}

/**
 * Start accepting work from server
 */
function startWorking() {
    // Only runs once
    if (app)
        return;

    // Get the user's desired number of worker threads
    const nproc = Number(nprocInp.value);
    if (nproc > 5 * navigator.hardwareConcurrency || nproc === 0) {
        console.log('number of workers must be at least 1 and less than 5x the hardware concurrency available');
        nprocInp.style.border = '1px solid red';
        return;
    }
    app = new WorkerApp(nproc);
    statsInit(app);

    // Hide number input
    nprocInp.remove();
    document.getElementById('lbl-inp-nproc').remove();

    // Prevent tab from being closed randomly
    app.aquireWakelock();
    app.setExitListener();

    // Update button after short delay to prevent missclick
    setTimeout(() => {
        ctlBtn.onclick = stopWorking;
        ctlBtn.innerHTML = "Stop";
    }, 150);
}

/**
 * Prepares the tab for exit
 */
function stopWorking() {
    app.prepareExit(() => window.close());
    ctlBtn.remove();
}
