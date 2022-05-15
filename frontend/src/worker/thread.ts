
export class Task {
    public receivedTs: number;
    public startTs: number;
    public endTs: number;

    /**
     *
     * @param id task-job identifier
     * @param additionalData arguments to the relevant function
     */
    constructor(
        public id: string,
        public additionalData: any,
    ) {
        this.receivedTs = Date.now();
    }


}

/**
 * Class which interfaces with the worker threads
 */
export default class Thread {
    w = new Worker('index.worker.ts');

    taskQueue: Task[] = [];
    completedTasks: Task[] = [];
    activeTask: Task = null;

    /**
     * Task ids already in use
     */
    cachedIds = new Set<string>();

    constructor(
        public index: number,
    ) {

    }



}