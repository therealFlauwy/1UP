const sql = require('mssql')
let isWorking=false;
module.exports = function(app,steem,Utils,config,messages){
    
app.get("/updatePosts/:key", function(req, res) {
//create the query for the seach
  if(isWorking) return;
  if(req.params.key!=process.env.MASTER_KEY) return;
  isWorking=true;
  function querysearch(type,users,tag,agePost){
    var stardatedate='0 and '+config.eligibleTime/3600000,
        typetag=(type=='Whitelist only' ? '=' : '!='),
        usersquey=(type=='Whitelist only' ? users.replace(/,/g,`' or author='`) : users.replace(/,/g,`' AND author!='`)),
        query=`
        select author, permlink, category, title, body, ID, created
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
        datediff(hour, created, GETUTCDATE()) between ${stardatedate}
        order by created DESC `
    return query;
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
                        uploadData(result.recordset,d)
                    }
                    else{
                        var query2=querysearch('Whitelist only',userswhitelist.toString(),tag,12)
                        //genera the second search of post if the first not did have
                        new sql.Request().query(query2, (err, result2) => {
                            if(err) console.log(err)
                            else{
                                if(result.recordset.length>=1){
                                    uploadData(result2.recordset,d)
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
                uploadData(result.recordset,d)
            }
            else{
                var query2=querysearch('Open',usersblacklist.toString(),tag,12)
                //genera the second search of post if the first not did have
                new sql.Request().query(query2, (err, result2) => {
                    if(err) console.log(err)
                    else{
                        if(result2.recordset.length>=1){
                            uploadData(result2.recordset,d)
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
                var img=imgPost ? imgPost[0] : "no_img";
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
                p.set("createdIdSteemsql",data.ID);
                p.set("image", img);
                p.set("votes", 0);
                p.set("created",data.created);
                p.save().then((p)=>{
                    if(callback)
                        callback()
                })

            }
        }
    });

}
//send the data to be upload
var uploadData =(data,community)=>{
    /*
    check if the post is already in the database
    if it is not inserted, add it to the database (send 1 post)
    */
    uploadData1(data.pop(),community,()=>{
        if(data.length>0){
            //sending the next post until all is sent
            uploadData(data,community)
        }
        else{
            console.log("All posts have been saved.");
            isWorking=false;
            res.send(200);
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
});
}
