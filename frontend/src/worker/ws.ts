import { API_SERVER_URL, ENABLE_GEO_FEATURE, ROUTER_SERVER_URL } from "../lib/globals";
import { Log, writeLog } from './logging';
import * as util from '../lib/util';

class RouterConnection {
    workerId: number;
    authToken: string;
    ws = new WebSocket(ROUTER_SERVER_URL);

    constructor() {
        this.ws.onopen = () => {
            this.authenticate()
        }
    }

    private async newWorkerId() {
        // Get some data which is important
        const ipInfo = ENABLE_GEO_FEATURE
            ? await fetch('https://ipinfo.io', { headers: { Accepts : 'application/json' }}).then(r => r.json())
            : null;

        // Request new workerId from api server
        const workerIdReq = await util.post(
            API_SERVER_URL + '/worker/enlist',
            { ncores: navigator.hardwareConcurrency, ipInfo },
        );
        if (workerIdReq.status !== 200)
            console.error('enlist request failed!', workerIdReq.status);
        writeLog(new Log(Log.Type.S_INFO, 'Connected to API server as worker ' + this.workerId));

        // Store workerId
        this.workerId = Number(workerIdReq.text);
        util.setCookie('workerId', workerIdReq.text, Infinity);
    }

    authenticate() {
        this.ws.send(`${}`)
    }
};
