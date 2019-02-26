module.exports = (txs, state) => {
    txs.forEach(tx => {
        const op = tx[1].op;
        if (op[0] !== "custom_json") return;
        if (op[1].id !== "1up") return;
        var json = JSON.parse(op[1].json);
        json.amount = json.amount ? parseFloat(json.amount, 10) : 0;
        console.log(json);
        //if we don't have any data for this user, set them to 0 tokens
        if (!state.users[json.account]) {
            state.users[json.account] = {
                tokens: 0,
                history: []
            };
        }
        state.users[json.account].history.push(json)
        state.users[json.account].tokens += json.amount;
        state.totalTokens += json.amount;
        if (
            json.reason &&
            json.reason[0] &&
            (json.reason[0] === "modcomment") &&
            json.reason[1]
        ) {
            console.log("Detected moderator comment approval!")
            if (!state.pendingSends[json.reason[1]]) {
                state.pendingSends[json.reason[1]] = {
                    account: json.account,
                    amount: json.amount
                }
            }
            state.pendingSends[json.reason[1]].used = true;
        }
    });
    return state;
};
