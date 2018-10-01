const Tokens = require("../token");

module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/tokens/history", function(req, res) {
    Utils.getSession(req).then(function(session) {
      res.end(JSON.stringify(Tokens.getUserData(session.name)));
    });
  });
  app.get("/wallet", function(req, res) {
        Utils.getSession(req).then(function(session) {
            res.render("wallet.ejs", {
                tokens: Tokens.getUserData(session.name),
                session: session,
                account: req.session.account,
                sToken: req.cookies.access_token
            });
        });
  });
}
