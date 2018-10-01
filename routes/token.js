const Tokens = require("../token");

module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/tokens/history", function(req, res) {
    Utils.getSession(req).then(function(session) {
      res.end(JSON.stringify(Tokens.getUserData(session.name)));
    });
  });
}
