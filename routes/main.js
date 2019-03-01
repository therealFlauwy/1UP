
module.exports = function(app,steem,Utils,config,messages){
    // Default page shows the list of communities
    app.get("/", function(req, res) {
        
        const community = Parse.Object.extend("Communities");
        const query = new Parse.Query(community);
        query.limit(1000);

        const session_promise = Utils.getSession(req).then(function(session){
            return session;
        }).catch((err) => {
            res.redirect("/error/" + err)
        });

        const community_promise = Utils.getCommunities(query).then(function(result){
            return result;
        }).catch((err) => {
            res.redirect("/error/" + err)
        });

        Promise.all([session_promise, community_promise]).then((data) => {

            res.render("main.ejs", {
                communities: data[1],
                session: data[0],
                account: req.session.account,
                sToken: req.cookies.access_token
            });

        }).catch(err => console.error('There was a problem', err));

    });
}
