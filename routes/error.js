module.exports = function(app,steem,Utils,config,messages){
  //Error page
  app.get("/error/:error_message", function(req, res) {
      Utils.getSession(req).then(function(session) {
          res.render("error.ejs", {
              session: session,
              error_message: messages[req.params.error_message]
          });
      });
  });
}
