
module.exports = function(app,steem,Utils,config,messages){
  // Default page shows the list of communities
  app.get("/", function(req, res) {
      const community = Parse.Object.extend("Communities");
      const query = new Parse.Query(community);
      Utils.getSession(req).then(function(session) {
          query.limit(1000);
          query.find({
              success: function(communities) {
                  res.render("main.ejs", {
                      communities: communities,
                      session: session,
                      account: req.session.account,
                      sToken: req.cookies.access_token
                  });
              },
              error: function(error) {}
          });
      });
  });
}
