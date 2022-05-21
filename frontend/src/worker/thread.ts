import { Log, writeLog } from './logging'

/**
 * Task to be processed by the thread
 */
export class Task {
    public receivedTs: number;
    public startTs: number;
    public endTs: number;

    /**
     * @param id task identifier
     * @param fnId function identifier
     * @param additionalData arguments to the relevant function
     */
    constructor(
        public id,
        public fnId: string,
        public additionalData: any,
    ) {
        this.receivedTs = Date.now();
    }
}

/**
 * Different types of messages sent between host and worker threads
 *
 * H2C_*: host to child only
 * C2H_*: child to host only
 */
enum IPCMessageType {
    H2C_EMPTY_QUEUE,        // Host commands child to empty its queue
                            // args: none
    H2C_NEW_TASK,           // Host gives the child a new task to do
                            // args: fn id, task id, additional data
    H2C_CANCEL_TASK,        // Host tells child not to perfom previously given task
                            // args: task id

    C2H_NEXT_TASK,          // Child informs host that it's moving to the next task
                            // args: none
    C2H_FAIL,               // Failure to complete a task/error
                            // args: debug info
    C2H_DEBUG_LOG,          // Task generated debugging logs to be sent back to user
                            // arghs: Log object
}

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
     * Uncompleted tasks sent to the worker
     */
    protected taskQueue: Task[] = [];

    /**
     * Completed tasks sent to the worker
     */
    protected completedTasks: Task[] = [];

    /**
     * Task the worker is currently working on
     */
    activeTask?: Task = undefined;

    /**
     * Task ids already in use
     */
    cachedIds = new Set<string>();

    /**
     * @param index this thread's identifier
     */
    constructor(
        public index: number,
    ) {
        this.w.onmessage = m => this.onMessage(m);
        this.w.onerror = e => this.onError(e);
        this.w.onmessageerror = m => console.warn('w.onmessageerror:', m);
    }

    private onMessage(m: MessageEvent<IPCMessage>) {
        switch (m.data.type) {
            case IPCMessageType.C2H_DEBUG_LOG:
                console[m.data.args[0]](m.data.args[1]);
                break;
            case IPCMessageType.C2H_NEXT_TASK:
                this.activeTask.endTs = Date.now();
                this.completedTasks.push(this.activeTask);
                this.activeTask = this.taskQueue.shift();
                this.activeTask.startTs = Date.now();
                writeLog(new Log(Log.Type.W_SUCCESS, `Thread ${this.index} completed task`))
                break;
            case IPCMessageType.C2H_FAIL:
                writeLog(m.data.args);
                break;
            default:
                console.error('WTF? abnormal message type??', m.data);
                writeLog(new Log(Log.Type.W_INFO, 'unexpected '))
        }
    }

    private onError(e: ErrorEvent) {
        writeLog(new Log(
            Log.Type.W_FAILURE,
            `Thread ${this.index} sent Error event: ${e.error.message}`,
            e.error.error.stack,
        ));
    }

    addTask(t: Task) {
        this.taskQueue.push(t);
        this.w.postMessage(new IPCMessage(IPCMessage.Type.H2C_NEW_TASK, t));
        writeLog(new Log(Log.Type.S_INFO, `Assigned Task to thread ${this.index}`));
    }
}