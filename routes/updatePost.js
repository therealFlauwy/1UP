
var steem = require('steem');
steem.api.setOptions({ url: 'https://api.steemit.com' });
let sc2=require('sc2-sdk');
const config = require("../config");

// Initialize SteemConnect API
 let steemc = sc2.Initialize({
     //baseURL="https://steemconnect.com",
     app: config.sc2_id,
     callbackURL: config.redirect_uri,
     scope: config.scopes
 });





module.exports = function(app,steem2,Utils,config,messages){

app.get("/updatePost/:community/:url(*)", function(req, res) {

    //let url = req.params.url;
    let url = req.params.url.split( '/' );

    let category = url[3];
    let author = url[4].replace('@', '');
    let perm = url[5];

    console.log(author);


    //upload the data to the BD
    var uploadData1 = (data,tag,callback)=>{
        //Identify if the post was already saved in the database
        const posts = Parse.Object.extend("Posts");
        let query = new Parse.Query(posts);
        query.equalTo("createdIdSteemsql", data.id);
        query.find({
            success: function(postData) {
                if(postData.length>=1){
                    //if the post is save in the bd start the callback instantly
                    if(callback)
                        console.log("Post in db");
                        console.log(postData);

                        callback()
                }
                else {
                    //if the post not is save in the db created the obj parse for the post
                    var rex=/((http(s?):)([/|.|\w|\-|%|(|)])*\.(?:jpg|png|jpeg|JPG|JPEG|PNG))|((http(s?):)(.)*\/ipfs\/\w*)/;
                    let imgPost=rex.exec(data.body);
                    var img=imgPost ? imgPost[0] : "no_img";
                    var created = new Date(data.created);
                    var description = data.body;

                    const posts1=Parse.Object.extend("Posts");
                    let p=new posts1();
                    p.set("community",tag);
                    p.set("title", data.title);
                    p.set("description", Utils.extractContent(description, 200));
                    p.set("tag",data.category);
                    p.set("author",data.author);
                    p.set("permlink",data.permlink);
                    p.set("voted",false);
                    p.set("createdIdSteemsql",data.id);
                    p.set("image", img);
                    p.set("votes", 0);
                    p.set("created", created);
                    p.set("value",data.total_payout_value);
                    data.json_metadata ? p.set("tags",data.json_metadata.tags) : null;
                    
                    p.save().then((p)=>{
                        console.log("Post have been saved.");
                        if(callback)
                            callback()
                    })

                }
            }
        });

    }

    let innerTokenQuery = new Parse.Query(Parse.Object.extend("Communities"));
        innerTokenQuery.equalTo("name", req.params.community);

        innerTokenQuery.find({
            success: function(communitie) {
                const content= steem.api.getContentAsync(author, perm);
                content.then(result=> {
                    //Throw an error if this post was already voted by the bot
                    //console.log(result.id, result.title, t)
            
                    uploadData1(result, communitie[0],()=>{
                    
                            console.log("Update done");
                            res.sendStatus(200);
                        
                    })
                    
                    
                })
                
                //console.log(`community: ${t}`)
                
                    
            },error: function(error) {
                res.send(error)
            }
        });

    
});

}
