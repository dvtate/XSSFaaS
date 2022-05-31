
/**
 * Message types/prefixes so that tell us how to parse message
 * DS_* = only valid when sent to server (us)
 * DW_* = only valid when sent to worker (connected via websockets)
 */
enum WebSocketMessageType {
    // Prepare for disconnect by removing tasks not already started
    CLEAR_QUEUE, // no args

    // Sent by user to initialize connection
    AUTH, // args: authToken, workerId

    // Starting task
    DS_TASK_START, // args: task id

    // Task finished successfully
    DS_TASK_DONE, // args: task id

    // Task finished unsuccessfully
    DS_TASK_FAIL, // args: task id

    // Distribute task to worker
    DW_NEW_TASK, // args: task id, function id, additionalData json string

    // Tell worker not to perform given task
    DW_CANCEL_TASK, // args: task id

    // Server will reboot soon, await reconnect
    DW_RESET,

    // User provided an invalid authToken
    DW_BAD_AUTH_TOKEN,

    // User provided invalid workerId
    DW_BAD_WORKER_ID,
};

export default class WsMessage {
    static Type = WebSocketMessageType;

    constructor(
        public type: WebSocketMessageType,
        public args: string[] = [],
    ) {
    }

    static fromBuffer(data: any) {
        // TODO eventually we'll want to use binary messages
        if (data instanceof Array) {
            console.error('message should not be instance of array', data);
            return null;
        }
        try {
            const dstr = data.toString();
            const sInd = dstr.indexOf(' ');
            const t: WebSocketMessageType = Number(dstr.slice(0, sInd));
            const rem = dstr.slice(sInd + 1);
            switch (t) {
                // No args
                case WsMessage.Type.DW_RESET:
                case WsMessage.Type.CLEAR_QUEUE:
                case WsMessage.Type.DW_BAD_AUTH_TOKEN:
                case WsMessage.Type.DW_BAD_WORKER_ID:
                    return new WsMessage(t);

                // Single arg
                // case WsMessage.Type.DS_TASK_START:
                // case WsMessage.Type.DS_TASK_DONE:
                case WsMessage.Type.DW_CANCEL_TASK:
                // case WsMessage.Type.DS_TASK_FAIL:
                    return new WsMessage(t, [rem]);

                // Need to extract args
                case WsMessage.Type.AUTH:
                    // Should give [authToken, workerId]
                    return new WsMessage(t, rem.split(' '));
                case WsMessage.Type.DW_NEW_TASK: {
                    const si = rem.indexOf(' ');
                    const taskId = rem.slice(0, si);
                    const si2 = rem.indexOf(' ', si + 1);
                    const funId = rem.slice(si + 1, si2);
                    const additionalData = rem.slice(si2 + 1);
                    return new WsMessage(t, [taskId, funId, additionalData]);
                };
                default:
                    throw new Error('invalid message');
            }

        } catch (e) {
            console.error(e);
            return null;
        }
    }

    /**
     * Converts to a string for transmission
     * @returns string message
     */
    toString() {
        return this.type.toString() + ' ' + this.args.map(a => a.toString()).join(' ');
    }
}

