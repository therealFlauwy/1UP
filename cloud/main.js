var steem = require('steem');
var fs = require('fs');
const MAX_VOTE_PER_DAY=10;
const BOT="lecaillon"
const WIF=process.env.WIF;
steem.api.setOptions({ url: 'https://api.steemit.com' });
let sc2=require('sc2-sdk');
const config = require("../config");
const Utils=require("../utils.js")(config,steem);

// Initialize SteemConnect API
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
    query.equalTo('voter', voter);
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
// Increment the number of votes
Parse.Cloud.afterSave('Votes', async function (request) {
  var Post = Parse.Object.extend("Posts");
  const post= await request.object.get('post').fetch();
  let nb=post.get("votes");
  nb=((nb==undefined||nb==null)?1:nb+1);
  post.set("votes",nb);
  post.save();
});

Parse.Cloud.job("updateOffline", async function(request, response) {
  const Offline=Parse.Object.extend("OfflineTokens");
  const offlineTokenQuery = new Parse.Query(Offline);
  const offlineTokens=await offlineTokenQuery.find();
  for (token of offlineTokens){
      const [account,rsp]=[await steem.api.getAccountsAsync([token.get("username")]),await Utils.getTokenFromCode(token.get("refresh_token"))];
      token.set("effective_vesting_shares",Utils.getEffectiveVestingSharesPerAccount(account[0]));
      token.set("access_token",rsp.access_token);
      token.set("refresh_token",rsp.refresh_token);
      token.set("expires",Date.now()+7*24*3600*1000);
      token.save();
  }
});

Parse.Cloud.job("botVote", async function(request, response) {
    const botAccount=await steem.api.getAccountsAsync([BOT]);
    const vm=await Utils.getVotingManaPerAccount(botAccount["0"]);
    console.log('Voting Mana',vm);
    if(vm==100){
      const posts=await getPostsToBeVoted();
      for (community in posts){
        await voteForCommunity(community,posts[community]);
      }
    }
    else{
      console.log('Still resting!');
      response.error('Will vote later');
    }
});

function voteForCommunity(communityId,post){
  return new Promise(async function(fulfill,reject){
    console.log(communityId,post);
    const Communities=Parse.Object.extend("Communities");
    const communityQuery = new Parse.Query(Communities);
    communityQuery.include("trail");
    const community=await communityQuery.get(communityId);
    const trailTail=community.get("trail");
    console.log(trailTail.get("username"));
    const Trail=Parse.Object.extend("Trail");
    const trailQuery = new Parse.Query(Trail);
    trailQuery.equalTo("community",community);
    trailQuery.include("offline");
    const trails=await trailQuery.find();
    console.log("trails",trails);
    fulfill();
  });
}

function getPostsToBeVoted(){
  return new Promise(async function(fulfill,reject){
    const Post = Parse.Object.extend("Posts");
    const postsQuery = new Parse.Query(Post);
    postsQuery.greaterThan("created",new Date(new Date()-config.eligibleTime));
    let posts=await postsQuery.find();
    let postsToBeVoted={};
    for (post of posts){
      const community=post.get("community").id;
      if(postsToBeVoted[community]==undefined
        ||postsToBeVoted[community].votes<post.get("votes")
        ||(postsToBeVoted[community].votes==post.get("votes")
        &&postsToBeVoted[community].updated>post.get("updatedAt"))){
          if(postsToBeVoted[community]==undefined)
            postsToBeVoted[community]={};
          postsToBeVoted[community].votes=post.get("votes");
          postsToBeVoted[community].updated=post.get("updatedAt");
          postsToBeVoted[community].author=post.get("author");
          postsToBeVoted[community].permlink=post.get("permlink");
      }
    }
    fulfill(postsToBeVoted);
  });
}
