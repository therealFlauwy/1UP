const steem = require("steem");
const processTxs = require("./processTxs.js");
const Config = require("../config.js");

module.exports.getHistory = userCallback => {
    var state = { users: {}, totalTokens: 0, pendingSends: {} };
    var current = -1;
    const callback = function(err, txs) {
        if (err) {
            if (err.toString().indexOf("RPCError: Request Timeout") > -1) {
                //retry
                steem.api.getAccountHistory(Config.bot, current, Math.min(current, 10000), callback);
                return;
            }
            throw err;
        }
        state = processTxs(txs, state);
        current = txs[0][0] - 1; //the oldest transaction's number minus 1
        console.log("Loaded transaction history up to #" + current + 1);
        if (current <= 0) {
            console.log("Got entire transaction history!");
            if (userCallback) userCallback(state);
            return;
        }
        steem.api.getAccountHistory(Config.bot, current, Math.min(current, 10000), callback);
    };
    console.log(callback);
    //we only load 1 item in case the account has less than 10000 transactions
    steem.api.getAccountHistory(Config.bot, -1, 1, callback);
    return state;
};
