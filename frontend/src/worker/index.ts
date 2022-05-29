import Thread from './thread';
import * as util from '../lib/util';
import WorkerApp from './worker';
import { Log, writeLog } from './logging';

/**
 * Singleton Worker app instance
 */
export const app = new WorkerApp();

// Prevent user from closing tab
// https://stackoverflow.com/questions/14746851/execute-javascript-function-before-browser-reloads-closes-browser-exits-page
window.addEventListener("beforeunload", function (evt) {
    // Cancel the event (if necessary)
    evt.preventDefault();
    // Google Chrome requires returnValue to be set
    evt.returnValue = '';

    // TODO send CLEAR_QUEUE message to router
    // which eventually tells user when it's ok to close
    app.clearQueue();
    writeLog(new Log(Log.Type.S_INFO, 'Sending CLEAR_QUEUE to server so that worker can shutdown'));
    return null;
});


// Verify logged in
if (!util.getCookie('authToken'))
    window.location.href = '/portal/login.html';


// TODO controls