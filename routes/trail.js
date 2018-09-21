module.exports = function(app,steem,Utils,config,messages){
  // Create a route to link to the trail tail account
  app.get("/trail_account/:link_trail", function(req, res) {
        req.session.link_trail = req.params.link_trail;
        const community = Parse.Object.extend("Communities");
        const query = new Parse.Query(community);
        query.equalTo("link_trail", req.params.link_trail);
        query.limit(1);
        query.find({
            success: function(communities) {
                if(communities.length==1){
                    req.session.community_trail=communities[0].id;
                    // Generates the SteemConnect link if the link_trail string exists
                    res.redirect("https://steemconnect.com/oauth2/authorize?client_id="+config.sc2_id+"&redirect_uri="+config.serverURL+"/create_trail&response_type=code&scope=offline,comment,vote,comment_options,custom_json");
              }
                else {
                      res.redirect("/error/wrong_page");
                }
            }
        });
  });

  // Create a route to link all accounts that want to trail a community
  app.get("/trail/:community/:weight", function(req, res) {
    Utils.getSession(req).then(function(session) {
      Utils.hasOfflineToken(session.name).then(function(offline){
        const hasOffline=offline.has;
        const offlineToken=offline.token;
        const community = Parse.Object.extend("Communities");
        const query = new Parse.Query(community);
        query.get(req.params.community,{
            success: function(communities) {
                if(communities){
                    // Generates the SteemConnect link if we do not have the offline token of the user yet
                    if(!hasOffline){
                      req.session.community_trail=req.params.community;
                      req.session.trail_w = req.params.weight;
                      res.redirect("https://steemconnect.com/oauth2/authorize?client_id="+config.sc2_id+"&redirect_uri="+config.serverURL+"/create_trail&response_type=code&scope=offline,comment,vote,comment_options,custom_json");
                    }
                    else {
                      // Otherwise create the new trail with the existing token
                      const Trail= Parse.Object.extend("Trail");
                      let trail= new Trail();
                      trail.set("community",communities);
                      trail.set("voter",session.name);
                      trail.set("weight",req.params.weight);
                      trail.set("offline",offlineToken);
                      trail.save();
                      req.session.destroy();
                      res.redirect("/view/"+communities.get("name"));
                    }
              }
                else {
                      res.redirect("/error/wrong_page");
                }
            }
        });
      });
    });
  });

  // Create trail object and link it to the community
  app.get("/create_trail", function(req, res) {
    // Check if we got session data and token from SC2
    if(req.query.code!==undefined&&req.session.community_trail!==undefined&&(req.session.link_trail!==undefined||(req.session.trail_w!==undefined))){
    Utils.getTokenFromCode(req.query.code)
    .then((results) => {
      const community = Parse.Object.extend("Communities");
      const query = new Parse.Query(community);
        query.get(req.session.community_trail,{
        success: function(communities) {
            if(communities){
              // Create a new offline token object with SC information
              let Offline= Parse.Object.extend("OfflineTokens");
              let offline= new Offline();
              offline.set("trail_token",req.query.code);
              offline.set("access_token",results.access_token);
              offline.set("username",results.username);
              offline.set("refresh_token",results.refresh_token);
              offline.set("expires",Date.now()+7*24*3600*1000);
              offline.save().then((off)=>{
              // If the trail has been created, save the SC2 token
              // and delete the trail_token random string

              if(req.session.link_trail!==undefined&&req.session.link_trail==communities.get("link_trail")) {
                communities.unset("link_trail");
                communities.set("trail",off);
                communities.save();
              }
              // If the trail has been created as a regulard user
              else if(req.session.trail_w!==undefined)
              {
                const Trail= Parse.Object.extend("Trail");
                let trail= new Trail();
                // Create a new trail object
                trail.set("community",communities);
                trail.set("voter",req.session.name);
                trail.set("weight",req.session.trail_w);
                trail.set("offline",off)
                trail.save();
              }
              req.session.destroy();

              //Redirect to the community page view
              res.redirect("/view/"+communities.get("name"));
            });
          }
          else {
                  res.redirect("/error/wrong_page");
          }
        },
        error: function(error) {
            res.redirect("/error/sth_wrong");
        }
      });
    });

    }
    else {
      res.redirect("/error/identify");
    }
  });

  // Delete a Trail
  app.delete("/trail/:trail", function(req, res) {
    Utils.getSession(req).then(function(session) {
      var trails = Parse.Object.extend("Trail");
      var query = new Parse.Query(trails);
      query.get(req.params.trail, {
        success: function(trail) {
          if (trail== null||trail==undefined){
              res.sendStatus(400);
            }
          else {
            try{
                if(session.name==trail.get("voter")){
                  trail.destroy();
                  req.session.destroy();
                  res.sendStatus(200);
                }
                else res.sendStatus(401);
            } catch(e){
              console.log(e);
              res.sendStatus(400);
            }
          }
        },
        error: function(object, error) {
          console.log(error);
          res.sendStatus(400);
        }
      });
    });
  });

  // Patch a trail weight
  app.patch("/trail/:trail/:weight", function(req, res) {
    Utils.getSession(req).then(function(session) {
      var trails = Parse.Object.extend("Trail");
      var query = new Parse.Query(trails);
      query.get(req.params.trail, {
        success: function(trail) {
          if (trail== null||trail==undefined){
              res.sendStatus(400);
            }
          else {
            try{
                if(session.name==trail.get("voter")){
                  trail.set("weight",req.params.weight);
                  trail.save();
                  req.session.destroy();
                  res.sendStatus(200);
                }
                else res.sendStatus(401);
            } catch(e){
              console.log(e);
              res.sendStatus(400);
            }
          }
        },
        error: function(object, error) {
          console.log(error);
          res.sendStatus(400);
        }
      });
    });
  });

  //Delete a Trail Tail
  app.delete("/trail_tail/:community", function(req, res) {
    Utils.getSession(req).then(function(session) {

      var communities = Parse.Object.extend("Communities");
      var query = new Parse.Query(communities);
      query.get(req.params.community, {
        success: function(communities) {
          if (communities.length == 0){
              res.sendStatus(400);
            }
          else {
            try{
            let type_user=Utils.getTypeUser(communities,session);
              // if not an owner or admin, permission refused.
              if(type_user!=1&&!session.trail_tail.includes(communities.get("name"))){
                res.sendStatus(401);
              }
              else{
                communities.unset("trail");
                communities.set("link_trail",Utils.generateRandomString());
                communities.save();
                req.session.destroy();
                res.sendStatus(200);
              // The object was deleted successfully.
              }
            } catch(e){
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
}
