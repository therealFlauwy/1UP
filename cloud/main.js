var steem = require('steem');
var fs = require('fs');
const MAX_VOTE_PER_DAY=10;
const BOT=process.env.BOT;
steem.api.setOptions({ url: 'https://api.steemit.com' });
let sc2=require('sc2-sdk');

 let steemc = sc2.Initialize({
    app: 'steem-plus',
    callbackURL: 'https://steemit.com/@steem-plus',
    scope: ['vote']
});

function getVotingPower(acc) {
  var secondsago = (new Date - new Date(acc.last_vote_time + "Z")) / 1000;
  vpow = acc.voting_power + (10000 * secondsago / 432000);
  vpow = Math.min(vpow / 100, 100).toFixed(2);
  return vpow;
}

Parse.Cloud.job("botVote", function(request, response) {
  const WIF=process.env.WIF;
  var aPost = Parse.Object.extend("Posts");
  var query = new Parse.Query(aPost);
  var post_list=[];
  Parse.Cloud.run('checkVote', null).then(function(v){
    steem.api.getAccounts([BOT], function(err, result) {
    var vp=getVotingPower(result["0"]);
    console.log('voting power',vp);
    if(vp==100){
      query.descending("from_length");
      query.equalTo("voted",false);
      query.equalTo("voted_utopian",false);
      query.greaterThan('creationDate',new Date(new Date()-7*24*3600000));
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
            const post=posts[0];
            console.log(post.get('title'));
             console.log('Voting for', post.get('title'),' of @',post.get('author'));
             steem.broadcast.vote(WIF, BOT, post.get('author'), post.get('permlink'), 10000, function(err, result) {
  	            console.log(err, result);
                post.set('voted',true);
                post.save(null,{useMasterKey:true});
              });
             var permlink = new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
             var body = fs.readFileSync(path.resolve(__dirname, 'commentTemplate.md'));
            steem.broadcast.comment(WIF, post.get('author'), post.get('permlink'), BOT, permlink, "", body, {"app":"1up"}, function(err, result) {
              console.log(err, result);
              response.success('Vote and comment done');
            });
          }
          else
          {
            console.log('No post to vote!');
            response.error('No post to vote!');
          }

        }
        ,error:function(err){console.log(err); response.error('Something went wrong!');}
            });
      }
      else{
        console.log('Still resting!');
        response.error('Will vote later');
      }
    });
  });
});

Parse.Cloud.define("checkVote", function(request, response) {
  var aPost = Parse.Object.extend("Posts");
  var query = new Parse.Query(aPost);
  var post_list=[];
  query.descending("from_length");
  query.equalTo("voted",false);
  query.greaterThan('createdAt',new Date(new Date()-7*24*3600000));
         query.find({
          success: function(posts) {
            if(posts!==undefined&&posts.length!==0)
            {
               for ( const [i, post] of posts.entries()){
                  const content= steem.api.getContentAsync(post.get('url').split('@')[1].split('/')[0], post.get('url').split('/')[post.get('url').split('/').length-1]);
                   content.then(result=> {
                    if(post.get('creationDate')===undefined)
                    {
                      posts[i].set('creationDate',{ "__type": "Date", "iso":result.created});
                      posts[i].save(null,{useMasterKey:true});
                    }
                    if(result.active_votes.find(function (element) {
                        return element.voter == BOT;
                    })!==undefined)
                    {
                        posts[i].set('voted',true);
                        posts[i].save(null,{useMasterKey:true});
                    }
                    if(!post.get('voted_utopian')&&result.active_votes.find(function (element) {
                        return element.voter == 'utopian-io';
                    })!==undefined)
                    {
                        posts[i].set('voted_utopian',true);
                        posts[i].save(null,{useMasterKey:true});
                    }
                  });
                }
              }
            }
            ,error:function(err){console.log(err);}
          });
          response.success('yea');
});

Parse.Cloud.beforeSave('Votes', function (request, response) {
  var aPost = Parse.Object.extend("Posts");
  var aVote = Parse.Object.extend("Votes");
  const author=request.object.get('url').split('@')[1].split('/')[0];
  const perm=request.object.get('url').split('/')[request.object.get('url').split('/').length-1];
  request.object.set('author',author);
   steemc.setAccessToken(request.object.get('token'));

  steemc.me().then((me) =>{
    //console.log(me);
    request.object.unset('token');
    request.object.set('from',me.name);
  // Selfvote
  if(author===request.object.get('from'))
    response.error('You cannot vote for yourself!');
  const content= steem.api.getContentAsync(author, perm);
  content.then(result=> {
    if(result.active_votes
      .find(function (element) {
        return element.voter == BOT;})!==undefined)
          response.error('Too late! This post was already voted by the trail!');
    if(result.active_votes
      .find(function (element) {
        return element.voter == 'utopian-io';})!==undefined)
          response.error('Too late! This post was already voted by Utopian!');

    if(JSON.parse(result.json_metadata).type.includes('task'))
      response.error('Sorry! We do not accept task requests on Utopian 1UP!');
  // Check vote more than once for same user
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
              if(votes.length>=MAX_VOTE_PER_DAY)
                  response.error('You can only vote '+MAX_VOTE_PER_DAY+' times per day. Please try again tomorrow!');
            }
            response.success();
          }
          ,error:function(err){console.log(err);}
        });
      });
      // Check for bad token
    }).catch(e => response.error('We could not identify you. Please make sure you are connected via SteemConnect.'));
});


Parse.Cloud.afterSave('Votes', function (request) {

  var aPost =  Parse.Object.extend("Posts");
  var newPost = new aPost();
  newPost.set('from',[request.object.get('from')]);
  newPost.set('url',request.object.get('url'));
  newPost.save({useMasterKey:true});
});

Parse.Cloud.beforeSave('Posts', function (request, response) {
    if(request.original===undefined){
      var aPost = Parse.Object.extend("Posts");
      var query = new Parse.Query(aPost);

      query.equalTo('url',request.object.get('url'));
      query.find( {
            useMasterKey: true,
            success: function (post) {
              if(post.length===0)
              {
                const content= steem.api.getContentAsync(request.object.get('url').split('@')[1].split('/')[0], request.object.get('url').split('/')[request.object.get('url').split('/').length-1]);
                 content.then(result=> {
                   //console.log(result);
                   request.object.set('title', result.title);
                   request.object.set('author', result.author);
                   request.object.set('permlink', result.permlink);
                   request.object.set('creationDate', new Date(result.created));
                   request.object.set('reputation',steem.formatter.reputation(result.author_reputation));
                   request.object.set('voted', false);
                   request.object.set('voted_utopian', false);
                   request.object.set('from_length', 1);
                   if(JSON.parse(result.json_metadata).image!==undefined)
                    request.object.set('image', JSON.parse(result.json_metadata).image[0]);
                   else
                    request.object.set('image', '/public/assets/images/no-image.png');


                   response.success();
                     });
              }
              else
              {
                console.log(post[0].get('from'));
                var from=post[0].get('from');


                  from.push(request.object.get('from')[0]);
                    console.log(from);
                    post[0].set('from',from);
                    post[0].set('from_length',from.length);
                    post[0].set('voted', false);
                    post[0].set('voted_utopian', false);
                    post[0].set('url',post[0].get('url'));
                    post[0].set('title',post[0].get('title'));
                    post[0].set('creationDate',post[0].get('creationDate'));
                    post[0].set('image',post[0].get('image'));
                    post[0].set('author',post[0].get('author'));
                    post[0].set('permlink',post[0].get('permlink'));
                    post[0].set('reputation',post[0].get('reputation'));
                  request.object=post[0];
                  post[0].destroy({useMasterKey:true});
                  response.success();

              }
            }
            ,error:function(err){console.log(err);}
          });

        }
  else response.success();
  });
