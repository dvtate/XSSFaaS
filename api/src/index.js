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

// Endpoints
app.use("/portal", require('./portal'));
app.use('/worker', require('./worker'));

// Static pages
app.use("/", express.static("./static", { fallthrough: true }));

// Start server
const debug = require("debug")("xss-api:server");
const port = process.env.PORT || 80;
if (require.main == module)
    app.listen(port, () =>
        debug("Server listening on port %d", port));
