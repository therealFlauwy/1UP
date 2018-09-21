module.exports = function(app,steem,Utils,config,messages){

  //Login via Steemconnect
  app.get("/login", function(req, res) {
      if (!req.query.access_token) {
          const uri = steem.getLoginURL();
          res.redirect(uri);
      } else {
          res.cookie("access_token", req.query.access_token, {
              expire: new Date() + 24 * 7 * 3600 * 1000
          });
          res.redirect("/");
      }
  });

  // Logout from Steemconnect
  app.get("/logout", function(req, res) {
      res.clearCookie("access_token");
      req.session.destroy();
      res.redirect("/");
  });
}
