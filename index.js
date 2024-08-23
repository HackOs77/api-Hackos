const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./resources/user");
const Backend = require("./resources/backend");
const { responser, auth } = require("./utlis.js");
const config = require('./config')
const port = config.PORT || 4000;
const session = require('express-session')
const MongoStore = require('connect-mongodb-session')(session);
const requestIP = require("request-ip");

app.use(cors({
  origin: '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(responser);
app.use(requestIP.mw());
app.use(auth);
// app.use(session({
// 	secret: 'asdiashjdpiashjd',
// 	resave: false,
// 	saveUninitialized: true,
//   store: new MongoStore({
//     uri: config.MONGO_URI,
//     databaseName: 'myDb',
//     collection: 'mySessions',
//     // Change the expires key name
//     expiresKey: `_ts`,
//     // This controls the life of the document - set to same value as expires / 1000
//     expiresAfterSeconds: 60 * 60 * 24 * 14 
//   })
// }))

mongoose.connect(config.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const apiRoute = express.Router();
app.use("/v1", apiRoute);

User(apiRoute);
Backend(apiRoute);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
