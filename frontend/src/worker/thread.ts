import { Log, writeLog } from './logging'
import WorkerApp from './worker';

/**
 * Task to be processed by the thread
 */
export class Task {
    public receivedTs: number;
    public startTs: number;
    public endTs: number;

    /**
     * @param taskId task identifier
     * @param functionId function identifier
     * @param additionalData arguments to the relevant function
     */
    constructor(
        public taskId: number,
        public functionId: string,
        public additionalData?: string,
    ) {
        this.receivedTs = Date.now();
    }

    timeSpentInQueue() {
        if (!this.startTs)
            return Date.now() - this.receivedTs;
        return this.startTs - this.receivedTs;
    }

    runtime() {
        if (!this.startTs)
            return undefined;
        if (!this.endTs)
            return Date.now() - this.startTs;
        return this.endTs - this.startTs;
    }
}

/**
 * Different types of messages sent between host and worker threads
 *
 * H2C_*: host to child only
 * C2H_*: child to host only
 */
enum IPCMessageType {
    H2C_NEW_TASK,           // Host gives the child a new task to do
                            // args: fn id, task id, additional data
    C2H_NEXT_TASK,          // Child informs host that it's moving to the next task
                            // args: none
    C2H_FAIL,               // Failure to complete a task/error
                            // args: debug info
    C2H_DEBUG_LOG,          // Task generated debugging logs to be sent back to user
                            // args: Log object

    H2C_AUTH,               // Set the workerId and authToken
                            // args: workerId, authToken

    // TODO message to cancel current task
}

/**
 * Message format for communication between host and web worker threads
 */
export class IPCMessage {
    static Type = IPCMessageType;
    constructor(
        public type: IPCMessageType,
        public args?: any,
    ) {
    }
}

/**
 * Class which interfaces with the worker threads
 */
export default class Thread {
    /**
     * Web Worker thread
     */
    w = new Worker('index.worker.bundle.js');

    /**
     * Completed tasks sent to the worker
     */
    readonly completedTasks: Task[] = [];

    /**
     * Task the worker is currently working on
     */
    activeTask: Task = null;

    /**
     * Task ids already in use
     */
    cachedIds = new Set<string>();

    /**
     * @param index this thread's identifier
     */
    constructor(
        public workerApp: WorkerApp,
        public index: number,
    ) {
        this.w.onmessage = m => this.onMessage(m);
        this.w.onerror = e => this.onError(e);
        this.w.onmessageerror = m => console.error('w.onmessageerror:', m);
    }

    /**
     * Websocket onmessage event handler
     */
    private onMessage(m: MessageEvent<IPCMessage>) {
        switch (m.data.type) {
            case IPCMessageType.C2H_DEBUG_LOG:
                console[m.data.args[0]](m.data.args[1]);
                break;
            case IPCMessageType.C2H_NEXT_TASK:
                this.nextTask();
                break;
            case IPCMessageType.C2H_FAIL:
                console.error('task failed', m.data.args);
                this.nextTask(true);
                writeLog(new Log(Log.Type.W_FAILURE, `Task ${this.activeTask.taskId} failed`, m.data.args));
                break;
            default:
                console.error('WTF? invalid message type??', m.data);
                writeLog(new Log(Log.Type.W_INFO, 'unexpected message type: ' + m.data.type));
                break;
        }
    }

    /**
     * Websocket onerror event handler
     */
    private onError(e: ErrorEvent) {
        writeLog(new Log(
            Log.Type.W_FAILURE,
            `Thread ${this.index} sent Error event: ${e.error.message}`,
            e.error.error.stack,
        ));
    }

    /**
     * Called when task completed
     */
    nextTask(failed = false) {
        // Finish task
        const t = this.activeTask;
        if (t) {
            t.endTs = Date.now();
            this.completedTasks.push(t);
            this.activeTask = null;
            if (failed)
                this.workerApp.taskFailed(t);
            else
                this.workerApp.taskDone(t);
        }

        // Move on to next task
        if (this.workerApp.taskQueue.length) {
            const nt = this.workerApp.taskQueue.find(t => this.cachedIds.has(t.functionId));
            if (nt) {
                this.workerApp.taskQueue = this.workerApp.taskQueue.filter(t => t !== nt);
                this.doTask(nt);
            } else {
                this.doTask(this.workerApp.taskQueue.shift());
            }
        }

    }

    doTask(t: Task) {
        if (this.activeTask)
            console.error('cannot doTask when activeTask still in progress', t, this);
        this.activeTask = t;
        this.activeTask.startTs = Date.now();
        this.w.postMessage(new IPCMessage(
            IPCMessage.Type.H2C_NEW_TASK,
            this.activeTask,
            // [this.activeTask.functionId, this.activeTask.additionalData]
        ));
        writeLog(new Log(Log.Type.W_INFO, `Task ${this.activeTask.taskId} assigned to Thread ${this.index}`));
        this.workerApp.taskStarted(t);
    }

    auth() {
        this.w.postMessage(new IPCMessage(
            IPCMessage.Type.H2C_AUTH,
            [this.workerApp.workerId, this.workerApp.authToken],
        ));
    }
}
