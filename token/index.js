const steem = require("steem");
const fs = require("fs");
const History = require("./history.js");
const processTxs = require("./processTxs.js");
const Config = require("../config.js");

steem.api.setOptions({ url: 'https://api.steemit.com' });

const AdminData = Parse.Object.extend("GlobalConfig");

var db;
try {
    db = require("../stateCache.json");
    db.users  = History.getHistory(newState => {
    }).users;
} catch (e) {
    console.log("State cache not found. Loading history...");
    db = History.getHistory();
}
function saveDb() {
    fs.writeFile("./stateCache.json", JSON.stringify(db), () => {
    });
}
saveDb();
setInterval(saveDb, 15000);

function callIfUserAdmin(user, cb) {
    //calls the callback if the user is an admin
    const query = new Parse.Query(AdminData);
    query.find({success: function (adminData) {
        var admin;
        if (adminData.length === 0) {
            console.warn("No admin list found.");
            admin = false;
        } else if (adminData[0].get("mods").indexOf(user) > -1) {
            admin = true;
        } else {
            admin = false;
        }
        if (admin) {
            cb();
        }
    }, error: function (e) {
        console.log("error on admin load", e);
    }});
}

steem.api.streamTransactions((err, op) => {
    if (err) throw err;
    op.operations.forEach(tx => {
        if (
            tx[0] === "comment" && // If there is a post
            tx[1].parent_author !== "" //replying to a post...
        ) {
            callIfUserAdmin(tx[1].author, () => {
                steem.api.getContent(tx[1].author, tx[1].permlink, function(err, comment) {
                    if (err) throw err;
                    if (!comment.parent_author) {
                        console.log("@" + tx[1].author + "/" + tx[1].permlink + " tried to airdrop in a root post.");
                        return;
                    }
                    var regexMatch = /\!1upsend(\s*)((\d|\.)*)/g.exec(comment.body);
                    if (!regexMatch) return;
                    var amount = regexMatch[2];
                    if (isNaN(amount)) return;
                    var link = "@" + tx[1].author + "/" + tx[1].permlink;
                    db.pendingSends[link] = {
                        account: tx[1].parent_author,
                        amount: amount
                    };
                });
            });
        }
        if (tx[0] === "vote") {
            const query = new Parse.Query(AdminData);
            query.find({success: function (adminData) {
                var admin;
                if (adminData.length === 0) {
                    console.warn("No admin list found.");
                    admin = false;
                } else if (
                    (adminData[0].get("mods").indexOf(tx[1].author) > -1) &&
                    (adminData[0].get("admins").indexOf(tx[1].voter) > -1)
                ) {
                    var link = "@" + tx[1].author + "/" + tx[1].permlink;
                    if (!db.pendingSends[link]) {
                        db.pendingSends[link] = {
                            account: tx[1].author
                        };
                    }
                    if (tx[1].weight <= 0) return; //don't count flags
                    if (db.pendingSends[link].used) return;
                    steem.api.getContent(tx[1].author, tx[1].permlink, function(err, comment) {
                        if (err) throw err;
                        if (!comment.parent_author) {
                            console.log("@" + tx[1].author + "/" + tx[1].permlink + " tried to airdrop in a root post.");
                            return;
                        }
                        var regexMatch = /\!1upsend(\s*)((\d|\.)*)/g.exec(comment.body);
                        if (!regexMatch) return;
                        var amount = regexMatch[2];
                        if (isNaN(amount)) return;
                        db.pendingSends[link].used = true;
                        db.pendingSends[link].amount = amount;
                        steem.broadcast.customJson(Config.postingKey, [], [Config.bot], "1up", JSON.stringify({
                            account: comment.parent_author,
                            amount: parseFloat(amount, 10),
                            reason: ["modcomment", link]
                        }), (err, res) => {
                            if (err) throw err;
                        });
                    });
                }
            }, error: function (e) {
                console.log("error on admin load", e);
            }});
        }
        db = processTxs([["", { op: tx }]], db);
    });
});

module.exports = {
    getUserData: function(user) {
        return db.users[user];
    },
    allData: function() {
        return db;
    },
    pendingSends: function() {
        return db.pendingSends;
    },
    approve: function(postId) {
        if (!db.pendingSends[postId]) throw new Error("invalid post id");
        var account = db.pendingSends[postId].account;
        var amount = db.pendingSends[postId].amount;
        db.pendingSends[postId].used = true;
        steem.broadcast.customJson(Config.postingKey, [], [Config.bot], "1up", JSON.stringify({
            account: account,
            amount: amount,
            reason: ["modcomment", postId]
        }));
    },
    reject: function(postId) {
        if (!db.pendingSends[postId]) return console.error("invalid post id");
        db.pendingSends[postId].used = true;
        db.pendingSends[postId].rejected = true;
    }
};
