module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.post("/vote", function(req, res) {
      Utils.getSession(req).then(function(session) {
        console.log(req.params,session);
        res.sendStatus(200);
      });
  });
}
