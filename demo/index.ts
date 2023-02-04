import type { TaskUtils } from '../frontend/src/worker/index.worker';

const sleep = async (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * The worker will call this default export when compiled to index.js
 * @param additionalData data that the caller passes
 * @param utils
 */
export default async function (additionalData: string, utils: TaskUtils) {
    // Some adblockers block this (as they should)
    let loc = 'the internet';
    try {
        const req = await fetch('https://ipinfo.io/json', {
            headers: { Accepts : 'application/json' },
        });
        const ipInfo = await req.json();
        loc = ipInfo.city || ipInfo.region || loc;
    } catch (e) {
        utils.log(`ERROR: ${e.message}\n${e.stack}`);
    }

    // Lets assume the caller passes something like this: '{"user":"Jerry"}'
    const args = JSON.parse(additionalData);

    // We can do some statistics about
    const timeSpentInQueue = (utils.task.startTs - utils.task.receivedTs) / 1000;

    // Write a log which can be viewed from the function portal
    utils.log(`After ${timeSpentInQueue} seconds in queue, ${args.user}, says:
        Hello from ${loc}! Thanks to worker #${utils.workerId}.`);

    await sleep(1000);

    // Spawn another one lol
    // Change the url to match the one on the manage function page
    const r = await fetch('https://xss.software/api/work/task/f7b894dd-9c64-11ed-8ec7-f0def1cd1d63?key=' + args.key, {
        method: 'POST',
        body: JSON.stringify({
            user: args.user,
            key: args.key,
        }),
    }).catch(e => utils.log(e));
    if (r.status !== 200)
        utils.log('status: ' + r.status);
}