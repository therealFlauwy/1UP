const steem = require("steem");
const fs = require("fs");
const History = require("./history.js");
const processTxs = require("./processTxs.js");
const Config = require("../config.js");

steem.api.setOptions({ url: 'https://api.steemit.com' });

var db;
try {
    db = require("./stateCache.json");
    History.getHistory(newState => {
        db.users = newState.users;
    });
    db.users = db.users;
} catch (e) {
    db = History.getHistory();
}
function saveDb() {
    fs.writeFile("./stateCache.json", JSON.stringify(db), () => {
    });
}
saveDb();
setInterval(saveDb, 15000);

steem.api.streamTransactions((err, op) => {
    if (err) throw err;
    op.operations.forEach(tx => {
        if (
            tx[0] === "comment" && // If there is a post
            (Config.mods.indexOf(tx[1].author) > -1) && //by a mod...
            tx[1].parent_author !== "" //replying to a post...
        ) {
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
        }
        if (
            (tx[0] === "vote") && // If there is a vote...
            (Config.mods.indexOf(tx[1].author) > -1) && // on a moderator's post...
            (Config.admins.indexOf(tx[1].voter) > -1) //from an admin...
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
    }
};