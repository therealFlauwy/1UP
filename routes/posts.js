module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/posts/:community/:day?", function(req, res) {
      Utils.getSession(req).then(function(session) {
          const community = Parse.Object.extend("Communities");
          const query = new Parse.Query(community);
          query.equalTo("name", req.params.community);
          console.log(req.params.community) // print 2 time, why?
          query.limit(1);
          //Query the community named on the url
          query.find({
              success: function(communities) {
                // if it does not exist, return an error
                  if (communities.length == 0)
                      res.redirect("/error/no_community");
                  else {
                    const Offline = Parse.Object.extend("OfflineTokens");
                    let queryOffline = new Parse.Query(Offline);

                    Utils.getPostsFromCommunity(query, req.params.day).then(function(posts){

                      const sortedPosts=posts.sort(function(a,b){
                        if(a.get('votes')>b.get('votes'))
                          return -1;
                        else if(b.get('votes')>a.get('votes'))
                          return 1;
                        else{
                          return a.get('updatedAt')-b.get('updatedAt');
                        }
                      }); 
                       
                      // View for no trail
                      if(communities[0].get("trail")===undefined){
                          res.render("posts.ejs", {
                              session: session,
                              community: communities[0],
                              serverURL:  config.serverURL,
                              posts: sortedPosts,
                              day: req.params.day,
                              bot:config.bot,
                              trail: null
                          });
                      }
                      else { //View with a trail set
                          queryOffline.get(communities[0].get("trail").id).then((trail)=>{
                            res.render("posts.ejs", {
                                session: session,
                                community: communities[0],
                                serverURL:  config.serverURL,
                                posts: sortedPosts,
                                day: req.params.day,
                                bot:config.bot,
                                trail:trail
                            });
                          });
                      }
                    });
                    
                  }
              },
              error: function() {
                  res.redirect("/error/sth_wrong");
              }
          });

      });
  });
}
