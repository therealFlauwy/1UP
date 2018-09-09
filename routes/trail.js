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
              console.log(communities,communities.length);
                if(communities){
                    // Generates the SteemConnect link if we do not have the offline token of the user yet
                    if(!hasOffline){
                      req.session.trail_c = req.params.community;
                      req.session.trail_w = req.params.weight;
                      res.redirect("https://steemconnect.com/oauth2/authorize?client_id="+config.sc2_id+"&redirect_uri="+config.serverURL+"/create_trail&response_type=code&scope=offline,comment,vote,comment_options,custom_json");
                    }
                    else {
                      // Otherwise create the new trail with the existing token
                      const Trail= Parse.Object.extend("Trail");
                      let trail= new Trail();
                      trail.set("community",req.params.community);
                      trail.set("voter",session.name);
                      trail.set("weight",req.params.weight);
                      trail.set("offline",offlineToken);
                      trail.save();
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
    if(req.query.code!==undefined&&(req.session.link_trail!==undefined||(req.session.trail_c!==undefined&&req.session.trail_w!==undefined))){
    Utils.getTokenFromCode(req.query.code)
    .then((results) => {
      const community = Parse.Object.extend("Communities");
      const query = new Parse.Query(community);
      query.equalTo("link_trail", req.session.link_trail);
      query.limit(1);
      query.find({
        success: function(communities) {
            if(communities.length==1){
              // Create a new offline token object with SC information
              let Offline= Parse.Object.extend("OfflineTokens");
              let offline= new Offline();
              offline.set("trail_token",req.query.code);
              offline.set("access_token",results.access_token);
              offline.set("username",results.username);
              offline.set("refresh_token",results.refresh_token);
              offline.set("expires",Date.now()+7*24*3600*1000);
              offline.save().then((off)=>{
              console.log("save new");
              // If the trail has been created, save the SC2 token
              // and delete the trail_token random string

              if(req.session.link_trail!==undefined){
                communities[0].unset("link_trail");
                communities[0].set("trail",off);
                communities[0].save();
              }
              // If the trail has been created as a regulard user
              else if(req.session.trail_c!==undefined&&req.session.trail_w!==undefined)
              {
                const Trail= Parse.Object.extend("Trail");
                let trail= new Trail();
                trail.set("community",req.session.trail_c);
                trail.set("voter",req.session.name);
                trail.set("weight",req.session.trail_w);
                trail.set("offline",off)
                trail.save();
              }
              //Redirect to the community page view
              res.redirect("/view/"+communities[0].get("name"));
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
}
