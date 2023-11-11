import { API_SERVER_URL, ENABLE_GEO_FEATURE, ROUTER_WS_URL } from "../lib/globals";
import { Log, writeLog } from './logging';
import * as util from '../lib/util';
import WsMessage from "./message";
import Thread, { Task } from "./thread";

/**
 * Handles communication between the server and the worker threads
 */
export default class WorkerApp {
    /**
     * Worker id from api server
     */
    workerId?: number;

    /**
     * WebSocket connection
     */
    ws: WebSocket;

    /**
     * Worker threads performing tasks
     */
    threads: Thread[] = [];

    /**
     * Work to do
     */
    taskQueue: Task[] = [];

    /**
     * Used to prevent screen from falling asleep
     */
    protected wakeLock: any = null;

    /**
     * @param acceptForeignWork should this worker accept tasks from other users?
     * @param nproc number of worker threads to use
     * @param authToken Authentication token for user
     */
    constructor(
        public acceptForeignWork: boolean = true,
        public nproc: number = navigator.hardwareConcurrency - 1,
        public authToken = util.getCookie('authToken'),
    ) {
        // Connect to router server via websockets
        this.ws = new WebSocket(ROUTER_WS_URL);
        this.ws.onopen = this.authenticate.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = this.onClose.bind(this);

        // Spawn worker threads
        for (let i = 0; i < this.nproc; i++)
            this.threads.push(new Thread(this, i));
        writeLog(new Log(Log.Type.S_INFO, `Spawned ${this.nproc} worker threads`));
    }

    // Task tracking messages
    taskStarted(t: Task, threadIndex?: number) {
        this.ws.send(new WsMessage(WsMessage.Type.DS_TASK_START, [String(t.taskId)]).toString());
        writeLog(new Log(Log.Type.W_SUCCESS, `Thread ${threadIndex !== undefined ? ' '+threadIndex : '' } started task ${t.taskId}`));
    }
    taskDone(t: Task, threadIndex?: number) {
        this.ws.send(new WsMessage(WsMessage.Type.DS_TASK_DONE, [String(t.taskId)]).toString());
        writeLog(new Log(Log.Type.W_SUCCESS, `Thread ${threadIndex !== undefined ? ' '+threadIndex : '' } completed task ${t.taskId}`));
    }
    taskFailed(t: Task, threadIndex?: number) {
        this.ws.send(new WsMessage(WsMessage.Type.DS_TASK_FAIL, [String(t.taskId)]).toString());
        writeLog(new Log(Log.Type.W_SUCCESS, `Thread ${threadIndex !== undefined ? ' '+threadIndex : '' } failed task ${t.taskId}`));
    }

    /**
     * Assign task to a worker thread or put it into task queue
     */
    private newTask(t: Task) {
        // If there are idle threads put them to work
        const inactiveThread = this.threads.find(t => !t.activeTask);
        if (inactiveThread) {
            inactiveThread.doTask(t);
            return;
        }

        // Wait until there are idle threads
        this.taskQueue.push(t);
    }

    /**
     * Get a new worker id from api server
     */
    private async newWorkerId() {
        // not cool
        const ipInfo = ENABLE_GEO_FEATURE
            ? null // await fetch('https://ipinfo.io/json', { headers: { Accepts : 'application/json' }}).then(r => r.json())
            : null;

        // Request new workerId from api server
        const workerIdReq = await util.post(
            API_SERVER_URL + '/worker/enlist',
            { ncores: this.nproc, acceptForeignWork: this.acceptForeignWork, ipInfo },
            this.authToken,
        );
        if (workerIdReq.status !== 200)
            console.error('enlist request failed!', workerIdReq.status);

        // Store workerId
        this.workerId = Number(workerIdReq.text);
        writeLog(new Log(Log.Type.S_INFO, 'Connected to API server as worker ' + this.workerId));
    }

    /**
     * Authenticate session on router server
     */
    private async authenticate() {
        if (this.workerId === undefined) {
            await this.newWorkerId();
        }        
        this.ws.send(new WsMessage(WsMessage.Type.AUTH, [this.authToken, String(this.workerId)]).toString());
        writeLog(new Log(Log.Type.S_INFO, 'Sent authentication request to router'));
        this.threads.forEach(t => t.auth());
    }

    /**
     * WebSocket onmessage handler
     */
    async onMessage(ev: MessageEvent) {
        // Parse message
        const m = WsMessage.fromBuffer(ev.data);
        if (!m)
            return writeLog(new Log(Log.Type.S_FATAL, 'message invalid ' + m));

        // Handle different message types
        switch (m.type) {
            case WsMessage.Type.DW_BAD_AUTH_TOKEN:
                window.location.href = '/portal/login.html';
                return;
            case WsMessage.Type.DW_BAD_WORKER_ID:
                this.workerId = undefined;
                writeLog(new Log(Log.Type.S_INFO, 'Requesting new worker id'));
                await this.authenticate();
                break;
            case WsMessage.Type.DW_CANCEL_TASK:
                if (!this.cancelTask(new Task(Number(m.args[0]), null)))
                    writeLog(new Log(Log.Type.S_FATAL, 'Failed to cancel task ' + m.args[0]));
                else
                    writeLog(new Log(Log.Type.S_INFO, 'Cancelled task ' + m.args[0]));
                break;
            case WsMessage.Type.DW_NEW_TASK:
                writeLog(new Log(Log.Type.S_INFO, 'Received task ' + m.args[0]));
                this.newTask(new Task(Number(m.args[0]), m.args[1], m.args[2]));
                break;
            case WsMessage.Type.CLEAR_QUEUE:
                this.taskQueue = [];
                break;
            case WsMessage.Type.AUTH:
                writeLog(new Log(Log.Type.S_INFO, 'Successfully authenticated with the router.'));
                writeLog(new Log(Log.Type.S_INFO, 'Waiting for tasks.'));
                break;
        }

    }

    /**
     * Websocket onclose listener
     */
    private onClose() {
        writeLog(new Log(Log.Type.S_FATAL, 'Lost connection to the server'));
        this.taskQueue = [];

        // TODO try to reconnect
    }

    /**
     * Let's not do this task
     * @param t task to cancel
     * @returns true if task was cancelled false if task not in task queue
     */
    private cancelTask(t: Task) {
        const origLen = this.taskQueue.length;
        this.taskQueue = this.taskQueue.filter(task => task.taskId !== t.taskId);
        return this.taskQueue.length !== origLen;
    }

    /**
     * Get the number of active threads. If zero then it is safe to close the tab
     * @returns number of threads with an active task
     */
    activeThreads() {
        let ret = 0;
        this.threads.forEach(t => {
            if (t.activeTask)
                ret++;
        });
        return ret;
    }

    /**
     * User wants to close the tab
     */
    async prepareExit(cb?: CallableFunction): Promise<void> {
        // Stop working
        this.threads.forEach(t => t.kill());
        this.ws.send(new WsMessage(WsMessage.Type.CLEAR_QUEUE, []).toString());
        this.taskQueue = [];
        writeLog(new Log(Log.Type.S_INFO, 'Calling task atexit handlers'));
        writeLog(new Log(Log.Type.S_INFO, 'Sending CLEAR_QUEUE to server so that worker can shutdown'));

        // Track active threads untill they all finish
        let lastActiveThreads = null;
        const interval = setInterval(() => {
            const active = this.activeThreads();
            if (active === 0) {
                writeLog(new Log(Log.Type.S_FATAL, 'All tasks completed successfully, you may now exit the tab'));
                clearInterval(interval);
                this.unsetExitListener();
                this.releaseWakeLock();
                if (cb)
                    cb();
            } else if (active !== lastActiveThreads) {
                writeLog(new Log(Log.Type.S_FATAL, 'There are still ' + active
                    + ' active threads, please wait a few seconds for them to finish'));
                lastActiveThreads = active;
            }
        }, 200);
    }

    /**
     * Prompt user before they close tab, perform damage control
     */
    setExitListener(cb?: CallableFunction) {
        // Prevent user from closing tab
        // https://stackoverflow.com/questions/14746851/execute-javascript-function-before-browser-reloads-closes-browser-exits-page
        window.onbeforeunload = (evt: any) => {
            // Cancel the event (if necessary)
            evt.preventDefault();
            // Google Chrome requires returnValue to be set
            evt.returnValue = '';

            // Mitigate damage
            this.prepareExit(cb);

            // Stops it
            return null;
        };
    }

    /**
     * Remove the exit listener set by setExitListener
     */
    unsetExitListener() {
        window.onbeforeunload = () => window.close();
    }

    /**
     * Prevent screen from falling asleep
     * @returns {WakeLockSentinel} - this.wakeLock
     */
    async aquireWakelock(): Promise<any> {
        // Experimental web api may not exist!
        if (!navigator['wakeLock'])
            return false;

        try {
            // @ts-ignore this is still an experimental web api
            return this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {
            // Example: low battery
            console.error('unable to aquire wakelock:', e);
            return false;
        }
    }

    async releaseWakeLock(): Promise<undefined> {
        // Can't release if not already aquired
        if (!this.wakeLock)
            return;

        const ret = this.wakeLock.release();
        this.wakeLock = null;
        return ret;
    }

    activeTasks() {
        return this.threads.map(t => t.activeTask).filter(Boolean);
    }

    completedTasks() {
        return [].concat(...this.threads.map(t => t.completedTasks)) as Task[];
    }
};
