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
              req.session.ua=ua.result.accounts[0].ua;
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
                  console.log(error)
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
      if(req.body.id==null) community.set("lvl", 0);
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

    extractContent : function(html, length, ending) {

      str = html.replace(/<[^>]+>/g, '');
      //str = he.decode(stripedHtml);

      if (length == null) {
        length = 100;
      }
      if (ending == null) {
        ending = '...';
      }
      if (str.length > length) {
        return str.substring(0, length - ending.length) + ending;
      } else {
        return str;
      }
    },
    getVotesLeft: function(from) {

      return new Promise(function(fulfill, reject) {
        var aVote = Parse.Object.extend("Votes");
        var query = new Parse.Query(aVote);
        query.equalTo('voter', from);
        query.greaterThan('createdAt',new Date(new Date()-24*3600000));
        query.find( {
            useMasterKey: true,
            success: function (votes) {
              fulfill(10 - votes.length);
            }
            ,error:function(err){console.log(err); return reject(err);}
          });
        });


    },
    getCommunities:function(query) {

      return new Promise(function(fulfill, reject) {

        //Query the community named on the url
        query.find({
          success: function(communities) {
            // if it does not exist, return an error
            if (communities.length == 0)
              reject('no_community')
            else {
              fulfill(communities);
            }
          },
          error: function(error) {
            console.log(error);
            reject('sth_wrong');
          }
        });

      });
    },

    getPostsFromCommunity:function(community, day) {

      return new Promise(function(fulfill, reject) {

        var date1, date2;

        var today = new Date();
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);

        if(day === "yesterday") {
          date1 = today;
          date2 = new Date(today - 1*24*3600000);
        } else if (day === "today" || !day) {
          date1 = new Date();
          date2 = today;
        } else { // last x day
          date1 = new Date();
          date2 = new Date(new Date() - day*24*3600000);
        }

        console.log(date1, date2)

        let postsQuery=new Parse.Query(Parse.Object.extend("Posts"));
        postsQuery.matchesQuery("community", community);
        postsQuery.lessThan("created",date1);
        postsQuery.greaterThan("created",date2);
        postsQuery.find({
          success: function(p) {
            const sortedPosts=p.sort(function(a,b){
              if(a.get('votes')>b.get('votes'))
                return -1;
              else if(b.get('votes')>a.get('votes'))
                return 1;
              else{
                return a.get('updatedAt')-b.get('updatedAt');
              }
            });
            fulfill(sortedPosts);
          },
          error:function(error){
            reject(error);
          }
        });
      });
    },
    getVotingManaPerAccount:getVotingManaPerAccount,
    getEffectiveVestingSharesPerAccount:getEffectiveVestingSharesPerAccount
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

  let server_error = {"result": {"status": "error", "accounts": [{"ua": 0}]}};
  return rp(request_rpc)
    .then(function (result) {
      let ua = JSON.parse(result)
      if (ua.error) { console.log('UA error', ua.error); return server_error; }
      return ua;
    })
    .catch(function (err) {
      console.log('UA error', err)
      return server_error;
    });
};

var getEffectiveVestingSharesPerAccount = function(account) {
    var effective_vesting_shares = parseFloat(account.vesting_shares.replace(" VESTS", "")) +
        parseFloat(account.received_vesting_shares.replace(" VESTS", "")) -
        parseFloat(account.delegated_vesting_shares.replace(" VESTS", ""));
    return effective_vesting_shares;
};

var getMana = function(account) {
    const STEEM_VOTING_MANA_REGENERATION_SECONDS =432000;
    const estimated_max = getEffectiveVestingSharesPerAccount(account)*1000000;
    const current_mana = parseFloat(account.voting_manabar.current_mana);
    const last_update_time = account.voting_manabar.last_update_time;
    const diff_in_seconds = Math.round(Date.now()/1000-last_update_time);
    let estimated_mana = (current_mana + diff_in_seconds * estimated_max / STEEM_VOTING_MANA_REGENERATION_SECONDS);
    if (estimated_mana > estimated_max)
        estimated_mana = estimated_max;
    const estimated_pct = estimated_mana / estimated_max * 100;
    return {"current_mana": current_mana, "last_update_time": last_update_time,
            "estimated_mana": estimated_mana, "estimated_max": estimated_max, "estimated_pct": estimated_pct};
};


getVotingManaPerAccount = function(account) {
  return new Promise(function(fulfill,reject){
    const mana= getMana(account);
    fulfill(mana.estimated_pct.toFixed(2));
  });
};
