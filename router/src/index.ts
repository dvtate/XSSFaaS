// Load dotenv
import { config } from 'dotenv';
config();

// Connect to database
import * as db from './db';
db.begin();

import { WsServer } from './worker_comms';

// Communicate with workers
const wsServer = new WsServer();
