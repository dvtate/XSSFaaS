// Load dotenv
import { config } from 'dotenv';
config();

// Connect to database
import * as db from './db';
db.begin();

// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:server');

// Set up express server
import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
const app = express();
app.use(json());
app.set('trust proxy', 1);
app.use(cors({
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}));

// Probably better to have this hosted by 3rd party static host w/ a cdn
app.use('/static', express.static('../../frontend/dist/'));

// 3rd party api endpoints
// import apiRouter from './api';
// app.use('/api/', apiRouter);

// Endpoints
import portalRouter from './portal';
app.use('/portal', portalRouter);

import workerRouter from './worker';
app.use('/worker', workerRouter);

// Start sever
const port = Number(process.env.PORT) || 8080;
app.listen(port, () => debug(`Now listening on port ${port}`));