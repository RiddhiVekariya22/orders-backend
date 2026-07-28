const express = require('express');
const app = express();
app.use(express.json());

app.use('/', require('./orders/routes'));

module.exports = app;