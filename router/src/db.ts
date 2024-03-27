// Import mysql
import * as mysql from 'mysql';

// Load dotenv
import { config } from 'dotenv';
config();

// Debugger
import Debugger from 'debug';
const debug = Debugger("xss:api:db");

// Get config
const rwCred = JSON.parse(process.env.RW_DB);
const rrCred = JSON.parse(process.env.RO_DB);
const sameCredentials = rwCred === rrCred;

// Declare pools
let poolRw: mysql.Pool;
let poolRr: mysql.Pool;

/**
 * Connect to database
 */
export function begin() {
    if (sameCredentials || !rrCred) {
        debug("Connecting to '%s'", rwCred.host);
    } else {
        debug("Connecting to '%s' and '%s'", rwCred.host, rrCred.host);
    }
    if (!module.exports.connected) {
        poolRw = mysql.createPool({
            host: rwCred.host,
            user: rwCred.user,
            password: rwCred.password,
            database: rwCred.database,
            multipleStatements: true,
        });

        // read replica
        poolRr = sameCredentials || !rrCred
            ? poolRw
            : mysql.createPool({
                host: rrCred.host,
                user: rrCred.user,
                password: rrCred.password,
                database: rrCred.database,
            });

        module.exports.connected = true;
    }
}

/**
 * Send a database query
 * @param query - database query format template
 * @param params - things to fill into template
 * @param ro - can we use read-only database?
 */
export async function queryProm(query: string, params: any[] = [], ro: boolean = false): Promise<Error | any[]> {
    // Select database
    let d = ro ? poolRr : poolRw;
    return new Promise(resolve => {
        try {
            // Perform query
            d.query(query, params, (error, result) => {
                if (error) {
                    debug(error);
                    debug("Query: %s", query);
                    debug("Params: %o", params);
                    resolve(new Error(error.sqlMessage));
                } else {
                    resolve(result);
                }
            })
        } catch (error) {
            debug(error);
            if (error instanceof Error)
                return resolve(error);
            debug('wtf error not instanceof error');
            resolve(new Error(error.toString()));
        }
    });
}

/**
 * Disconnect from database
 */
export async function close() {
    new Promise(resolve =>
        poolRw.end(() =>
            poolRr.end(() => {
                module.exports.connected = false;
                resolve(undefined);
            }))
    );
}

module.exports.db = poolRw;
module.exports.rr = poolRr;