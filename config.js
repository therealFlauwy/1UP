let config = {
    sc2_id: "app-1up",
    sc2_secret: process.env.CLIENT_SECRET,
    redirect_uri: (process.env.SERVER_URL || 'http://localhost:1337') + '/login',
    scopes: ["login", "vote"],
    db: process.env.DATABASE_URI || process.env.MONGODB_URI,
    serverURL: process.env.SERVER_URL || 'http://localhost:1337',
    port: process.env.PORT || 1337,
    databaseURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
    cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
    appId: process.env.APP_ID || 'myAppId',
    masterKey: process.env.MASTER_KEY || '',
    secret: process.env.SECRET || '',
    bot: process.env.BOT || "steem-1up",
    memoKey:process.env.MEMO||'',
    postingKey:process.env.POSTING||'',
    memoUA:process.env.MEMO_UA||'',
    userSteemSQL: process.env.USER_STEEM_SQL || '',
    passwordSteemSQL: process.env.PASSWORD_STEEM_SQL || '',
    serverSteemSQL: process.env.SERVER_STEEM_SQL || '',
    databaseSteemSQL: process.env.DATABASE_STEEM_SQL || '',
    UA_threshold:process.env.UA_THRESHOLD||3,
    eligibleTime:6*24*3600000,
    bot:"steem-1up"
};

module.exports = config;
