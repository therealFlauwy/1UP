const steem = require("steem");
const dsteem = require("dsteem");
const client = new dsteem.Client("https://api.steemit.com");
const readline = require("readline");
const Config = require("./config.js");

steem.api.setOptions({ url: 'https://api.steemit.com' });

if (process.argv.indexOf("iamreallysureiwanttodothis") === -1) {
    console.error("Running this script is dangerous. It will send UP tokens to delegators, which cannot easily be reversed.");
    console.error("It is recommended that you run this as a cron job. If you are certain you want to run this, run it like so:");
    console.error("$ node delegators.js iamreallysureiwanttodothis");
    process.exit(-1);
}
var ticker = 19;
console.log("Paying out to delegators. Stop this script if you don't want to do this.")
var tickerInterval = setInterval(() => {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stdout.write("Script will start in " + ticker.toString(10).padStart(2) + " seconds...");
    ticker--;
    if (ticker === 0) clearInterval(tickerInterval);
}, 1000);
setTimeout(() => {
    clearInterval(tickerInterval);
    console.log("\nStarting. Loading delegations...")
    loadDelegations(client, "steem-1up", () => { });
}, 20000)

var delegationTransactions = [];

function loadDelegations(client, account, callback) {
    getTransactions(client, account, -1, (dels) => {
        if (dels === []) return;
        console.log("Determined delegators. Calculating tokens they will get.");
        var total = 0;
        var totalVests = 0;
        dels.forEach(del => {
            totalVests += parseFloat(del.vestingShares.split(" ")[0], 10);
        });
        var payouts = {};
        dels.forEach(del => {
            var amount = parseFloat(
                (
                    (
                        (parseFloat(del.vestingShares.split(" ")[0], 10) / totalVests) * 200000
                    )
                ).toFixed(5)
            , 10);
            total += amount;
            payouts[del.delegator] = amount;
        });
        console.log("Determined payouts. Sending " + total + " tokens.");
        var wait = 0;
        for (var delegator in payouts) {
            let user = delegator; //as we loop over this, the value of delegator will change, but this won't
            console.log("Sending " + payouts[delegator] + " tokens to @" + delegator + "...");
            setTimeout(() => {
                steem.broadcast.customJson(Config.postingKey, [], [Config.bot], "1up", JSON.stringify({
                    account: user,
                    amount: payouts[delegator],
                    reason: ["delegation"]
                }), (err, res) => {
                    if (err) throw err;
                    console.log("Successfully sent tokens to @" + user);
                });
            }, wait * 38000);
            wait++;
        }
        console.log("Done sending tokens. Waiting for transactions to process...");
        callback(dels);
    });
}

function getTransactions(client, account, start, callback) {
    var lastTransaction = start;
    console.log('Getting history at transaction #' + (start < 0 ? 'latest' : start));
    client.database.call('get_account_history', [account, start, (start < 0) ? 10000 : Math.min(start, 10000)]).then(function(result) {
        result.reverse();
        for (var i = 0; i < result.length; i++) {
            let trans = result[i];
            var op = trans[1].op;
            if ((op[0] === 'delegate_vesting_shares') && (op[1].delegatee === account)) {
                delegationTransactions.push({ id: trans[0], data: op[1] });
            }
            // Save the ID of the last transaction that was processed.
            lastTransaction = trans[0];
        }
        if (lastTransaction > 0 && lastTransaction != start) {
            getTransactions(client, account, lastTransaction, callback);
        } else if (lastTransaction > 0) {
            console.error("Couldn't load all transactions from this node. Last loaded: " + lastTransaction);
            console.error("Exiting...");
            process.exit(-2);
            return;
        } else {
            processDelegations(callback);
        }
    }, function(err) {
        console.log('Error loading account history for delegations: ' + err);
    });
}

function processDelegations(callback) {
    var delegations = [];
    // Go through the delegation transactions from oldest to newest to find the final delegated amount from each account
    delegationTransactions.reverse();
    for (var i = 0; i < delegationTransactions.length; i++) {
        var trans = delegationTransactions[i];
        // Check if this is a new delegation or an update to an existing delegation from this account
        var delegation = delegations.find(d => d.delegator == trans.data.delegator);

        if (delegation) {
            delegation.vestingShares = trans.data.vesting_shares;
        } else {
            delegations.push({ delegator: trans.data.delegator, vestingShares: trans.data.vesting_shares });
        }
    }
    delegationTransactions = [];
    // Return a list of all delegations (and filter out any that are 0)
    if (callback) {
        callback(delegations.filter(function(d) { return parseFloat(d.vestingShares) > 0; }));
    }
}

