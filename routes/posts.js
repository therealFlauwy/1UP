module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/posts/:community", function(req, res) {
      Utils.getSession(req).then(function(session) {
        Utils.getPostsFromCommunity(req.params.community).then(function(posts){
          const sortedPosts=posts.sort(function(a,b){
              if(a.get('votes')>b.get('votes'))
                return -1;
              else if(b.get('votes')>a.get('votes'))
                return 1;
              else{
                return a.get('updatedAt')-b.get('updatedAt');
              }
            });
          res.render("posts.ejs", {
              session: session,
              posts: sortedPosts,
              community:req.params.community,
              bot:config.bot
          });
        });
      });
  });
}
