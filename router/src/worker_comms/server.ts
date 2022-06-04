import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';

// imports for ssl
import { createServer as HttpsServer } from 'https';
import * as fs from 'fs';

import Debugger from 'debug';
const debug = Debugger('xss:rtr:ws');

import { queryProm } from '../db';

import LL from '../util/ll';
import Task from '../task';
import WorkerConnection from './conn';

/**
 * Manages websocket connections with the different connected workers
 */
export default class WsServer {
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
    server: WebSocket.Server;

    /**
     * @constructor
     * Start the websocket server
     */
    constructor(port = Number(process.env.WS_PORT) || 6333) {
        this.startServer(port);
    }

    /**
     * Handles 'connection' websocket event
     */
    private onConnection(socket: WebSocket, request: IncomingMessage) {
        debug('New connection: ', request.socket.remoteAddress);
        // When the WorkerConnection is ready it will call this.acceptWorker()
        new WorkerConnection(this, socket);
    }

    /**
     * Add event listeners to the websocket server
     */
    private bindWsListeners() {
        this.server.on('connection', this.onConnection.bind(this));
        this.server.on('listening', () => debug('Listening'));
        this.server.on('close', () => debug('Connection closed??'));
        this.server.on('error', (...args) => debug('Error', args));
    }

    /**
     * Initialize this.server as a Websocket server
     * @param port port number to listen on
     */
    private startServer(port: number) {
        // Use wss://
        if (process.env.SSL_KEY && process.env.SSL_CERT) {
            const httpsServer = HttpsServer({
                key: fs.readFileSync(process.env.SSL_KEY),
                cert: fs.readFileSync(process.env.SSL_CERT),
            });
            this.server = new WebSocket.Server({
                port, server: httpsServer,
            });
            this.bindWsListeners();
            httpsServer.listen(port, () => debug('https listening on ' + port));
        }

        // Use ws://
        this.server = new WebSocket.Server({ port });
        this.bindWsListeners();
    }

    /**
     * Distribute task to workers
     * @param t
     */
    private async distributeTask(t: Task) {
        // Always use user's private workers if they have them
        const pws = this.privateWorkers[t.userId];
        if (pws && pws.next && pws.next.item) {
            pws.next.item.doTask(t);
            return;
        }

        // Use public worker
        if (this.publicWorkers.next) {
            this.publicWorkers.next.item.doTask(t);
            return;
        }

        // NOTE database acts as queue so no worries
        debug('received task but no workers!');
    }

    /**
     * Distribute tasks to workers
     * @param tasks tasks to distribute
     * @returns promise
     */
    async distribute(...tasks: Task[]) {
        return Promise.all(tasks.map(this.distributeTask.bind(this)));
    }

    /**
     * Add worker to our datastructures
     * @param w worker connection
     */
    public acceptWorker(w: WorkerConnection) {
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

    /**
     * Fetch new user-submitted tasks from the database
     */
    async getWork() {
        // Get new work from db
        const work = await queryProm(`
            SELECT taskId, Tasks.functionId as functionId, userId, additionalData, arriveTs, allowForeignWorkers
            FROM Tasks INNER JOIN Functions ON Tasks.functionId = Functions.functionId
            WHERE workerId IS NULL AND failed=0`, [], true);
        if (work instanceof Error)
            return debug(work);
        // debug('found %d tasks', work.length);

        // Distribute new work to workers
        return this.distribute(...work.map(w =>
            new Task(w.taskId, w.functionId, w.userId, w.additionalData, w.arriveTs, w.allowForeignWorkers)
        ));
    }
}
