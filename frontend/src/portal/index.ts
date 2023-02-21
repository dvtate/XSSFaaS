import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

interface FunctionDBEntry {
    functionId: string;
    name: string;
    about: string;
    creationTs: number;
    preventReuse: boolean;
    optSpec: string;
    allowForeignWorkers: boolean;
}

function makeFunctionCard(f: FunctionDBEntry) {
    return `<div class="ms-card ms-border ms-inline">
        <div class="row">
            <div class="col-md-10">
                <div class="ms-card-title">
                    <h3>${f.name}</h3>
                    <span>Created ${new Date(f.creationTs).toISOString()}</span>
                </div>
                <div class="ms-card-content">
                    <p>${f.about}</p>
                    <br/>
                    <p><b>Policies:</b> Optimize ${f.preventReuse ? 'spread' : 'latency'
                    }, Prefer ${f.optSpec.toLowerCase()
                    } specs, ${f.allowForeignWorkers ? 'A' : 'Disa'}llow foreign workers.</p>
                </div>
            </div>
            <div class="ms-card-btn col-md-2">
                <a class="ms-btn ms-fullwidth ms-outline ms-primary" href="manage_function.html?id=${f.functionId}">Manage</a>
            </div>
        </div>
    </div>`;
}

interface WorkerDBEntry {
    workerId: number;
    connectTs: number;
    lastSeenTs: number;
    threads: number;
    acceptForeignWork: boolean;
    userAgent?: string;
    ip?: string;
}

function makeWorkerCard(w: WorkerDBEntry) {
    return `<div class="ms-card ms-border ms-inline">
        <div class="ms-card-title">
            <h3>Worker # ${w.workerId}</h3>
            <span>Connected: ${w.connectTs === null ? 'never' : new Date(w.connectTs).toISOString()
            } ; Disconnected: ${w.lastSeenTs === null ? 'never' : new Date(w.lastSeenTs).toISOString()
            }</span>
        </div>
        <div class="ms-card-content">
            <ul>
                <li><b>Threads:</b> ${w.threads}</li>
                <li><b>IP:</b> ${w.ip || 'not tracked'}</li>
                <li><b>User Agent:</b> ${w.userAgent || 'not tracked'}</li>
            </ul>
        </div>
    </div>`;
}

const fnList = document.getElementById('functions-list');
const workerList = document.getElementById('workers-list');

async function makeLists() {
    // Populate functions table
    util.get(API_SERVER_URL + '/portal/functions')
    .then(fr =>{
        if (fr.status === 401)
            return window.location.href = 'login.html';
        fnList.innerHTML = fr.status !== 200
            ? `Failed to get functions list: ${fr.status} : ${fr.text}`
            : JSON.parse(fr.text).map(makeFunctionCard).join('');
    });

    // Populate workers table
    util.get(API_SERVER_URL + '/portal/workers')
    .then(wr => {
        if (wr.status === 401)
            return window.location.href = 'login.html';
        if (wr.status !== 200) {
            workerList.innerHTML = `Failed to get workers list: ${wr.status} : ${wr.text}`;
        } else {
            workerList.innerHTML = JSON.parse(wr.text).map(makeWorkerCard).join('');
        }
    });
}
makeLists();

// Update worker page link to include authToken
document.getElementById('worker-page-link')
    .setAttribute('href', `../worker/?authToken=${util.getCookie('authToken')}&n=x1`);

// Make logout button work
document.getElementById('btn-log-out').onclick = () => {
    util.deleteCookie('authToken');
    window.location.href = 'login.html';
};

document.getElementById('btn-reset-tokens').onclick = () => {
    // TODO backend
    alert('Not implemented yet :(');
}