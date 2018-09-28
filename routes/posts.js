module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/posts/:community", function(req, res) {
      Utils.getSession(req).then(function(session) {
        Utils.getPostsFromCommunity(req.params.community).then(function(posts){
          res.render("posts.ejs", {
              session: session,
              posts: posts,
              active:0,
              bot:config.bot
          });
        });
      });
  });
}
