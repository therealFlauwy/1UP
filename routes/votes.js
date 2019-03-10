module.exports = function(app,steem,Utils,config,messages){
  // Receive 1UP-vote information through POST
  app.post("/vote", function(req, res) {
      Utils.getSession(req).then(function(session) {
        const Votes = Parse.Object.extend("Votes");
        let vote= new Votes();
        const Posts = Parse.Object.extend("Posts");
        let query= new Parse.Query(Posts);
        //query the post concerned
        query.get(req.body.id, {
          success: function(post) {
            if (post.length != 0){
              // Setting votes parameters
              vote.set("voter",session.name);
              vote.set("community",req.body.community);
              vote.set("post",post);
              vote.set("author",post.get("author"));
              vote.set("permlink",post.get("permlink"));
              vote.set("ua",session.ua);
              console.log(session.ua);
              // Create the vote object sent to be processed in the cloud
              vote.save().then((result) => {
                // Execute any logic that should take place after the object is saved.
                res.sendStatus(200);
              }).catch((error) => {
                // Execute any logic that should take place if the save fails.
                // error is a Parse.Error with an error code and message.
                res.status(500).send({error:error.message});
              });
            }
              else res.sendStatus(500);
            }
          });
        });
  });
}
