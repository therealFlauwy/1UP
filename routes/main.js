
module.exports = function(app,steem,Utils,config,messages,sql){
  // Default page shows the list of communities
  app.get("/", function(req, res) {
      const community = Parse.Object.extend("Communities");
      const query = new Parse.Query(community);
      Utils.getSession(req).then(function(session) {
        console.log(session);
          query.limit(1000);
          query.find({
              success: function(communities) {
                  res.render("main.ejs", {
                      communities: communities,
                      session: session,
                      account: req.session.account,
                      sToken: req.cookies.access_token
                  });
              },
              error: function(error) {}
          });
      });
  });

  //require page of traild
app.get("/:id",(req,res)=>{
    //configure sqlsteem
    const configSqlSteem= {
        //info steemsql
        user: config.usersqlsteem,
        password: config.passwordsqlsteem,
        server: config.serversqlsteem, 
        database: config.databasesqlsteem,
        connectionTimeout: 300000,
        requestTimeout: 300000,
        opciones : { 
            encrypt : false //  Use esto si está en Windows Azure  
        }
    };
    const community = Parse.Object.extend("Communities");
    const query = new Parse.Query(community);
    query.equalTo("name", (req.path).substring(1,req.path.length));
    query.limit(1);
    function seaarchpost1(d,callback){
        sql.connect(configSqlSteem, (err)=>{
        if (err) console.log(err);
        
        if(d[0].get("type_community")=='Whitelist only'){
            var tag=d[0].get("tags"),
                userswhitelist=d[0].get("whitelist"),
                query=Utils.querysearch('Whitelist only',userswhitelist.toString(),tag,6)
                new sql.Request().query(query, (err, result) => {
                    if(err ) console.log(err)
                    else{
                        if(result.rowsAffected<1){
                            var query2=Utils.querysearch('Whitelist only',userswhitelist.toString(),tag,12)
                            new sql.Request().query(query2, (err, result2) => {
                                if(err) console.log(err)
                                if(callback)
                                    callback(result2)
                            })
                        }
                        else{
                            if(callback)
                                callback(result)
                        }
                    }
                })
            
        }else{
            var tag=d[0].get("tags"),
                usersblacklist=d[0].get("blacklist"),
                query=query=Utils.querysearch('Open',usersblacklist.toString(),tag,6)
            //make the connection to sqlsteem
                new sql.Request().query(query, (err, result) => {
                    if(err ) console.log(err)
                    if(result.rowsAffected<1){
                        var query2=Utils.querysearch('Open',userswhitelist.toString(),tag,12)
                        new sql.Request().query(query2, (err, result2) => {
                            if(err) console.log(err)
                            if(callback)
                                callback(result2)
                        })
                    }
                    else{
                        if(callback)
                            callback(result)
                    }
                })
        }
        })
    
    }
    query.find({
        success: function(communities) {
            seaarchpost1(communities,(data)=>{
                sql.close()
                res.send(data)
            })
        },error: function(error) {
            res.send(error)
        }
    });
})

}
