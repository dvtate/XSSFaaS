// Load dotenv
import { config } from 'dotenv';
config();

// Connect to database
import * as db from './db';
db.begin();

import WsServer from './worker_comms/server';
import startInternalApiServer from './internal_api';

// Communicate with workers
const wsServer = new WsServer();

// Enable internal API server
// TODO eventually switch to unix sockets instead
startInternalApiServer(wsServer);

// Every second check the database for new work
setInterval(() => wsServer.getWork(), 1000);