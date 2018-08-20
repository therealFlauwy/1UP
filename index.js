// Example express application adding the parse-server module to expose Parse
// compatible API routes.
const express = require("express");
const ParseServer = require("parse-server").ParseServer;
const path = require("path");
const favicon = require("serve-favicon")
require("dotenv").config();
const sc2 = require("sc2-sdk");
const config = require("./config");
const messages = require("./messages");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const steemjs = require("steem");
const bodyParser = require("body-parser");
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
app.use(bodyParser.json());

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
                res.render("main.ejs", {
                    communities: communities,
                    loggedIn: loggedIn,
                    account: req.session.account,
                    sToken: req.cookies.access_token
                });
            },
            error: function(error) {}
        });
    });
});

//Launch the community creation page
app.get("/create", function(req, res) {
    isLoggedIn(req).then(function(loggedIn) {
        if (loggedIn)
            res.render("create.ejs", {
                loggedIn: loggedIn,
                account: req.session.account,
                sToken: req.cookies.access_token
            });
        else {
            res.redirect("error/login");
        }
    });
});

//TODO: handle creation new community
app.post("/createCommunity", function(req, res) {
    var Communities = Parse.Object.extend("Communities");
    var community = new Communities();

    community.set("name", req.body.name);
    community.set("description", req.body.description);
    community.set("image", req.body.image);
    community.set("tags", req.body.tags);
    community.set("max_upvote", req.body.max_upvote);
    community.set("vote_when", req.body.vote_when);
    community.set("type_community", req.body.type_community);
    community.set("administrators", req.body.administrators);
    community.set("moderators", req.body.moderators);
    community.set("whitelist", req.body.whitelist);
    community.set("blacklist", req.body.blacklist);
    community.set("owner", req.body.owner);
    community.set("link_trail",generateRandomString());

    community.save(null, {
        success: function(community) {
            res.sendStatus(200);
        },
        error: function(community, error) {
            res.sendStatus(408);
        }
    });
});

// View a Community page
app.get("/view/:name", function(req, res) {
    isLoggedIn(req).then(function(loggedIn) {
        const community = Parse.Object.extend("Communities");
        const query = new Parse.Query(community);
        query.equalTo("name", req.params.name);
        query.limit(1);
        query.find({
            success: function(communities) {
                if (communities.length == 0)
                    res.redirect("/error/no_community");
                else {
                    console.log(communities[0]);
                    res.render("view.ejs", {
                        loggedIn: loggedIn,
                        community: communities[0],
                        serverURL:  config.serverURL
                    })
                }
            },
            error: function() {
                res.redirect("/error/sth_wrong");
            }
        });
    });
});

// Create a route to link to the trail
app.get("/link_trail/:link_trail", function(req, res) {
  req.session.link_trail = req.params.link_trail;
  const community = Parse.Object.extend("Communities");
  const query = new Parse.Query(community);
  query.equalTo("link_trail", req.params.link_trail);
  query.limit(1);
  query.find({
      success: function(communities) {
          if(communities.length==1)
              res.redirect("https://steemconnect.com/oauth2/authorize?client_id="+config.appId+"&redirect_uri=/create_trail&response_type=code&scope=offline,comment,vote,comment_option,custom_json");
          else {
                res.redirect("/error/wrong_page");
          }
      }
  });
});


//Edit community page
app.get("/edit/:name", function(req, res) {
    //TODO : Edit Page
});

//Error page
app.get("/error/:error_message", function(req, res) {
    isLoggedIn(req).then(function(loggedIn) {
        res.render("error.ejs", {
            loggedIn: loggedIn,
            error_message: messages[req.params.error_message]
        });
    });
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

// generate a 10 characters random string
function generateRandomString() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 10; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
