const steem = require("steem");
const processTxs = require("./processTxs.js");
const Config = require("./config.json")

module.exports.getHistory = (cb) => {
    var state = { users: {}, totalTokens: 0, pendingSends: {} };
    steem.api.getAccountHistory("smitop", -1, 9999, (err, txs) => {
        if (err) throw err;
        state = processTxs(txs, state);
        if (cb) cb(state);
    });
    return state;
};
