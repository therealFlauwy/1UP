module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/landing", function(req, res) {
      Utils.getSession(req).then(function(session) {
        res.render("landing.ejs", {
            session: session,
            bot:config.bot
        });
      });
  });
}
