// Example express application adding the parse-server module to expose Parse
// compatible API routes.
var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var favicon = require('serve-favicon')
require('dotenv').config();
let sc2 = require('sc2-sdk');
let config = require("./config");
let cookieParser = require('cookie-parser');
var session = require('express-session');
var steemjs = require('steem');
let steem = sc2.Initialize({
    app: config.app_id,
    callbackURL: config.redirect_uri,
    scope: config.scopes
});
var databaseUri = config.db;
if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}
var serverURL=config.serverURL;
console.log(config);
var api = new ParseServer({
  databaseURI: config.databaseURI,
  cloud: config.cloud,
  appId: config.appId,
  masterKey: config.masterKey,
  serverURL: serverURL+'/parse',
});

var app = express();
app.use(session({
  secret: config.secret,
  resave: true,
  saveUninitialized : true,
  cookie: { maxAge: 6*3600*1000 }
}));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, '/public')));

app.get('/', function(req, res) {
  var community = Parse.Object.extend("Communities");
  var query = new Parse.Query(community);
  isLoggedIn(req).then(function(loggedIn){
    query.limit(1000);
    query.find({
      success: function(communities) {
        console.log(communities);
          res.render('main.ejs', {communities: communities,loggedIn:loggedIn,account:req.session.account,sToken:req.cookies.access_token});
      },error:function(error){console.log(error);}
    });
  });
});

app.get('/create', function(req, res) {
  isLoggedIn(req).then(function(loggedIn){
    res.render('create.ejs', {loggedIn:loggedIn,account:req.session.account,sToken:req.cookies.access_token});
  });
});

app.get('/login', function(req, res) {
  if (!req.query.access_token) {
          let uri = steem.getLoginURL();
          console.log(uri);
          res.redirect(uri);
      } else {
            res.cookie( 'access_token', req.query.access_token, {expire : new Date() + 24*7*3600*1000});
            res.redirect("/");
      }
});

app.get('/logout', function(req, res) {
res.clearCookie('access_token');
  req.session.destroy();
  res.redirect("/");
});
/*app.get('/new', function(req, res) {
  var post=null;
  var uPost = Parse.Object.extend("UtopianPosts");
  var query = new Parse.Query(uPost);

  isLoggedIn(req).then(function(loggedIn){
  console.log('logged in?',req.query.cat);
  query.descending("creationDate");
  query.limit(1000);
  if(req.query.cat!==undefined)
    query.equalTo("type",req.query.cat);
  else
    req.query.cat=0;
  query.find({
          success: function(posts) {
            if(posts!==undefined&&posts.length!==0)
            {
                posts=shuffle(posts);
                console.log(req.session.account);
                res.render('main.ejs', {bot:process.env.BOT,posts: posts,active:4,loggedIn:loggedIn,account:req.session.account,sToken:req.cookies.access_token,type:req.query.cat});
            }
            else
            {
              console.log('Nothing to show');
              res.render('main.ejs', {bot:process.env.BOT,posts: [],active:4,loggedIn:loggedIn, type:req.query.cat});
            }
          },error:function(error){console.log(error);}
        });
      });
  });

app.get('/now', function(req, res) {
  var post=null;
  var aPost = Parse.Object.extend("Posts");
  var query = new Parse.Query(aPost);
  isLoggedIn(req).then(function(loggedIn){
  //console.log('logged in?',loggedIn,req.session.logged_in);
  query.descending("from_length");
  query.equalTo("voted",false);
  query.greaterThan('creationDate',new Date(new Date()-7*24*3600000));
  query.equalTo("voted_utopian",false);
  query.find({
          success: function(posts) {
            if(posts!==undefined&&posts.length!==0)
            {
              posts=posts.sort(function(a,b){
                if(a.get('from_length')>b.get('from_length'))
                  return -1;
                else if(b.get('from_length')>a.get('from_length'))
                  return 1;
                else{
                  return a.get('createdAt')-b.get('createdAt');
                }
              });
                console.log(req.session.account);
                res.render('main.ejs', {bot:process.env.BOT,posts: posts,active:0,loggedIn:loggedIn,account:req.session.account,sToken:req.cookies.access_token,type:0});
            }
            else
            {
              console.log('Nothing to show');
              res.render('main.ejs', {bot:process.env.BOT,posts: [],active:0,loggedIn:loggedIn,type:0});
            }
          },error:function(error){console.log(error);}
        });
      });
  });

      app.get('/today', function(req, res) {

        var post=null;
        var aPost = Parse.Object.extend("Posts");
        var query = new Parse.Query(aPost);

        isLoggedIn(req).then(function(loggedIn){
        query.descending("from_length");
        query.equalTo("voted",true);
        query.limit(10);
        query.greaterThan('createdAt',new Date(new Date()-24*3600000));
               query.find({
                success: function(posts) {
                  if(posts!==undefined&&posts.length!==0)
                  {
                      res.render('main.ejs', {bot:process.env.BOT,posts: posts,active:1,loggedIn:loggedIn,type:0});
                  }
                  else
                  {
                    console.log('Nothing to show');
                    res.render('main.ejs', {bot:process.env.BOT,posts: [],active:1,loggedIn:loggedIn,type:0});
                  }
                },error:function(error){console.log(error);}
              });
            });
        });

        app.get('/yesterday', function(req, res) {
          var post=null;
          var aPost = Parse.Object.extend("Posts");
          var query = new Parse.Query(aPost);

          isLoggedIn(req).then(function(loggedIn){
          query.descending("from_length");
          query.equalTo("voted",true);
          query.limit(10);
          query.greaterThan('createdAt',new Date(new Date()-2*24*3600000));
          query.lessThan('createdAt',new Date(new Date()-24*3600000));
                 query.find({
                  success: function(posts) {
                    if(posts!==undefined&&posts.length!==0)
                    {
                        res.render('main.ejs', {bot:process.env.BOT,posts: posts,active:2,loggedIn:loggedIn,type:0});
                    }
                    else
                    {
                      console.log('Nothing to show');
                      res.render('main.ejs', {bot:process.env.BOT,posts: [],active:2,loggedIn:loggedIn,type:0});
                    }
                  },error:function(error){console.log(error);}
                });
              });
          });

          app.get('/alltime', function(req, res) {
            var post=null;
            var aPost = Parse.Object.extend("Posts");
            var query = new Parse.Query(aPost);

            isLoggedIn(req).then(function(loggedIn){
            query.descending("from_length");
            query.equalTo("voted",true);
            query.limit(10);
                   query.find({
                    success: function(posts) {
                      if(posts!==undefined&&posts.length!==0)
                      {
                          res.render('main.ejs', {bot:process.env.BOT,posts: posts,active:3,loggedIn:loggedIn,type:0});
                      }
                      else
                      {
                        console.log('Nothing to show');
                        res.render('main.ejs', {bot:process.env.BOT,posts: [],active:3,loggedIn:loggedIn,type:0});
                      }
                    },error:function(error){console.log(error);}
                  });
                });
            });
*/


// Serve the Parse API on the /parse URL prefix
var mountPath = '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes

function isLoggedIn(req) {
  return new Promise(function (fulfill, reject){
    if(req.session.logged_in===true)
      fulfill(true);
    else if(req.cookies.access_token!==undefined)
    {
      steem.setAccessToken(req.cookies.access_token);
      steem.me(function (err, response) {
        if(err==null){
          req.session.name=response.name;
          req.session.account=response.account;
          req.session.logged_in=true;
          fulfill(true);
        }
        else fulfill(false);
      });
    }
    else{
      fulfill(false);
    }
  });
}

// There will be a test page available on the /test path of your server url
// Remove this before launching your app

var port = config.port;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('1UP running on port ' + port + '.');
});

// This will enable the Live Query real-time server
// ParseServer.createLiveQueryServer(httpServer);

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;
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
