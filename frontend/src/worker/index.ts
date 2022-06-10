import Thread from './thread';
import * as util from '../lib/util';
import WorkerApp from './worker';
import { Log, writeLog } from './logging';

/**
 * Singleton Worker app instance
 */
export let app = new WorkerApp();

// Prevent user from closing tab
// https://stackoverflow.com/questions/14746851/execute-javascript-function-before-browser-reloads-closes-browser-exits-page
window.onbeforeunload = function (evt) {
    // Cancel the event (if necessary)
    evt.preventDefault();
    // Google Chrome requires returnValue to be set
    evt.returnValue = '';

    // Mitigate damage
    app.prepareExit();

    // Stops it
    return null;
};


// Verify logged in
if (!util.getCookie('authToken'))
    window.location.href = '/portal/login.html';

// Mitigate damage
document.getElementById('btn-exit').onclick = () => app.prepareExit();