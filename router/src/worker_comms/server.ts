import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';

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
    server = new WebSocket.Server({
        port: Number(process.env.WS_PORT),
    });

    constructor() {
        this.server.on('connection', this.onConnection.bind(this));
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

        // Use public worker
        if (this.publicWorkers.next) {
            this.publicWorkers.next.item.doTask(t);
            return;
        }

        debug('received a task but no workers!!!! site is ded lol');
        // NOTE database acts as queue
    }

    async distribute(...tasks: Task[]) {
        return Promise.all(tasks.map(this.distributeTask.bind(this)));
    }

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
