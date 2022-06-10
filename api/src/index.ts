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
import cookieParser from 'cookie-parser';
const app = express();
app.use(json());
app.use(cookieParser());

// TODO reassess if these are really needed
// import cors from 'cors';
// app.set('trust proxy', 1);
// app.use(cors({
//     origin: '*',
//     credentials: true,
//     optionSuccessStatus: 200,
// }));

// Probably better to have this hosted by 3rd party static host w/ a cdn
app.use('/', express.static('static'));

// Endpoints
import portalRouter from './portal';
app.use('/api/portal', portalRouter);
import workerRouter from './worker';
app.use('/api/worker', workerRouter);
import workRouter from './work';
app.use('/api/work', workRouter);

// Import http server stuff
import { createServer as HttpsServer } from 'https';
import { createServer as HttpServer } from 'http';
import * as fs from 'fs';

// Start http server
const httpPort = Number(process.env.PORT) || 8080;
const httpServer = HttpServer(app);
httpServer.listen(httpPort, () => debug(`http listening on port ${httpPort}.`));

// Start https server
if (process.env.SSL_KEY && process.env.SSL_CERT) {
    const httpsServer = HttpsServer({
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
    }, app);
    httpsServer.listen(443, () => debug('https listening on 443'));
}