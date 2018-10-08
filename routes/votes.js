module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.post("/vote", function(req, res) {
      Utils.getSession(req).then(function(session) {
        const Votes = Parse.Object.extend("Votes");
        let vote= new Votes();
        vote.set("voter",session.name);
        vote.set("url",req.body.url);
        vote.set("community",req.body.community);
        // Create the vote object sent to be processed in the cloud
        vote.save().then((result) => {
          // Execute any logic that should take place after the object is saved.
          res.sendStatus(200);
        }, (error) => {
          console.log(error.message);
          // Execute any logic that should take place if the save fails.
          // error is a Parse.Error with an error code and message.
          res.status(500).send({error:error.message});
      });
  });
});
}
