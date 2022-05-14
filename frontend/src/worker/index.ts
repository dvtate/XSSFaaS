import Thread from './thread';


// State

/**
 * Connection to task manager
 */
let routerConnection: any = null;

/**
 * Worker threads performing tasks
 */
const threads: Thread[] = [];



async function connectToRouter() {

}

async function spawnWorkerThreads() {
    const nproc = navigator.hardwareConcurrency;
    for (let i = 0; i < nproc; i++) {
        threads.push(new Thread(i));
    }
}



async function main() {
    await spawnWorkerThreads();
    await connectToRouter();
}