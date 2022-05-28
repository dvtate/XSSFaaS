import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import axios from 'axios';

import Debugger from 'debug';
const debug = Debugger('xss:rtr:ws');

import { queryProm } from '../db';
import { authUserSafe } from '../auth';

import LL from '../util/ll';
import WsMessage from './message';
import Task from '../task';

interface IpInfo {
    ip: string;         // '8.8.8.8',
    hostname: string;   // 'lightspeed.cicril.sbcglobal.net',
    city: string;       // 'Chicago',
    region: string;     // 'Illinois',
    country: string;    // 'US',
    loc: string;        // '40.8805,-80.6873',
    org: string;        // 'AS7018 AT&T Services, Inc.',
    postal: string;     // '60606',
    timezone: string;   // 'America/Chicago'
}

/**
 * Websocket connection with a worker tab
 */
class WorkerConnection {
    userId: number;
    workerId: number;
    threads: number;
    ipInfo: IpInfo;
    acceptForeignWork: boolean;

    private taskQueue: Task[] = [];
    private activeTasks: Task[] = [];

    readonly llNode: LL<WorkerConnection>;

    private isAlive = true;
    private heartbeat: NodeJS.Timer;

    constructor(
        public server: WsServer,
        public socket: WebSocket,
    ) {
        // Set up event listeners
        this.socket.on('message', this.onMessage);
        this.socket.on('error', this.onError);
        this.socket.on('close', this.onDisconnect);

        // Heartbeat
        this.socket.on('pong', () => { this.isAlive = true; });
        this.heartbeat = setInterval(() => {
            if (this.isAlive === false)
                return this.socket.terminate();
            this.isAlive = false;
            this.socket.ping();
        }, 30000);

        this.llNode = new LL(this);
    }

    /**
     * Handler for websocket 'error' event
     */
    private onError() {
        // TODO figure out what types of errors we encounter
        console.error(arguments);
    }

    /**
     * Handler for websocket 'message' event
     */
    private onMessage(data: WebSocket.RawData, isBinary: boolean) {
        const msg = WsMessage.fromBuffer(data, isBinary);
        switch (msg.type) {
            case WsMessage.Type.CLEAR_QUEUE:
                this.server.distribute(...this.taskQueue.splice(0));
                break;
            case WsMessage.Type.DS_AUTH:
                this.auth(msg.args[0], msg.args[1]);
                break;
            case WsMessage.Type.DS_TASK_DONE: {
                // Get task
                const id = Number(msg.args[0]);
                const t = this.activeTasks.find(t => t.taskId == id);

                // Move onto next task
                this.activeTasks = this.activeTasks.filter(task => task !== t);
                if (this.taskQueue.length)
                    this.activeTasks.push(this.taskQueue.shift());

                if (t) {
                    // Update task tracking info
                    t.endTs = Date.now();
                    t.writeToDb();
                } else {
                    // Invalid taskId??
                    debug('invalid end task id %d', id);
                    debug('active:', this.activeTasks.map(t => t.taskId));
                    debug('taskQueue:', this.taskQueue.map(t => t.taskId));
                }
            };
        }
    }

    /**
     * Handler for websocket 'close' event
     */
    private async onDisconnect() {
        // Disable heartbeat
        clearInterval(this.heartbeat)

        // Don't accept more tasks
        this.llNode.removeSelf();

        // Redistribute tasks still in task queue
        await this.server.distribute(...this.taskQueue);
        this.socket.terminate();

        // Mark Tasks currently being processed as completed
        this.activeTasks.forEach(t => t.fail());
    }

    private async auth(authToken: string, workerId: string) {
        //
        const auth = await authUserSafe(authToken);
        if (auth.error) {
            debug(auth.error);
            this.socket.send(new WsMessage(WsMessage.Type.DW_BAD_AUTH_TOKEN).toString());
            return false;
        }
        this.userId = auth.userId;

        //
        const worker = await queryProm(
            'SELECT threads, acceptForeignWork, ip, ipInfo FROM Workers WHERE workerId=? AND userId=? AND connectTs = NULL',
            [workerId, String(this.userId)],
            true,
        );
        if (worker instanceof Error)
            console.error(worker);
        if (!worker[0]) {
            this.socket.send(new WsMessage(WsMessage.Type.DW_BAD_WORKER_ID).toString());
            return false;
        }
        const { threads, acceptForeignWork, ip, ipInfo } = worker[0];
        this.workerId = Number(workerId);
        this.ipInfo = JSON.parse(ipInfo);
        if (ipInfo && ip !== this.ipInfo.ip) { // Note: observes privacy policy
            // Get correct ipinfo... why did I even bother checking this?
            axios.get('https://ipinfo.io/' + ip, { headers: { 'Accepts' : 'application/json' } })
                .then(r => { this.ipInfo = r.data as IpInfo; });
        }
        this.acceptForeignWork = !!Number(acceptForeignWork);
        this.threads = threads;

        // Begin accepting work
        this.server.acceptWorker(this);
    }

    /**
     * Send the worker a new task
     * @param t task to send to worker
     */
    sendTask(t: Task) {
        this.taskQueue.push(t);
        this.socket.send(new WsMessage(
            WsMessage.Type.DW_NEW_TASK,
            [String(t.taskId), t.functionId, t.additionalData]));
    }
};

/**
 * Manages websocket connections with the different connected workers
 */
class WsServer {
    /**
     * Workers which accept tasks from anyone
     */
    private publicWorkers = new LL<WorkerConnection>();

    /**
     * Workers which only accept tasks from specific users
     */
    private privateWorkers: { [userId: number]: LL<WorkerConnection> } = {};

    /**
     * Websocket server which orchestrates workers
     */
    server = new WebSocket.Server({
        port: Number(process.env.WS_PORT),
    });

    constructor() {
        this.server.on('connection', this.onConnection);
    }

    private onConnection(socket: WebSocket, request: IncomingMessage) {
        // Once authenticated
        new WorkerConnection(this, socket);
    }

    private async distributeTask(t: Task) {
        if (!this.privateWorkers[])
        if (!this.publicWorkers.next && Object.keys()) {
            debug('received a task but no workers!!!! vbnasdhjfnjklaslfn sjkldfjka');
        }
    }

    async distribute(...tasks: Task[]) {
    }

    acceptWorker(w: WorkerConnection) {
        // Public worker
        if (w.acceptForeignWork) {
            this.publicWorkers.insertAfter(w.llNode);
            return;
        }

        // Private worker
        if (!this.privateWorkers[w.userId])
            this.privateWorkers[w.userId] = new LL<WorkerConnection>();
        this.privateWorkers[w.userId].insertAfter(w.llNode);
    }
}
