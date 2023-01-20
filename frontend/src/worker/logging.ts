
// TODO add a type of log entry that's not shown to user, only to creator

/**
 * Relevancy of the log message
 */
export enum LogType {
    W_SUCCESS = 0,      // Job Succeeded
    W_INFO = 1,         // Worker info
    S_INFO = 2,         // System info
    W_FAILURE = 3,      // Job failed
    S_FATAL = 4,        // System crash
}
const logTypeStrs = ['Job Success', 'Worker info', 'System Info', 'Job failure', 'System fatal'];

/**
 * Base class for logs
 */
export class Log {
    static Type = LogType

    /**
     * Timestamp of when log was created
     */
    readonly date: Date = new Date();

    /**
     * Origin worker
     */
    origin?: number

    /**
     * @param type type of log message
     * @param message message to display to the user
     * @param stack backtrace to help with debugging
     */
    constructor(
        public type: LogType,
        public message: string,
        public stack: string = new Error().stack.split('\n').slice(1).join('<br/>').trim(),
        public verbosity: number = 0,
    ) {
    }
}

/**
 * Logs accessible to the user
 */
const logQueue: Log[] = [];

/**
 * Where we put the logs, or undefined
 */
const logView = globalThis.document
    && document.getElementById
    && document.getElementById('xss-log-view');

/**
 * Display log entry to the user
 */
export function writeLog(log: Log) {
    // Update page and log queue
    if (logView) {
        const isScrolled = logView.scrollTop >= logView.scrollHeight / 2;
        function writeEntry(log: Log) {
            const div = document.createElement('div');
            div.classList.add('log-entry', 'log-status-' + log.type);
            div.onclick = () => showLog(log);
            div.innerText = `${log.date.toISOString()}: ${log.message}`;
            logView.appendChild(div);
            if (isScrolled)
                logView.scrollTop = logView.scrollHeight;
        }
        writeEntry(log);
        logQueue.push(log);

        // Cap at 50k log entries, keep last 10k
        if (logQueue.length > 50_000) {
            logQueue.splice(-10_000);
            logView.innerHTML = '';
            logQueue.forEach(writeEntry);
            logView.scrollTop = logView.scrollHeight;
        }
    } else if (globalThis.XSS_LOGGING_ENABLED > log.verbosity) {
        console.log(log.date.toISOString(), LogType[log.type], log.message)
    }
}

/**
 * User clicked on a log in the log view
 * @param log log entry
 */
function showLog(log: Log) {
    document.getElementById('selection-view').innerHTML = `
    <h2>Log Entry</h2>
    <dl>
        <dt>Type</dt>
        <dd>${logTypeStrs[log.type]}</dd>
        <dt>Message</dt>
        <dd>${log.message}</dd>
        <dt>Date</dt>
        <dd>${log.date}</dd>
        ${log.stack ? `<dt>Stack</dt><dd><code>${log.stack}</code></dd>` : ''}
        ${log.origin === undefined ? '' : `<dt>Thread</dt><dd>${log.origin}</dd>`}
    </dl>`;
}
