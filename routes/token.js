const Tokens = require("../token");
const Config = require("../config.js");

const AdminData = Parse.Object.extend("GlobalConfig");

module.exports = function(app,steem,Utils,config,messages){
  // Posts page community
    app.get("/tokens/history", function(req, res) {
        Utils.getSession(req).then(function(session) {
            res.end(JSON.stringify(Tokens.getUserData(session.name)));
        });
    });
  app.get("/wallet", function(req, res) {
        Utils.getSession(req).then(function(session) {
            res.render("wallet.ejs", {
                tokens: Tokens.getUserData(session.name),
                session: session,
                account: req.session.account,
                sToken: req.cookies.access_token
            });
        });
  });
  app.get("/topUsers", function(req, res) {
        Utils.getSession(req).then(function(session) {
            res.render("topUsers.ejs", {
                data: Tokens.allData(),
                session: session,
                account: req.session.account,
                sToken: req.cookies.access_token
            });
        });
  });
  app.get("/admin/pending", function(req, res) {
        Utils.getSession(req).then(function(session) {
            const query = new Parse.Query(AdminData);
            console.log("Loading admin page...")
            query.find({success: function (adminData) {
                //this runs
                var admin;
                if (adminData.length === 0) {
                    console.warn("No admin list found.");
                    
                    //uncomment this to set the admins
                    setTimeout(function () {
                        console.log("updating admins...")
                        var newAdmins = new AdminData();
                        newAdmins.set("admins", ["smitop", "benhen75", "flauwy"]); 
                        newAdmins.set("mods", ["smitop", "benhen75", "flauwy"]);
                        console.log("saving new admin list")
                        newAdmins.save(null, {success: function () {
                            console.log("Updated admin list")
                        }, error: function () {
                            console.log("Couldn't update admin page")
                        }});
                    }, 5000);
                    admin = false;
                } else if (adminData[0].get("admins").indexOf(session.name) > -1) {
                    admin = true;
                } else {
                    admin = false;
                }
                if (admin) {
                    console.log("Admin page loading");
                    res.render("pendingPosts.ejs", {
                        posts: Tokens.pendingSends(),
                        session: session,
                        account: req.session.account,
                        sToken: req.cookies.access_token
                    });
                } else {
                    console.log("Admin page 403ing");
                    res.status(403);
                    res.render("403.ejs", {
                        session: session,
                        account: req.session.account,
                        sToken: req.cookies.access_token
                    });
                }
            }, error: function (e) {
                console.log("error on admin page", e);
                res.end("Error checking if admin")
            }});
        });
  });
  app.post("/admin/approve", function(req, res) {
        Utils.getSession(req).then(function(session) {
            const query = new Parse.Query(AdminData);
            console.log("Loading admin page...")
            query.find({success: function (adminData) {
                //this runs
                var admin;
                if (adminData.length === 0) {
                    console.warn("No admin list found.");
                    admin = false;
                } else if (adminData[0].get("admins").indexOf(session.name) > -1) {
                    admin = true;
                } else {
                    admin = false;
                }
                if (admin) {
                    try {
                        Tokens.approve(req.body.postId);
                    } catch (e) {
                        res.redirect("/admin/pending");
                    }
                    res.redirect("/admin/pending");
                } else {
                    res.status(403);
                    res.render("403.ejs", {
                        session: session,
                        account: req.session.account,
                        sToken: req.cookies.access_token
                    });
                }
            }, error: function (e) {
                console.log("error on admin page", e);
                res.end("Error checking if admin")
            }});
        });
  });
app.post("/admin/reject", function(req, res) {
        Utils.getSession(req).then(function(session) {
            const query = new Parse.Query(AdminData);
            console.log("Loading admin page...")
            query.find({success: function (adminData) {
                //this runs
                var admin;
                if (adminData.length === 0) {
                    console.warn("No admin list found.");
                    admin = false;
                } else if (adminData[0].get("admins").indexOf(session.name) > -1) {
                    admin = true;
                } else {
                    admin = false;
                }
                if (admin) {
                    try {
                        Tokens.reject(req.body.postId.split("reject")[1]);
                    } catch (e) {
                        return console.log(e);
                    }
                    res.redirect("/admin/pending");
                } else {
                    res.status(403);
                    res.render("403.ejs", {
                        session: session,
                        account: req.session.account,
                        sToken: req.cookies.access_token
                    });
                }
            }, error: function (e) {
                console.log("error on admin page", e);
                res.end("Error checking if admin")
            }});
        });
  });
}
