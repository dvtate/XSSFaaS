import { queryProm } from "./db";


/**
 * Task to be processed by the thread
 */
export default class Task {
    /**
     * Time at which the worker started the task
     */
    public startTs: number = null;

    /**
     * Time at which the worker finished the task
     */
    public endTs: number = null;

    /**
     * Did the task fail?
     */
    public readonly failed: boolean = false;

    /**
     * Relevant data passed to the worker
     */
    public readonly additionalData: string;

    /**
     * @param taskId id for this task
     * @param functionId id of the function which performs this task
     * @param userId id for user who submitted the task
     * @param additionalData arguments to the relevant function
     * @param arriveTs Time at which the task was received
     */
    constructor(
        public readonly taskId: number,
        public readonly functionId: string,
        public readonly userId: number,
        additionalData: any,
        public readonly arriveTs = Date.now(),
    ) {
        this.additionalData = JSON.stringify(additionalData);
    }

    /**
     * Task probably succeeded, track that
     */
    async writeToDb() {
        return queryProm(
            'UPDATE Tasks SET startTs=?, endTs=? WHERE taskId=?',
            [this.startTs, this.endTs, this.taskId].map(String),
            false,
        );
    }

    /**
     * Task probably failed
     */
    async fail() {
        return queryProm(
            'UPDATE Tasks SET startTs=?, failed=1 WHERE taskId=?',
            [String(this.startTs), String(this.taskId)],
            false,
        );
    }
}