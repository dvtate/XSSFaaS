import { Task } from "./thread";
import { API_SERVER_URL } from "../lib/globals";
import { post } from "../lib/util";

/**
 * Worker session token
 */
// Need to make sure that this isn't directly accessible to the client function
export let authTokenRef: { authToken: string } = { authToken: '' };


/**
 * A set of utilities for the user
 */
export class TaskUtils {
    /**
     * This gets called right before the user closes the tab
     */
    atexit: CallableFunction = function () {
        this.log('no atexit handler provided, change the value of the `atexit` property of your TaskUtils object');
    };
    
    /**
     * @param task Current task being run
     * @param workerId ID of worker this task is running on
     */
    constructor(
        public task: Task, 
        protected readonly workerId = globalThis.workerId,
    ) {
    }

    /**
     * Write a log which you can view in the function's manage page from the portal
     * @param message Message to write
     */
    async log(message: string) {
        const ret = post(
            `${API_SERVER_URL}/worker/log/${this.task.taskId}`,
            { workerId: this.workerId, message, type: 'LOG' },
            authTokenRef.authToken,
        );
        // console.log(`[wt][${this.task.taskId}]:`, message);
        return ret;
    }

    // TODO requestNewHost() if host doesn't meet requirements for this task
}
