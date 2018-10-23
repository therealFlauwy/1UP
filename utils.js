const rp = require('request-promise');
var steem = require('steem');

module.exports = function(config,sc2){
  return {
    getSession:function(req) {
        return new Promise(function(fulfill, reject) {
            // If already logged in, return the session parameters
            if (req.session.logged_in){
                fulfill({loggedIn:true,account:req.session.account,name:req.session.name,communities:req.session.communities,trail_tail:req.session.trail_tail,trails:req.session.trails,ua:req.session.ua});
              }
            else if (req.cookies.access_token !== undefined) {
                // If retreiving informaiton from cookies, recreate the session.
                sc2.setAccessToken(req.cookies.access_token);
                sc2.me(async function(err, response) {
                    if (err === null){

                        const ua=await getUA(steem,config,response.name);
                        req.session.ua=JSON.parse(ua).result.accounts[0];
                        // get Account information about the user logged in
                        req.session.name = response.name;
                        req.session.account = JSON.stringify(response.account);
                        req.session.logged_in = true;

                        // get Trails followed by user
                        let trail= new Parse.Query(Parse.Object.extend("Trail"));
                        trail.equalTo("voter",response.name);
                        trail.include("community");
                        try{
                        await trail.find({
                          success: function(trails) {
                            if(trails.length==0)
                              req.session.trails=null;
                            else
                              req.session.trails=JSON.stringify(trails);
                          }
                        });
                      } catch(e){console.log(e);}

                        // get all user data
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
                        await mainQuery.find({
                          success: function(communities) {
                            // Add the relevant communities to the session. This will be used for populating the community select box.
                            if(communities.length!==0){
                              let tt= communities.filter(function(community){return community.get("trail")==undefined?false:(community.get("trail").get("username")==response.name);});
                              req.session.trail_tail=tt.length==0?null:JSON.stringify(tt.map(function(e){return e.get("name");}));
                              req.session.communities=JSON.stringify(communities);
                            }
                            else {
                              req.session.trail_tail=null;
                              req.session.communities=null;
                            }
                            fulfill({loggedIn:true,account:req.session.account,name:req.session.name,communities:req.session.communities,trail_tail:req.session.trail_tail,trails:req.session.trails,ua:req.session.ua});
                        },
                        error: function(error) {
                            fulfill({loggedIn:true,account:req.session.account,name:req.session.name,communities:null,trail_tail:null,trails:req.session.trails,ua:req.session.ua});
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
        community.set("type_community", req.body.type_community);
        community.set("administrators", req.body.administrators);
        community.set("moderators", req.body.moderators);
        community.set("whitelist", req.body.whitelist);
        community.set("blacklist", req.body.blacklist);
        community.set("owner", req.body.owner);
        community.set("link_trail",this.generateRandomString());

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
    },
    getPostsFromCommunity:function(community) {
      return new Promise(function(fulfill, reject) {
        let innerTokenQuery = new Parse.Query(Parse.Object.extend("Communities"));
        innerTokenQuery.equalTo("name", community);
        let postsQuery=new Parse.Query(Parse.Object.extend("Posts"));;
        postsQuery.matchesQuery("community", innerTokenQuery);
        postsQuery.greaterThan("created",new Date(new Date()-24*3600000));
        postsQuery.find({
          success: function(p) {
              fulfill(p);
          },
          error:function(error){
            reject(error);
          }
        });
      });
    }
  }
}

// Find UA for a given user
function getUA(steem,config,username){
  const enc_user=steem.memo.encode(config.memoKey,config.memoUA,"#"+config.bot);
  const request_rpc = {
         url:"https://steem-ua.com:5000/rpc",
         method: 'POST',
         body:JSON.stringify({
           jsonrpc: '2.0',
           method: "get_accounts",
           id:0,
           params: {"user": config.bot, "encrypted_user": enc_user, "accounts": [username]}
       })
     };
  return rp(request_rpc);
};
