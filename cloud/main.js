
var steem = require('steem');
steem.api.setOptions({ url: 'https://api.steemit.com' });



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
                        return element.voter == 'utopian-io'||element.voter == 'utopian-1up';
                    })!==undefined)
                    {
                        posts[i].set('voted',true);
                        posts[i].save(null,{useMasterKey:true});
                    }
                  });
                }
              }
            }
          });
          response.success('yea');
});


Parse.Cloud.beforeSave('Posts', function (request, response) {
    if(request.original===undefined){
      var aPost = Parse.Object.extend("Posts");
      var query = new Parse.Query(aPost);

      query.equalTo('url',request.object.get('url'));
      query.find( {
            useMasterKey: true,
            success: function (post) {
              console.log(post);
              if(post.length===0)
              {
                const content= steem.api.getContentAsync(request.object.get('url').split('@')[1].split('/')[0], request.object.get('url').split('/')[request.object.get('url').split('/').length-1]);
                 content.then(result=> {
                   request.object.set('title', result.title);
                   request.object.set('author', result.author);
                   request.object.set('reputation',steem.formatter.reputation(result.author_reputation));

                   response.success();
                     });
              }
              else
              {
                console.log(post[0].get('from'));
                var from=post[0].get('from');
                if(from.includes(request.object.get('from')[0])){
                  response.error('You can only vote once! ');
                  return
                }
                else {

                  from.push(request.object.get('from')[0]);
                    console.log(from);
                    post[0].set('from',from);
                    post[0].set('from_length',from.length);
                    post[0].set('voted', false);
                    post[0].set('url',post[0].get('url'));
                    post[0].set('title',post[0].get('title'));
                    post[0].set('author',post[0].get('author'));
                    post[0].set('reputation',post[0].get('reputation'));
                  request.object=post[0];
                  post[0].destroy({useMasterKey:true});
                  response.success();
                }
              }
            }
            ,error:function(err){console.log(err);}
          });

}
  else response.success();
});
