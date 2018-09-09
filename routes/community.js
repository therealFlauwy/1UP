
module.exports = function(app,steem,Utils,config,messages){

  //Launch the community creation page
  app.get("/create", function(req, res) {
      Utils.getSession(req).then(function(session) {
          if (session.loggedIn)
              res.render("create.ejs", {
                  session: session,
                  account: req.session.account,
                  sToken: req.cookies.access_token
              });
          else {
              res.redirect("error/login");
          }
      });
  });

  // Create the new community or update it
  app.post("/community", function(req, res) {
    Utils.getSession(req).then(function(session) {
      const Communities = Parse.Object.extend("Communities");
      if(req.body.id==null){
        var community = new Communities();
        Utils.PostCommunity(community,req,res);
      }
      else {
        let query = new Parse.Query(Communities);
        query.get(req.body.id, {
            success: function(community) {
              Utils.PostCommunity(community,req,res);
            },
            error: function(error) {console.log(error);}
        });
      }
    });
  });

  //Delete a Community
  app.delete("/community/:id", function(req, res) {
    Utils.getSession(req).then(function(session) {
      var communities = Parse.Object.extend("Communities");
      var query = new Parse.Query(communities);
      query.get(req.params.id, {
        success: function(communities) {
          if (communities.length == 0){
              res.sendStatus(400);
            }
          else {
            try{
            let type_user=Utils.getTypeUser(communities,session);
              // if not an owner or admin, permission refused.
              if(type_user!=1){
                res.sendStatus(401);
              }
              else{
                communities.destroy({});
                req.session.destroy();
                res.sendStatus(200);
              // The object was retrieved successfully.
              }
            } catch(e){
              console.log(e);
              res.sendStatus(400);
            }
          }
        },
        error: function(object, error) {
          res.sendStatus(400);
        }
      });
    });
  });


  // View a Community page
  app.get("/view/:name", function(req, res) {
      Utils.getSession(req).then(function(session) {
          const community = Parse.Object.extend("Communities");
          const query = new Parse.Query(community);
          query.equalTo("name", req.params.name);
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
                    // View for no trail
                    if(communities[0].get("trail")===undefined){
                        res.render("view.ejs", {
                            session: session,
                            community: communities[0],
                            serverURL:  config.serverURL,
                            trail: null
                        });
                    }
                    else { //View with a trail set
                        queryOffline.get(communities[0].get("trail").id).then((trail)=>{
                          res.render("view.ejs", {
                              session: session,
                              community: communities[0],
                              serverURL:  config.serverURL,
                              trail:trail
                          });
                        });
                    }
                  }
              },
              error: function() {
                  res.redirect("/error/sth_wrong");
              }
          });
      });
  });

  //Edit community page
  app.get("/edit/:name", function(req, res) {
    Utils.getSession(req).then(function(session) {
        const community = Parse.Object.extend("Communities");
        const query = new Parse.Query(community);
        query.equalTo("name", req.params.name);
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

                  let type_user=Utils.getTypeUser(communities[0],session);
                  // View for no trail
                  if(communities[0].get("trail")===undefined){
                      res.render("edit.ejs", {
                          session: session,
                          community: communities[0],
                          trail: null,
                          type_user:type_user
                      });
                  }
                  else { //View with a trail set
                      queryOffline.get(communities[0].get("trail").id).then((trail)=>{
                    if(type_user==-1)
                      res.redirect("/error/denied");
                    else
                      res.render("edit.ejs", {
                          session: session,
                          community: communities[0],
                          type_user:type_user,
                          trail:trail
                      });
                    });
                  }
                }
            },
            error: function() {
                res.redirect("/error/sth_wrong");
            }
        });
    }).catch(function(){
      res.redirect("/error/sth_wrong");
    });
  });
}
