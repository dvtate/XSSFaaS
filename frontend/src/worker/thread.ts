
export class Task {
    public receivedTs: number;
    public startTs: number;
    public endTs: number;


    constructor(
        public id: string,
    ) {
        this.receivedTs = Date.now();
    }
}

/**
 * Class which interfaces with the worker threads
 */
export default class Thread {
    w = new Worker('index.worker.ts');

    taskQueue: Array
    completedTasks: Array

    constructor(
        public index: number,

    ) {

    }
}