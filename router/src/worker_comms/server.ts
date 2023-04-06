import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';

// imports for ssl
import { createServer as HttpsServer } from 'https';
import * as fs from 'fs';

import Debugger from 'debug';
const debug = Debugger('xss:rtr:ws');

import { queryProm } from '../db';

import Task from '../task';
import WorkerConnection from './conn';

interface DBFunction {
    // // Irrelevant
    // name: string;
    // about: string;
    // creationTs: number;

    // Useful here
    functionId: string;
    userId: number;
    preventReuse: boolean;
    allowForeignWorkers: boolean;
    optSpec: 'CPU' | 'NET' | 'BALANCED';
}

/**
 * Manages websocket connections with the different connected workers
 */
export default class WsServer {
    /**
     * Workers to distribute tasks to
     */
    private workers: WorkerConnection[] = [];

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
            const server = HttpsServer({
                key: fs.readFileSync(process.env.SSL_KEY),
                cert: fs.readFileSync(process.env.SSL_CERT),
            });
            this.server = new WebSocket.Server({ server });
            this.bindWsListeners();
            server.listen(port, () => debug('wss listening on ' + port));
            return;
        }

        // Use ws://
        this.server = new WebSocket.Server({ port });
        this.server.on('listening', () => debug('ws listening on ' + port));
        this.bindWsListeners();
    }

    /**
     * Start distributing work to this worker
     * @param w worker connection
     */
    public addWorker(w: WorkerConnection) {
        this.workers.push(w);
    }

    /**
     * Stop distributing work to this worker
     */
    public removeWorker(w: WorkerConnection) {
        this.workers = this.workers.filter(wkr => wkr !== w);
    }

    /**
     * Fetch new user-submitted tasks from the database
     */
    async getWork() {
        // Get new work from db
        const work = await queryProm(`
            SELECT taskId, Tasks.functionId as functionId, userId, additionalData, arriveTs,
                allowForeignWorkers, optSpec, preventReuse
            FROM Tasks INNER JOIN Functions ON Tasks.functionId = Functions.functionId
            WHERE workerId IS NULL AND failed=0
            ORDER BY arriveTs ASC`, [], true);
        if (work instanceof Error)
            return debug(work);
        // debug('found %d tasks', work.length);

        // Distribute new work to workers
        return this.distribute(...work.map(w =>
            new Task(w.taskId, w.functionId, w.userId, w.additionalData, w.arriveTs, w.allowForeignWorkers, w.preventReuse)
        ));
    }

    /**
     * Distribute task to workers
     * @param t
     */
    private async distributeTask(t: Task) {
        const overloadedCutoff = 10;

        // Filter workers based on policy

        // Foreign policy
        let workers = this.workers;
        if (!t.allowForeignWorkers)
            workers = workers.filter(w => w.userId === t.userId);
        else
            workers = workers.filter(w => w.acceptForeignWork || t.userId === w.userId);

        // Reuse policy
        // TODO there should be a 3rd option for don't care
        if (t.preventReuse) {
            workers = workers.filter(w => !w.knownFunctions.has(t.functionId));
        } else {
            // If one of the workers already hosting this function isn't too busy send it more tasks
            // Else, find another worker
            const curWorkers = workers.filter(w => w.knownFunctions.has(t.functionId));
            if (curWorkers.some(w => w.jobsPerProc() < overloadedCutoff))
                workers = curWorkers;
        }

        // Pick a worker from remaining workers which isn't overloaded
        if (!workers.length) {
            // debug('no workers');
            return;
        }
        workers = workers.sort((a, b) => a.jobsPerProc() - b.jobsPerProc());
        const worker = workers[0];
        if (worker.jobsPerProc() > overloadedCutoff) {
            debug('workers overloaded');
            return;
        }
        worker.doTask(t);
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
     * Get some statistics about the workforce
     * @returns object with statistics
     */
    stats() {
        const workers = this.workers.length;
        const threads = this.workers
            .map(w => w.threads)
            .reduce((a, b) => a + b, 0);
        const tasks = this.workers
            .map(w => w.jobsPerProc() * w.threads)
            .reduce((a, b) => a + b, 0);
        return {
            workers, threads, tasks,
            loadAverage: (tasks / threads) || 0,
        };
    }
}
