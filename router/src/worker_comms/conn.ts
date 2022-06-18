import * as WebSocket from 'ws';
import axios from 'axios';

import Debugger from 'debug';
const debug = Debugger('xss:rtr:worker');

import { queryProm } from '../db';
import { authUserSafe } from '../auth';

import WsMessage from './message';
import Task from '../task';
import WsServer from './server';

/**
 * Format of response from ipinfo.io
 */
 interface IpInfo {
    ip?: string;         // '8.8.8.8'
    hostname?: string;   // 'dns.google'
    anycast?: boolean;  // true
    city?: string;       // 'Mountain View'
    region?: string;     // 'California'
    country?: string;    // 'US'
    loc?: string;        // '37.4056,-122.0775'
    org?: string;        // 'AS15169 Google LLC'
    postal?: string;     // '94043'
    timezone?: string;   // 'America/Chicago'
    bogon?: boolean;     // true
}

/**
 * Websocket connection with a worker tab
 */
export default class WorkerConnection {
    userId: number;
    workerId: number;
    threads: number;
    ipInfo: IpInfo;
    acceptForeignWork: boolean;

    /**
     *
     */
    private taskQueue = new Map<number, Task>();
    private activeTasks = new Map<number, Task>();

    private isAlive = true;
    private heartbeat: NodeJS.Timer;
    private isShuttingDown: boolean;

    /**
     * These functions should be cached already
     */
    public knownFunctions = new Set<string>();

    constructor(
        public server: WsServer,
        public socket: WebSocket,
    ) {
        // Set up event listeners
        this.socket.on('message', this.onMessage.bind(this));
        this.socket.on('error', this.onError.bind(this));
        this.socket.on('close', this.onDisconnect.bind(this));

        // Heartbeat
        this.socket.on('pong', () => { this.isAlive = true; });
        this.heartbeat = setInterval(this.heartbeatFunction.bind(this), 10000);
    }

    /**
     * This gets run every 30 seconds to verify the worker is still alive
     */
    private heartbeatFunction() {
        if (this.isAlive === false) {
            clearInterval(this.heartbeat);
            return this.socket.terminate();
        }
	if (this.isShuttingDown)
		debug('sd', [...this.activeTasks.values()].map(t => t.taskId).join());
        if (this.isShuttingDown && this.activeTasks.size === 0) {
            debug('Worker successfully finished all tasks. Disconnecting');
            clearInterval(this.heartbeat);
            return this.socket.terminate();
        }
        this.isAlive = false;
        this.socket.ping();
    }

    /**
     * Handler for websocket 'error' event
     */
    private onError() {
        // TODO figure out what types of errors we encounter
        debug('err', arguments);
    }

    /**
     * Handler for websocket 'message' event
     */
    private onMessage(data: WebSocket.RawData, isBinary: boolean) {
        let msg: WsMessage;
        try {
            msg = WsMessage.fromBuffer(data, isBinary);
        } catch (e) {
            debug('WsMessage.fromBuffer():', e.toString());
        }
        switch (msg.type) {
            case WsMessage.Type.CLEAR_QUEUE:
                // Redistribute work to other workers
                this.server.removeWorker(this);
                this.server.distribute(...this.taskQueue.values());
                this.isShuttingDown = true;
                break;
            case WsMessage.Type.AUTH:
                this.auth(msg.args[0], msg.args[1]);
                break;
            case WsMessage.Type.DS_TASK_DONE:
                this.endTask(this.activeTasks.get(Number(msg.args[0])));
                break;
            case WsMessage.Type.DS_TASK_FAIL:
                this.endTask(this.activeTasks.get(Number(msg.args[0])), true);
                break;
            case WsMessage.Type.DS_TASK_START: {
                const t = this.taskQueue.get(Number(msg.args[0]));
                if (!t) {
                    if (!this.activeTasks.has(Number(msg.args[0])))
                        debug('wtf unexpected task started %s', msg.args[0]);
                    break;
                }
		t.startTs = Date.now();
                this.activeTasks.set(t.taskId, t);
                this.taskQueue.delete(t.taskId);
                break;
            }
            default:
                debug('recieved invalid message: ', msg);
        }
    }

    private async endTask(t: Task, fail = false) {
        // Invalid taskId??
        if (!t) {
            debug('invalid end task id %d', t.taskId);
            // debug('active:', this.activeTasks.map(t => t.taskId));
            // debug('taskQueue:', this.taskQueue.map(t => t.taskId));
            return;
        }

        // Move onto next task
        this.activeTasks.delete(t.taskId);
        if (this.taskQueue.size) {
            const t = this.taskQueue.values().next().value;
            this.taskQueue.delete(t.taskId);
            t.startTs = Date.now();
            this.activeTasks.set(t.taskId, t);
        }

        // Update task tracking info
        t.endTs = Date.now();
        if (fail)
            t.fail();
        else
            t.writeToDb();
    }

    /**
     * Handler for websocket 'close' event
     */
    private onDisconnect() {
        debug('Worker %d disconnected', this.workerId);

        // Disable heartbeat
        clearInterval(this.heartbeat);

        // Don't accept more tasks
        this.server.removeWorker(this);

        // Redistribute tasks still in task queue
        this.server.distribute(...this.taskQueue.values());
        this.socket.terminate();

        // Mark Tasks currently being processed as completed
        this.activeTasks.forEach(t => t.fail());

        // Update last seen timestamp
        queryProm(
            `UPDATE Workers SET lastSeenTs=? WHERE workerId=?`,
            [Date.now(), this.workerId].map(String),
            false,
        );
    }

    /**
     * Initalize worker session, authenticates user-provided data
     * @param authToken authentication token
     * @param workerId worker Id
     * @returns true if succeessful false if provided data was invalid
     */
    private async auth(authToken: string, workerId: string) {
        // Validate authToken
        const auth = await authUserSafe(authToken);
        if (auth.error) {
            debug(auth.error);
            this.socket.send(new WsMessage(WsMessage.Type.DW_BAD_AUTH_TOKEN).toString());
            return false;
        }
        this.userId = auth.userId;

        // Validate workerId
        const worker = await queryProm(
            'SELECT threads, acceptForeignWork, ip, ipInfo FROM Workers WHERE workerId=? AND userId=? AND connectTs IS NULL',
            [workerId, String(this.userId)],
            true,
        );
        if (worker instanceof Error) {
            console.error(worker);
            this.socket.send(new WsMessage(WsMessage.Type.DW_BAD_WORKER_ID).toString());
            return false;
        }
        if (!worker[0]) {
            this.socket.send(new WsMessage(WsMessage.Type.DW_BAD_WORKER_ID).toString());
            return false;
        }

        // Get relevant info from database
        const { threads, acceptForeignWork, ip, ipInfo } = worker[0];
        this.workerId = Number(workerId);
        this.ipInfo = JSON.parse(ipInfo || null);
        if ( !ipInfo || ip !== this.ipInfo.ip) { // Note: observes privacy policy
            // Maybe the user provided invalid ipinfo? why bother checking this????
            axios.get('https://ipinfo.io/' + ip, { headers: { 'Accepts' : 'application/json' } })
                .then(r => { this.ipInfo = r.data as IpInfo; })
                .catch(debug);
        }
        this.acceptForeignWork = !!Number(acceptForeignWork);
        this.threads = threads;

        // Begin accepting work
        debug('worker authenticated');
        this.server.addWorker(this);
        this.socket.send(new WsMessage(WsMessage.Type.AUTH, []).toString());
        return true;
    }

    jobsPerProc() {
        return this.taskQueue.size / this.threads;
    }

    /**
     * Send the worker a new task
     * @param t task to send to worker
     */
    doTask(t: Task) {
        // Send task to worker
        this.socket.send(new WsMessage(WsMessage.Type.DW_NEW_TASK, [String(t.taskId), t.functionId, t.additionalData]).toString());
        this.taskQueue.set(t.taskId, t);

        // Worker caches function
        this.knownFunctions.add(t.functionId);

        // Update database
        queryProm(
            'UPDATE Tasks SET workerId=? WHERE taskId=?',
            [String(this.workerId), String(t.taskId)],
            false,
        );
    }
};
