import { API_SERVER_URL, ENABLE_GEO_FEATURE, ROUTER_WS_URL } from "../lib/globals";
import { Log, writeLog } from './logging';
import * as util from '../lib/util';
import WsMessage from "./ws_message";
import Thread, { Task } from "./thread";

export default class WorkerApp {
    /**
     * Worker id from api server
     */
    workerId: number;

    /**
     * Authentication token for user
     */
    authToken = util.getCookie('authToken');

    /**
     * WebSocket connection
     */
    ws = new WebSocket(ROUTER_WS_URL);

    /**
     * Worker threads performing tasks
     */
    threads: Thread[] = [];

    /**
     * Work to do
     */
    taskQueue: Task[] = [];

    constructor() {
        // Bind listeners to ws
        this.ws.onopen = this.authenticate.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = () => writeLog(new Log(Log.Type.S_FATAL, 'Lost connection to the server'));

        // Spawn worker threads
        this.spawnThreads();
    }

    /**
     * Spawns webworker threads
     */
    private async spawnThreads() {
        const nproc = navigator.hardwareConcurrency;
        for (let i = 0; i < nproc; i++)
            this.threads.push(new Thread(this, i));
        writeLog(new Log(Log.Type.S_INFO, `Spawned ${nproc} worker threads`));
    }

    /**
     * Get a new worker id from api server
     */
    private async newWorkerId() {
        // Get some data which is important
        const ipInfo = ENABLE_GEO_FEATURE
            ? null // await fetch('https://ipinfo.io', { headers: { Accepts : 'application/json' }}).then(r => r.json())
            : null;

        // Request new workerId from api server
        const workerIdReq = await util.post(
            API_SERVER_URL + '/worker/enlist',
            { ncores: navigator.hardwareConcurrency, ipInfo },
        );
        if (workerIdReq.status !== 200)
            console.error('enlist request failed!', workerIdReq.status);

        // Store workerId
        this.workerId = Number(workerIdReq.text);
        writeLog(new Log(Log.Type.S_INFO, 'Connected to API server as worker ' + this.workerId));
        util.setCookie('workerId', workerIdReq.text, Infinity);
    }

    /**
     * Authenticate session on router server
     */
    async authenticate() {
        if (!util.getCookie('workerId')) {
            console.log(this);
            await this.newWorkerId();
        }
        this.ws.send(new WsMessage(WsMessage.Type.AUTH, [this.authToken, String(this.workerId)]).toString());
        writeLog(new Log(Log.Type.S_INFO, 'Sent authentication request to router'));
    }

    taskStarted(t: Task) {
        return this.ws.send(new WsMessage(WsMessage.Type.DS_TASK_START, [String(t.taskId)]).toString());
    }
    taskDone(t: Task) {
        return this.ws.send(new WsMessage(WsMessage.Type.DS_TASK_DONE, [String(t.taskId)]).toString());
    }
    taskFailed(t: Task) {
        return this.ws.send(new WsMessage(WsMessage.Type.DS_TASK_FAIL, [String(t.taskId)]).toString());
    }

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

    async onMessage(ev: MessageEvent) {
        // Parse message
        const m = WsMessage.fromBuffer(ev.data);
        if (!m)
            return writeLog(new Log(Log.Type.S_FATAL, 'message invalid ' + m));

        // Handle different message types
        switch (m.type) {
            case WsMessage.Type.DW_BAD_AUTH_TOKEN:
                window.location.href = 'login.html';
                return;
            case WsMessage.Type.DW_BAD_WORKER_ID:
                util.setCookie('workerId', '', 0);
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
                writeLog(new Log(Log.Type.S_INFO, 'Successfully authenticated with the router'));
                break;
        }

    }

    /**
     * Let's not do this task
     * @param t task to cancel
     * @returns true if task was cancelled false if task not in task queue
     */
    cancelTask(t: Task) {
        const origLen = this.taskQueue.length;
        this.taskQueue = this.taskQueue.filter(task => task.taskId !== t.taskId);
        return this.taskQueue.length !== origLen;
    }

    clearQueue() {
        this.ws.send(new WsMessage(WsMessage.Type.CLEAR_QUEUE, []).toString());
    }
};
