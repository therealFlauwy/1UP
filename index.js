// Example express application adding the parse-server module to expose Parse
// compatible API routes.
const express = require("express");
const ParseServer = require("parse-server").ParseServer;
const path = require("path");
const favicon = require("serve-favicon")
require("dotenv").config();
const sc2 = require("sc2-sdk");
const config = require("./config");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const steemjs = require("steem");
const steem = sc2.Initialize({
    app: config.app_id,
    callbackURL: config.redirect_uri,
    scope: config.scopes
});

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

//Create sessions and cookies to keep login information from SteemConnect
app.use(session({
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

// Default page shows the list of communities
app.get("/", function(req, res) {
    const community = Parse.Object.extend("Communities");
    const query = new Parse.Query(community);
    isLoggedIn(req).then(function(loggedIn) {
        query.limit(1000);
        query.find({
            success: function(communities) {
                console.log(communities);
                res.render("main.ejs", {
                    communities: communities,
                    loggedIn: loggedIn,
                    account: req.session.account,
                    sToken: req.cookies.access_token
                });
            },
            error: function(error) {
                console.log(error);
            }
        });
    });
});

//Launch the community creation page
app.get("/create", function(req, res) {
    isLoggedIn(req).then(function(loggedIn) {
        res.render("create.ejs", {
            loggedIn: loggedIn,
            account: req.session.account,
            sToken: req.cookies.access_token
        });
    });
});

//TODO: handle creation new community
app.get("/createCommunity", function(req, res) {
    console.log(req.params.community);
});

//Login via Steemconnect
app.get("/login", function(req, res) {
    if (!req.query.access_token) {
        const uri = steem.getLoginURL();
        res.redirect(uri);
    } else {
        res.cookie("access_token", req.query.access_token, {
            expire: new Date() + 24 * 7 * 3600 * 1000
        });
        res.redirect("/");
    }
});

// Logout from Steemconnect
app.get("/logout", function(req, res) {
    res.clearCookie("access_token");
    req.session.destroy();
    res.redirect("/");
});


// Serve the Parse API on the /parse URL prefix
const mountPath = "/parse";
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes

function isLoggedIn(req) {
    return new Promise(function(fulfill, reject) {
        if (req.session.logged_in)
            fulfill(true);
        else if (req.cookies.access_token !== undefined) {
            steem.setAccessToken(req.cookies.access_token);
            steem.me(function(err, response) {
                if (err === null) {
                    req.session.name = response.name;
                    req.session.account = response.account;
                    req.session.logged_in = true;
                    fulfill(true);
                } else fulfill(false);
            });
        } else {
            fulfill(false);
        }
    });
}

// There will be a test page available on the /test path of your server url
// Remove this before launching your app

const port = config.port;
const httpServer = require("http").createServer(app);
httpServer.listen(port, function() {
    console.log("1UP running on port " + port + ".");
});

// This will enable the Live Query real-time server
// ParseServer.createLiveQueryServer(httpServer);

function shuffle(array) {
    let currentIndex = array.length,
        temporaryValue, randomIndex;
    // While there are still elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}
