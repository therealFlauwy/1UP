const rp = require('request-promise');

module.exports = function(config,steem){
  return {
  getSession:function(req) {
      return new Promise(function(fulfill, reject) {
          // If already logged in, return the session parameters
          if (req.session.logged_in){
              fulfill({loggedIn:true,name:req.session.name,communities:req.session.communities,trail_tail:req.session.trail_tail});
            }
          else if (req.cookies.access_token !== undefined) {
              // If retreiving informaiton from cookies, recreate the session.
              steem.setAccessToken(req.cookies.access_token);
              steem.me(function(err, response) {
                  if (err === null) {
                      // get Account information about the user logged in
                      req.session.name = response.name;
                      req.session.account = JSON.stringify(response.account);
                      req.session.logged_in = true;

                      let owner=new Parse.Query(Parse.Object.extend("Communities"));
                      let admin=new Parse.Query(Parse.Object.extend("Communities"));
                      let mod=new Parse.Query(Parse.Object.extend("Communities"));
                      let Offline = Parse.Object.extend("OfflineTokens");
                      // Add an inner query to get the communities where account is a tail trail
                      var innerTokenQuery = new Parse.Query(Offline);
                      innerTokenQuery.equalTo("username", response.name);
                      let trail_tail=new Parse.Query(Parse.Object.extend("Communities"));;
                      trail_tail.matchesQuery("trail", innerTokenQuery);
                      // query all the communities on which the user is either owner administrator or moderator.
                      owner.equalTo("owner",response.name);
                      admin.equalTo("administrators",response.name);
                      mod.equalTo("moderators",response.name);
                      let mainQuery = Parse.Query.or(owner, mod,admin,trail_tail);
                      // include pointers of element trail
                      mainQuery.include("trail");
                      mainQuery.find({
                        success: function(communities) {
                          console.log(communities);
                          // Add the relevant communities to the session. This will be used for populating the community select box.
                          if(communities.length!==0){
                            console.log("a");
                            let tt= communities.filter(function(community){return community.get("trail")==undefined?false:(community.get("trail").get("username")==response.name);});
                            req.session.trail_tail=tt.length==0?null:JSON.stringify(tt.map(function(e){return e.get("name");}));
                            req.session.communities=JSON.stringify(communities);
                          }
                          else {
                            req.session.trail_tail=null;
                            req.session.communities=null;
                          }
                          fulfill({loggedIn:true,name:req.session.name,communities:req.session.communities,trail_tail:req.session.trail_tail});
                      },
                      error: function(error) {
                          fulfill({loggedIn:true,name:req.session.name,communities:null,trail_tail:null});
                      }
                    });
                  } else fulfill({loggedIn:false});
              });
          } else {
              fulfill({loggedIn:false});
          }
      });
  },
  shuffle:function(array) {
      let currentIndex = array.length,
          temporaryValue, randomIndex;
      // While there are still elements to shuffle...
      while (0 !== currentIndex) {
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
          // And swap it with the current element.
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
      }
      return array;
  },
    getTypeUser:function(community,session){
    let type_user=-1;
    if(community.get("moderators").includes(session.name))
      type_user=0;
    if(community.get("owner")===session.name||community.get("administrators").includes(session.name))
      type_user=1;
    return type_user;
  },
  PostCommunity:function(community,req,res){

      community.set("name", req.body.name);
      community.set("description", req.body.description);
      community.set("image", req.body.image);
      community.set("tags", req.body.tags);
      community.set("max_upvote", req.body.max_upvote);
      community.set("vote_when", req.body.vote_when);
      community.set("type_community", req.body.type_community);
      community.set("administrators", req.body.administrators);
      community.set("moderators", req.body.moderators);
      community.set("whitelist", req.body.whitelist);
      community.set("blacklist", req.body.blacklist);
      community.set("owner", req.body.owner);
      community.set("link_trail",generateRandomString());

      community.save(null, {
          success: function(community) {
            try{
              res.sendStatus(200);
              req.session.destroy();
            }catch(e){
              console.log(e);
            }
          },
          error: function(community, error) {
              res.sendStatus(408);
          }
      });
  },
  hasOfflineToken:function(name){
    return new Promise(function(fulfill, reject) {
      let Offline= Parse.Object.extend("OfflineTokens");
      const query = new Parse.Query(Offline);
      query.equalTo("username", name);
      query.limit(1);
      query.find({
        success: function(offline) {
          if(offline.length==1){
            fulfill({has:true,token:offline[0]});
          }
          else fulfill({has:false,token:null});
        },
        error:function(error){
          reject(error);
        }
      });
    });
  },
  getTokenFromCode:function(code){
    return rp({
      method: "POST",
      uri: "https://steemconnect.com/api/oauth2/token",
      body: {
        response_type: "refresh",
        code: code,
        client_id: config.sc2_id,
        client_secret: config.sc2_secret,
        scope: "vote,comment,offline,custom_json,comment_options"
      },
      json: true
    })
  },
  // generate a 10 characters random string
  generateRandomString:function() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 10; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
  }
}
}
