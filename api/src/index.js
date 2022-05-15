// Load configs
require("dotenv").config();
require("./db").begin();

// Express server
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));
// app.set('trust proxy', 1);

// Subdomain routing middleware
app.use(require('./subdomains'));

// API routes
app.use("/api", require('./api'));

// Static pages
app.use("/", express.static("./static", { fallthrough: true }));

// Start server
const debug = require("debug")("xtie:server");
const port = process.env.PORT || 80;
if (require.main == module)
    app.listen(port, () =>
        debug("Server listening on port %d", port));