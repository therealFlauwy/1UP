module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
  app.get("/posts/:community/:day?", function(req, res) {

    const community = Parse.Object.extend("Communities");
    const query = new Parse.Query(community);
    query.equalTo("name", req.params.community);
    query.limit(1);

    const session_promise = Utils.getSession(req).then(function(session){
      return session;
    }).catch((err) => {
      res.redirect("/error/" + err)
      console.log(err)
    });
    
    const posts_promise = Utils.getPostsFromCommunity(query, req.params.day).then(function(posts){
      return posts;
    }).catch((err) => {
      res.redirect("/error/" + err)
      console.log(err)
    });

    const community_promise = Utils.getCommunities(query).then(function(result){
      return result[0];
    }).catch((err) => {
      res.redirect("/error/" + err)
    });
    

    Promise.all([session_promise, community_promise, posts_promise])
    .then((data) => {
      
      if(data[0].name) return Utils.getVotesLeft(data[0].name).then(function(votes){
        data.push(votes);
        return data;
      }).catch((err) => {
        data.push(0);
        return data;
      });
      else {
        data.push(0);
        return data;
      }

      //return data;


    })
    .then((data) => {
      
      // View for no trail
      if(data[1].get("trail")===undefined){
        res.render("posts.ejs", {
            session: data[0],
            community: data[1],
            serverURL: config.serverURL,
            posts: data[2],
            votes: data[3],
            day: req.params.day,
            bot:config.bot,
            trail: null
        });
      }
      else { //View with a trail set
        const Offline = Parse.Object.extend("OfflineTokens");
        let queryOffline = new Parse.Query(Offline);

        queryOffline.get(data[1].get("trail").id).then((trail)=>{
          res.render("posts.ejs", {
              session: data[0],
              community: data[1],
              serverURL:  config.serverURL,
              posts: data[2],
              votes: data[3],
              day: req.params.day,
              bot:config.bot,
              trail:trail
          });
        });
      }

    })
    .catch(err => console.error('There was a problem', err));

  });
}
