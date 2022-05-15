// Imports
const mysql = require("mysql");
const debug = require("debug")("xtie:db");

// Get config
require("dotenv").config();
const rw_cred = JSON.parse(process.env.RW_DB);
const rr_cred = JSON.parse(process.env.RO_DB);
const sameCredentials = process.env.RO_DB === process.env.RW_DB;

let pool_rw, pool_rr;

/**
 *
 */
module.exports.begin = () => {
    /* istanbul ignore next */
    if (sameCredentials || !rr_cred) {
        debug("Connecting to '%s'", rw_cred.host);
    } else {
        debug("Connecting to '%s' and '%s'", rw_cred.host, rr_cred.host);
    }
    if (!module.exports.connected) {
        pool_rw = mysql.createPool({
            host: rw_cred.host,
            user: rw_cred.user,
            password: rw_cred.password,
            database: rw_cred.database,
        });

        // read replica
        pool_rr = sameCredentials || !rr_cred
            ? pool_rw
            : mysql.createPool({
                host: rr_cred.host,
                user: rr_cred.user,
                password: rr_cred.password,
                database: rr_cred.database,
            });

        module.exports.connected = true;
    }
}

/**
 * Send a database query
 * @param {string} query - database query format template
 * @param {string[]} params - things to fill into template
 * @param {boolean} ro - can we use read-only database?
 */
module.exports.queryProm = async (query, params, ro) => {
    // debug({query, params, ro});
    let d = ro ? pool_rr : pool_rw;
    if (!params) params = [];

    return new Promise(resolve => {
        try {
            d.query(query, params, (error, result) => {
                if (error) {
                    debug(error);
                    debug("Query: %s", query);
                    debug("Params: %o", params);
                    resolve(new Error(error.sqlMessage));
                }
                else
                    resolve(result);
            })
        } catch (error) /* istanbul ignore next */ {
            debug(error);
            resolve(error);
        }
    });
}

/**
 * Disconnect from database
 */
module.exports.close = () =>
    new Promise(resolve =>
        pool_rw.end(() =>
            pool_rr.end(() => {
                module.exports.connected = false;
                resolve();
            }))
    );


module.exports.db = pool_rw;
module.exports.rr = pool_rr;
