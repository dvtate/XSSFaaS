import type { TaskUtils } from '../frontend/src/worker/index.worker';

/**
 * The worker will call this default export when compiled to index.js
 * @param additionalData data that the caller passes
 * @param utils
 */
export default async function (additionalData: string, utils: TaskUtils) {
    // Get some IP info data about the worker
    const req = await fetch('https://ipinfo.io/', {
        headers: { Accepts : 'application/json' },
    });
    const ipInfo = await req.json();
    const loc = ipInfo.city || ipInfo.region || 'the internet';

    // Lets assume the caller passes something like this: '{"user":"Jerry"}'
    const args = JSON.parse(additionalData);

    // We can do some statistics about
    const timeSpentInQueue = Math.floor((utils.task.startTs - utils.task.receivedTs) / 1000);

    // Write a log which can be viewed from the function portal
    utils.log(`After ${timeSpentInQueue} seconds, ${args.user}, says:
        Hello from ${loc}! Thanks to worker #${utils.workerId}.`);
}