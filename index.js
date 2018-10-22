// Example express application adding the parse-server module to expose Parse
// compatible API routes.
const express = require("express");
const ParseServer = require("parse-server").ParseServer;
const path = require("path");
const favicon = require("serve-favicon");
require("dotenv").config();
const config = require("./config");
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const bodyParser = require("body-parser");
const sql = require('mssql')


//Configure Parse.js parameters
const databaseUri = config.db;
if (!databaseUri) {
    console.log("DATABASE_URI not specified, falling back to localhost.");
}
const serverURL = config.serverURL;
const api = new ParseServer({
    databaseURI: config.databaseURI,
    cloud: config.cloud,
    appId: config.appId,
    masterKey: config.masterKey,
    serverURL: serverURL + "/parse",
});
//Use Express Framework
const app = express();
app.use(bodyParser.json());

//Create sessions and cookies to keep login information from SteemConnect
app.use(expressSession({
    secret: config.secret,
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 6 * 3600 * 1000
    }
}));
app.use(cookieParser());

//Define public folder
app.use("/public", express.static(path.join(__dirname, "/public")));

//configure sqlsteem
const configSqlSteem= {
    //info steemsql
    user: config.userSteemSQL,
    password: config.passwordSteemSQL,
    server: config.serverSteemSQL,
    database: config.databaseSteemSQL,
    connectionTimeout: 300000,
    requestTimeout: 300000,
    opciones : {
        encrypt : false
    }
};
sql.connect(configSqlSteem, (err)=>{
    if (err) console.log(err);
})

//Routes folder
require('./routes')(app,config);

// Serve the Parse API on the /parse URL prefix
const mountPath = "/parse";
app.use(mountPath, api);

const port = config.port;
const httpServer = require("http").createServer(app);
httpServer.listen(port, function() {
    console.log("1UP running on port " + port + ".");
});
