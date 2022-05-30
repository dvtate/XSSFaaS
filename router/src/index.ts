// Load dotenv
import { config } from 'dotenv';
config();

// Connect to database
import * as db from './db';
db.begin();

import WsServer from './worker_comms/server';

// Communicate with workers
const wsServer = new WsServer();

// Every second check the database for new work
setInterval(() => wsServer.getWork(), 1000);