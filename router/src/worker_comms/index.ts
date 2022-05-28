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

/**
 * Format of response from ipinfo.io
 */
interface IpInfo {
    ip: string;         // '8.8.8.8'
    hostname: string;   // 'dns.google'
    anycast?: boolean;  // true
    city: string;       // 'Mountain View'
    region: string;     // 'California'
    country: string;    // 'US'
    loc: string;        // '37.4056,-122.0775'
    org: string;        // 'AS15169 Google LLC'
    postal: string;     // '94043'
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
        let msg: WsMessage;
        try {
            msg = WsMessage.fromBuffer(data, isBinary);
        } catch (e) {
            debug('WsMessage.fromBuffer():', e.toString());
        }
        switch (msg.type) {
            case WsMessage.Type.CLEAR_QUEUE:
                // Redistribute work to other workers
                this.server.distribute(...this.taskQueue.splice(0));

                // Stop receiving work
                this.llNode.removeSelf();

                // TODO once worker finishes it's activetasks we should terminate the socket
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

                // Update task queue
                this.updateLoadLL();
            };

            default:
                debug('recieved invalid message: ', msg);
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
            'SELECT threads, acceptForeignWork, ip, ipInfo FROM Workers WHERE workerId=? AND userId=? AND connectTs = NULL',
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
        this.ipInfo = JSON.parse(ipInfo);
        if (ipInfo && ip !== this.ipInfo.ip) { // Note: observes privacy policy
            // Maybe the user provided invalid ipinfo? why bother checking this????
            axios.get('https://ipinfo.io/' + ip, { headers: { 'Accepts' : 'application/json' } })
                .then(r => { this.ipInfo = r.data as IpInfo; })
                .catch(debug);
        }
        this.acceptForeignWork = !!Number(acceptForeignWork);
        this.threads = threads;

        // Begin accepting work
        debug('worker authenticated');
        this.server.acceptWorker(this);
        return true;
    }

    private updateLoadLL() {
        this.llNode.sortedReinsert((a, b) =>
            a.taskQueue.length / a.threads - b.taskQueue.length / b.threads);
    }

    /**
     * Send the worker a new task
     * @param t task to send to worker
     */
    doTask(t: Task) {
        this.taskQueue.push(t);
        this.socket.send(new WsMessage(WsMessage.Type.DW_NEW_TASK, [String(t.taskId), t.functionId, t.additionalData]));
        if (this.activeTasks.length < this.threads)
            this
        this.llNode.sortedReinsert((a, b) =>
            a.taskQueue.length / a.threads - b.taskQueue.length / b.threads);
        this.updateLoadLL();
    }
};

/**
 * Manages websocket connections with the different connected workers
 */
export class WsServer {
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
        this.server.on('listening', () => debug('listening'));
    }

    private onConnection(socket: WebSocket, request: IncomingMessage) {
        debug('new connection: ', request.socket.remoteAddress);
        // This looks weird but
        new WorkerConnection(this, socket);
    }

    private async distributeTask(t: Task) {
        // Always use user's private workers if they have them
        const pws = this.privateWorkers[t.userId];
        if (pws && pws.next && pws.next.item) {
            pws.next.item.doTask(t);
            return;
        }

        //
        if (!this.publicWorkers.next) {
            debug('received a task but no workers!!!! vbnasdhjfnjklaslfn sjkldfjka');
            // TODO maybe make a queue?
        } else {
            this.publicWorkers.next.item.doTask(t);
            return;
        }
    }

    async distribute(...tasks: Task[]) {
        return Promise.all(tasks.map(this.distributeTask));
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
