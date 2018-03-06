let config = {
  app_id: "app-1UP",
  redirect_uri: "https://utopian-1up.com/login",
  scopes: ["login","vote"],
  db:process.env.DATABASE_URI || process.env.MONGODB_URI,
  serverURL:process.env.SERVER_URL||'http://localhost:1337',
  parseServer:{
    databaseURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
    cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
    appId: process.env.APP_ID || 'myAppId',
    masterKey: process.env.MASTER_KEY || '',
    serverURL: this.serverURL+'/parse',
  },
  port:process.env.PORT || 1337,
};

module.exports = config;