let Parse = require('parse/node');

var aSug = Parse.Object.extend("Suggestions");
var query = new Parse.Query(aSug);
query.descending("createdAt");
      query.find({
        useMasterKey: true,
        success: function(t) {
          var threads=t;
          if(threads===undefined)
          {
            console.log(t);
          }
        }
      });
