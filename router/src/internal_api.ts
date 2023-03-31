// Load dotenv
import { config } from 'dotenv';
config();

// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:rtr:internal_server');

// Set up express server
import express from 'express';
// import { json } from 'body-parser';
import WsServer from './worker_comms/server';

export default async function startInternalApiServer(wsServer: WsServer) {
    const app = express();
    // app.use(json());
    app.get('/stats', (_, res) => res.json(wsServer.stats()));
    const port = process.env.INTERNAL_PORT || 5538;
    app.listen(port, () => debug('Internal API listening on port %d', port) );
}
