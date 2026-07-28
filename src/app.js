const express = require('express');
const app = express();
app.use(express.json());

// mounted once routes.js has real handlers:
// app.use('/', require('./orders/routes'));

module.exports = app;