// Example express application adding the parse-server module to expose Parse
// compatible API routes.
const express = require("express");
const ParseServer = require("parse-server").ParseServer;
const path = require("path");
const favicon = require("serve-favicon");
require("dotenv").config();
const config = require("./config");
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const bodyParser = require("body-parser");
const sql = require('mssql')


//Configure Parse.js parameters
const databaseUri = config.db;
if (!databaseUri) {
    console.log("DATABASE_URI not specified, falling back to localhost.");
}
const serverURL = config.serverURL;
const api = new ParseServer({
    databaseURI: config.databaseURI,
    cloud: config.cloud,
    appId: config.appId,
    masterKey: config.masterKey,
    serverURL: serverURL + "/parse",
});
//Use Express Framework
const app = express();
app.use(bodyParser.json());

//Create sessions and cookies to keep login information from SteemConnect
app.use(expressSession({
    secret: config.secret,
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 6 * 3600 * 1000
    }
}));
app.use(cookieParser());

//Define public folder
app.use("/public", express.static(path.join(__dirname, "/public")));

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
        encrypt : false
    }
};
sql.connect(configSqlSteem, (err)=>{
    if (err) console.log(err);  
})

//Routes folder
require('./routes')(app,config);


setInterval(()=>{
    //create the query for the seach
    function querysearch(type,users,tag,agePost){

        var stardatedate=(agePost==6 ? '0 and 6*12' : '6*24 and 12*24'),
            typetag=(type=='Whitelist only' ? '=' : '!='),
            usersquey=(type=='Whitelist only' ? users.replace(/,/g,`' or author='`) : users.replace(/,/g,`' or author!='`)),
            query=`
            select author, permlink, category, title, body, ID
            from
            Comments
            WHERE        
            (    
            (ISJSON(json_metadata)>0) and
                (
                ( JSON_VALUE(json_metadata,'$.tags[4]') = ('${tag}') ) or   
                ( JSON_VALUE(json_metadata,'$.tags[3]') = ('${tag}') ) or   
                ( JSON_VALUE(json_metadata,'$.tags[2]') = ('${tag}') ) or   
                ( JSON_VALUE(json_metadata,'$.tags[1]') = ('${tag}') ) or   
                ( JSON_VALUE(json_metadata,'$.tags[0]') = ('${tag}') ) 
                )
            )AND (author${typetag}'${usersquey}') AND (parent_author='') AND 
            datediff(hour, created, GETDATE()) between ${stardatedate}
            order by created DESC `
        return query
    }
    //connect to the bd and buscar the post
    var seaarchpost1 = async (d)=>{
        if(d.get("type_community")=='Whitelist only'){
            var tag=d.get("tags"),
                userswhitelist=d.get("whitelist"),
                query=querysearch('Whitelist only',userswhitelist.toString(),tag,6)
                //genera the first search of post
                new sql.Request().query(query, (err, result) => {
                    if(err ) console.log(err)
                    else{
                        if(result.recordset.length>=1){
                            uploadData(result.recordset,tag) 
                        }
                        else{
                            var query2=querysearch('Whitelist only',userswhitelist.toString(),tag,12)
                            //genera the second search of post if the first not did have
                            new sql.Request().query(query2, (err, result2) => {
                                if(err) console.log(err)
                                else{ 
                                    if(result.recordset.length>=1){ 
                                        uploadData(result2.recordset,tag) 
                                    }
                                    else{ return null}
                                }
                            })
                        }
                    }
                })
            
        }else{
            var tag=d.get("tags"),
                usersblacklist=d.get("blacklist"),
                query=query=querysearch('Open',usersblacklist.toString(),tag,6)
            //genera the first search of post
            new sql.Request().query(query, (err, result) => {
                if(err ) console.log(err)
                if(result.recordset.length>=1){
                    uploadData(result.recordset,tag) 
                }
                else{
                    var query2=querysearch('Open',userswhitelist.toString(),tag,12)
                    //genera the second search of post if the first not did have
                    new sql.Request().query(query2, (err, result2) => {
                        if(err) console.log(err)
                        else{
                            if(result.result.recordset.length>=1){ 
                                uploadData(result2.recordset,tag)
                            }
                            else{ return null}
                        }
                    })
                    
                }
            })
        }
    }
    //upload the data to the BD
    var uploadData1 = (data,tag,callback)=>{
        //Identify if the post was already saved in the database
        const posts = Parse.Object.extend("Posts");
        let query = new Parse.Query(posts);
        query.equalTo("createdIdSteemsql", data.ID);
        query.find({
            success: function(postData) {
                if(postData.length>=1){
                    //if the post is save in the bd start the callback instantly
                    if(callback)
                        callback()  
                }
                else {
                    //if the post not is save in the db created the obj parse for the post
                    var rex=/((http(s?):)([/|.|\w|\-|%|(|)])*\.(?:jpg|png|jpeg|JPG|JPEG|PNG))|((http(s?):)(.)*\/ipfs\/\w*)/;
                    let imgPost=rex.exec(data.body);
                    var img=imgPost ? imgPost[0] : "this post not have img"
                    console.log(img)

                    const posts1=Parse.Object.extend("Posts");
                    let p=new posts1();
                    p.set("community",tag);
                    p.set("title", data.title);
                    p.set("body",data.body);
                    p.set("tag",data.category);
                    p.set("author",data.author);
                    p.set("permlink",data.permlink);
                    p.set("createdIdSteemsql",data.ID);
                    p.set("image", img);
                    p.set("votes", 0);
                    p.set("created",new Date());
                    p.save().then((p)=>{
                        console.log(`New object created with objectId: ${p.id}`)
                        if(callback)
                            callback()
                    })
                    
                }
            }
        });
        
    }
    //send the data to be upload
    var uploadData =(data,tag)=>{
        /*
        check if the post is already in the database 
        if it is not inserted, add it to the database (send 1 post)
        */
        uploadData1(data.pop(),tag,()=>{
            if(data.length>0){ 
                //sending the next post until all is sent
                uploadData(data,tag) 
            }
            else{
                console.log("all posting is has save")
                return null
            }
        })
    }
    const community = Parse.Object.extend("Communities");
    const query = new Parse.Query(community);    
    query.find({
        success: function(communities) {
            //map the comunities
            communities.map(async(t)=>{
                //search the post of comunitys and return one null if all fine
                var sl=await seaarchpost1(t)
                if(sl==null){
                    console.log(`community to review: ${t.get("name")}`)
                }
            })
        },error: function(error) {
            res.send(error)
        }
    });
},10*60*1000)

// Serve the Parse API on the /parse URL prefix
const mountPath = "/parse";
app.use(mountPath, api);

const port = config.port;
const httpServer = require("http").createServer(app);
httpServer.listen(port, function() {
    console.log("1UP running on port " + port + ".");
});
