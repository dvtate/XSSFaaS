
// TODO add a type of log entry that's not shown to user, only to creator

let logLevel = 0;

const logQueue = [];

const logView = document.getElementById('log-view');
const selectionView = document.getElementById('selection-view');

/**
 * Relevancy of the log message
 */
export enum Status {
    W_SUCCESS = 0,      // Job Succeeded
    W_INFO = 1,         // Worker info
    S_INFO = 2,         // System info
    W_FAILURE = 3,      // Job failed
    S_FATAL = 4,        // System crash
}

const statusStrings = ['Job Success', 'Worker info', 'System Info', 'Job failure', 'System fatal'];

/**
 * Base class for logs
 */
export class Log {
    /**
     * Timestamp of when log was created
     */
    readonly date: Date = new Date();

    /**
     * Origin worker
     */
    origin?: number

    /**
     * @param status type of log message
     * @param message message to display to the user
     * @param stack backtrace to help with debugging
     */
    constructor(
        public status: Status,
        public message: string,
        public stack: string = new Error().stack,
        public verbosity: number = 0,
    ) {
    }
}

/**
 *
 * @param log
 */
export function writeLog(log: Log) {
    function writePage(log: Log) {
        const div = document.createElement('div');
        div.classList.add('row', 'log-status-' + log.status);
        div.onclick = () => showLog(log);
        div.innerText = `${log.date.toISOString()}: ${log.message}`;
        logView.appendChild(div);
    }

    writePage(log);
    logQueue.push(log);

    if (logQueue.length > 50_000) {
        logQueue.splice(-10_000);
        logView.innerHTML = '';
        logQueue.forEach(writePage);
    }
}

/**
 * User clicked on a log in the log view
 * @param log log entry
 */
function showLog(log: Log) {
    selectionView.innerHTML = `
    <h2>Log Entry</h2>
    <dl>
        <dt>Status</dt>
        <dd>${statusStrings[log.status]}</dd>
        <dt>Message</dt>
        <dd>${log.message}</dd>
        <dt>Date</dt>
        <dd>${log.date}</dd>
        ${log.stack && `<dt>Stack</dt><dd>${log.stack}</dd>`}
        ${log.origin !== undefined && `<dt>Thread</dt><dd>${log.origin}</dd>`}
    </dl>`;
}