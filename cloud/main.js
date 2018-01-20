var steem = require('steem');
const MAX_VOTE_PER_DAY=10;
steem.api.setOptions({ url: 'https://api.steemit.com' });
let sc2=require('sc2-sdk');

 let steemc = sc2.Initialize({
    app: 'steem-plus',
    callbackURL: 'https://steemit.com/@steem-plus',
    scope: ['vote']
});

Parse.Cloud.define("checkVote", function(request, response) {
  var aPost = Parse.Object.extend("Posts");
  var query = new Parse.Query(aPost);
  var post_list=[];
  query.descending("from_length");
  query.equalTo("voted",false);
         query.find({
          success: function(posts) {
            if(posts!==undefined&&posts.length!==0)
            {
               for ( const [i, post] of posts.entries()){
                  const content= steem.api.getContentAsync(post.get('url').split('@')[1].split('/')[0], post.get('url').split('/')[post.get('url').split('/').length-1]);
                   content.then(result=> {
                    if(result.active_votes.find(function (element) {
                        return element.voter == 'utopian-1up';
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
          });
          response.success('yea');
});

Parse.Cloud.beforeSave('Votes', function (request, response) {
  var aPost = Parse.Object.extend("Posts");
  var aVote = Parse.Object.extend("Votes");
  const author=request.object.get('url').split('@')[1].split('/')[0];
  request.object.set('author',author);
   steemc.setAccessToken(request.object.get('token'));

  steemc.me().then((me) =>{
    //console.log(me);
    request.object.unset('token');
    request.object.set('from',me.name);
  // Selfvote
  if(author===request.object.get('from'))
    response.error('You cannot vote for yourself!');

  // Check vote more than once for same user
  var query = new Parse.Query(aVote);
  query.equalTo('from',request.object.get('from'));
  query.greaterThan('createdAt',new Date(new Date()-24*3600000));
  query.find( {
        useMasterKey: true,
        success: function (votes) {
          console.log(votes);
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
                   request.object.set('title', result.title);
                   request.object.set('author', result.author);
                   request.object.set('permlink', result.permlink);
                   request.object.set('reputation',steem.formatter.reputation(result.author_reputation));
                   request.object.set('voted', false);
                   request.object.set('voted_utopian', false);
                   request.object.set('from_length', 1);

                   request.object.set('image', JSON.parse(result.json_metadata).image[0]);


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
                    post[0].set('author',post[0].get('author'));
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
