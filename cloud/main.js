var steem = require('steem');
var fs = require('fs');
const MAX_VOTE_PER_DAY=10;
const BOT=process.env.BOT;
steem.api.setOptions({ url: 'https://api.steemit.com' });
let sc2=require('sc2-sdk');
const config = require("../config");

 let steemc = sc2.Initialize({
     //baseURL="https://steemconnect.com",
     app: config.sc2_id,
     callbackURL: config.redirect_uri,
     scope: config.scopes
 });


// Before accepting 1UP-votes, perform tests
Parse.Cloud.beforeSave('Votes', function (request, response) {
  var aPost = Parse.Object.extend("Posts");
  var aVote = Parse.Object.extend("Votes");
  //Get author and permlink from URL
  const author=request.object.get('author');
  const perm=request.object.get('permlink');
  const voter=request.object.get('voter');
  const ua=request.object.get('ua').ua;
  console.log(author,perm);
  request.object.unset('ua');
  // Throw error if unsufficient UA
  if(ua<config.UA_threshold){
    response.error('Increase your User Authority to be able to cast 1UP-votes!');
  }

  // Throw error if selfvote
  if(voter==author)
    response.error('You cannot vote for yourself!');

  const content= steem.api.getContentAsync(author, perm);
  content.then(result=> {
    //Throw an error if this post was already voted by the bot
    if(result.active_votes
      .find(function (element) {
        return element.voter == BOT;})!==undefined)
          response.error('Too late! This post was already voted by the trail!');
  // Check if voter voted more than once for same user
    var query = new Parse.Query(aVote);
    query.equalTo('from',request.object.get('from'));
    query.greaterThan('createdAt',new Date(new Date()-24*3600000));
    query.find( {
          useMasterKey: true,
          success: function (votes) {
            //console.log(votes);
            if(votes.length!==0)
            {
              for (vote of votes){
                if(author===vote.get('author'))
                  response.error('You can only vote once a day for @'+author);
              }

            }
            // Check maximum votes per day
            if(votes.length>=MAX_VOTE_PER_DAY)
                response.error('You can only vote '+MAX_VOTE_PER_DAY+' times per day. Please try again tomorrow!');
            response.success();
          }
          ,error:function(err){response.error(err);}
        });
      });
  });

// After saving new 1UP-vote
Parse.Cloud.afterSave('Votes', async function (request) {
  var Post = Parse.Object.extend("Posts");
  const post= await request.object.get('post').fetch();
  let nb=post.get("votes");
  nb=((nb==undefined||nb==null)?1:nb+1);
  post.set("votes",nb);
  post.save();
});
