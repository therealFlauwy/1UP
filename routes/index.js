var fs = require('fs');
const sc2 = require("sc2-sdk");
const messages = require("../messages");

module.exports = function(app,config){
    const steem = sc2.Initialize({
        app: config.sc2_id,
        callbackURL: config.redirect_uri,
        scope: config.scopes
    });
    const Utils=require("../utils.js")(config,steem);
    fs.readdirSync(__dirname).forEach(function(file) {
        if (file == "index.js") return;
        var name = file.substr(0, file.indexOf('.'));
        require('./' + name)(app,steem,Utils,config,messages);
    });
}
