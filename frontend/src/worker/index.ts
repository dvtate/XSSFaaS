

//////
// State variables
//////

/**
 * Connection to task manager
 */
let routerConnection: any = null;

/**
 * Worker threads performing tasks
 */
const workers: Worker[] = [];



async function connectToRouter() {

}

async function spawnWorkerThreads() {
    const nproc = navigator.hardwareConcurrency;
    for (let i = 0; i < nproc; i++) {

    }
}



async function main() {
    await spawnWorkerThreads();
    await connectToRouter();
}