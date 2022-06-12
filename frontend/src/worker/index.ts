import * as util from '../lib/util';
import WorkerApp from './worker';
import { Log, writeLog } from './logging';

/**
 * Singleton Worker app instance
 */
export let app: WorkerApp;


// For now this is the only controls given to the user
const ctlBtn = document.getElementById('btn-start-stop') as HTMLButtonElement;
ctlBtn.onclick = startWorking;

const nprocInp = document.getElementById('inp-nproc') as HTMLInputElement;
nprocInp.value = String(navigator.hardwareConcurrency);

/**
 * Start accepting work from server
 */
function startWorking(ev) {
    // Only runs once
    if (app)
        return;

    // Get the user's desired number of worker threads
    try {
        const nproc = Number(nprocInp.value);
        if (nproc > 5 * navigator.hardwareConcurrency)
            throw '5x overloading cap';
        app = new WorkerApp(nproc);
    } catch (e) {
        console.error(e);
        nprocInp.style.border = '1px solid red';
        return;
    }

    // Hide number input
    nprocInp.remove();
    document.getElementById('lbl-inp-nproc').remove();

    // Prevent/delay user from accidentally closing tab
    app.setExitListener();

    // Update button
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

// Verify logged in
if (!util.getCookie('authToken'))
    window.location.href = '/portal/login.html';

// Give user instructions
writeLog(new Log(Log.Type.S_INFO, 'Press the Start button when ready'));
