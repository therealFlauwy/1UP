// Example express application adding the parse-server module to expose Parse
// compatible API routes.
const express = require("express");
const ParseServer = require("parse-server").ParseServer;
const path = require("path");
const favicon = require("serve-favicon");
require("dotenv").config();
const sc2 = require("sc2-sdk");
const config = require("./config");
const messages = require("./messages");
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const steemjs = require("steem");
const bodyParser = require("body-parser");
const rp = require('request-promise');
const steem = sc2.Initialize({
    app: config.sc2_id,
    callbackURL: config.redirect_uri,
    scope: config.scopes
});
const utils=require("./utils.js");

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

// Default page shows the list of communities
app.get("/", function(req, res) {
    const community = Parse.Object.extend("Communities");
    const query = new Parse.Query(community);
    utils.getSession(req).then(function(session) {
        query.limit(1000);
        query.find({
            success: function(communities) {
                res.render("main.ejs", {
                    communities: communities,
                    session: session,
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
    utils.getSession(req).then(function(session) {
        if (session.loggedIn)
            res.render("create.ejs", {
                session: session,
                account: req.session.account,
                sToken: req.cookies.access_token
            });
        else {
            res.redirect("error/login");
        }
    });
});

// Create the new community or update it
app.post("/community", function(req, res) {
  utils.getSession(req).then(function(session) {
    const Communities = Parse.Object.extend("Communities");
    if(req.body.id==null){
      var community = new Communities();
      utils.PostCommunity(community,req,res);
    }
    else {
      let query = new Parse.Query(Communities);
      query.get(req.body.id, {
          success: function(community) {
            utils.PostCommunity(community,req,res);
          },
          error: function(error) {console.log(error);}
      });
    }
  });
});

//Delete a Community
app.delete("/community/:id", function(req, res) {
  utils.getSession(req).then(function(session) {
    var communities = Parse.Object.extend("Communities");
    var query = new Parse.Query(communities);
    query.get(req.params.id, {
      success: function(communities) {
        if (communities.length == 0){
            res.sendStatus(400);
          }
        else {
          try{
          let type_user=utils.getTypeUser(communities,session);
            // if not an owner or admin, permission refused.
            if(type_user!=1){
              res.sendStatus(401);
            }
            else{
              communities.destroy({});
              req.session.destroy();
              res.sendStatus(200);
            // The object was retrieved successfully.
            }
          } catch(e){
            console.log(e);
            res.sendStatus(400);
          }
        }
      },
      error: function(object, error) {
        res.sendStatus(400);
      }
    });
  });
});


// View a Community page
app.get("/view/:name", function(req, res) {
    utils.getSession(req).then(function(session) {
        const community = Parse.Object.extend("Communities");
        const query = new Parse.Query(community);
        query.equalTo("name", req.params.name);
        query.limit(1);
        //Query the community named on the url
        query.find({
            success: function(communities) {
              // if it does not exist, return an error
                if (communities.length == 0)
                    res.redirect("/error/no_community");
                else {
                  const Trails = Parse.Object.extend("Trails");
                  let queryTrail = new Parse.Query(Trails);
                  // View for no trail
                  if(communities[0].get("trail")===undefined){
                      res.render("view.ejs", {
                          session: session,
                          community: communities[0],
                          serverURL:  config.serverURL,
                          trail: null
                      });
                  }
                  else { //View with a trail set
                      queryTrail.get(communities[0].get("trail").id).then((trail)=>{
                        res.render("view.ejs", {
                            session: session,
                            community: communities[0],
                            serverURL:  config.serverURL,
                            trail:trail
                        });
                      });
                  }
                }
            },
            error: function() {
                res.redirect("/error/sth_wrong");
            }
        });
    });
});

// Create a route to link to the trail tail account
app.get("/trail_account/:link_trail", function(req, res) {
  utils.getSession(req).then(function(session) {
    hasOfflineToken(session.name).then(function(offlineToken){
      req.session.link_trail = req.params.link_trail;
      const community = Parse.Object.extend("Communities");
      const query = new Parse.Query(community);
      query.equalTo("link_trail", req.params.link_trail);
      query.limit(1);
      query.find({
          success: function(communities) {
              if(communities.length==1){
                  // Generates the SteemConnect link if the link_trail string exists
                  res.redirect("https://steemconnect.com/oauth2/authorize?client_id="+config.sc2_id+"&redirect_uri="+config.serverURL+"/create_trail&response_type=code&scope=offline,comment,vote,comment_options,custom_json");
            }
              else {
                    res.redirect("/error/wrong_page");
              }
          }
      });
    });
  });
});

// Create a route to link all accounts that want to trail a community
app.get("/trail/:community", function(req, res) {
  req.session.trail = req.params.community;
  const community = Parse.Object.extend("Communities");
  const query = new Parse.Query(community);
  query.equalTo("id", req.params.community);
  query.limit(1);
  query.find({
      success: function(communities) {
          if(communities.length==1){
              // Generates the SteemConnect link if the link_trail string exists
              res.redirect("https://steemconnect.com/oauth2/authorize?client_id="+config.sc2_id+"&redirect_uri="+config.serverURL+"/create_trail&response_type=code&scope=offline,comment,vote,comment_options,custom_json");
        }
          else {
                res.redirect("/error/wrong_page");
          }
      }
  });
});

// Create trail object and link it to the community
app.get("/create_trail", function(req, res) {
  // Check if we got session data and token from SC2
  if(req.query.code!==undefined&&req.session.link_trail!==undefined){

  return rp({
    method: "POST",
    uri: "https://steemconnect.com/api/oauth2/token",
    body: {
      response_type: "refresh",
      code: req.query.code,
      client_id: config.sc2_id,
      client_secret: config.sc2_secret,
      scope: "vote,comment,offline,custom_json,comment_options"
    },
    json: true
  })
  .then((results) => {
    const community = Parse.Object.extend("Communities");
    const query = new Parse.Query(community);
    query.equalTo("link_trail", req.session.link_trail);
    query.limit(1);
    query.find({
      success: function(communities) {
          if(communities.length==1){
            // Create a new offline token object with SC information
            let Offline= Parse.Object.extend("OfflineTokens");
            let offline= new Offline();
            offline.set("trail_token",req.query.code);
            offline.set("access_token",results.access_token);
            offline.set("username",results.username);
            offline.set("refresh_token",results.refresh_token);
            offline.set("expires",Date.now()+7*24*3600*1000);
            offline.save().then((off)=>{

            // If the trail has been created, save the SC2 token
            // and delete the trail_token random string
            communities[0].unset("link_trail");
            communities[0].set("trail",off);
            communities[0].save();
            //Redirect to the community page view
            res.redirect("/view/"+communities[0].get("name"));
          });
        }
        else {
                res.redirect("/error/wrong_page");
        }
      },
      error: function(error) {
          res.redirect("/error/sth_wrong");
      }
    });
  });

  }
  else {
    res.redirect("/error/identify");
  }
});


//Edit community page
app.get("/edit/:name", function(req, res) {
  utils.getSession(req).then(function(session) {
      const community = Parse.Object.extend("Communities");
      const query = new Parse.Query(community);
      query.equalTo("name", req.params.name);
      query.limit(1);
      //Query the community named on the url
      query.find({
          success: function(communities) {
            // if it does not exist, return an error
              if (communities.length == 0)
                  res.redirect("/error/no_community");
              else {
                let type_user=utils.getTypeUser(communities[0],session);
                  if(type_user==-1)
                    res.redirect("/error/denied");
                  else
                    res.render("edit.ejs", {
                        session: session,
                        community: communities[0],
                        type_user:type_user
                    });
                }
          },
          error: function() {
              res.redirect("/error/sth_wrong");
          }
      });
  });
});

//Error page
app.get("/error/:error_message", function(req, res) {
    utils.getSession(req).then(function(session) {
        res.render("error.ejs", {
            session: session,
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

const port = config.port;
const httpServer = require("http").createServer(app);
httpServer.listen(port, function() {
    console.log("1UP running on port " + port + ".");
});
