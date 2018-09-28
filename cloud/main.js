var steem = require('steem');
var fs = require('fs');
const MAX_VOTE_PER_DAY=10;
const BOT=process.env.BOT;
steem.api.setOptions({ url: 'https://api.steemit.com' });
let sc2=require('sc2-sdk');
const messages = require("../messages");

 let steemc = sc2.Initialize({
     baseURL="https://steemconnect.com",
     app: config.sc2_id,
     callbackURL: config.redirect_uri,
     scope: config.scopes
 });
