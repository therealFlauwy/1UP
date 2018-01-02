
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.beforeSave('Suggestions', function (request, response) {
    if(request.original===undefined){
      var aSug = Parse.Object.extend("Suggestions");
      var query = new Parse.Query(aSug);
      query.equalTo('url',request.object.get('url'));
      query.find( {
            useMasterKey: true,
            success: function (sug) {
              console.log(sug);
              if(sug.length===0)
              {
                response.success();
              }
              else
              {
                console.log(sug[0].get('from'));
                var from=sug[0].get('from');
                if(from.includes(request.object.get('from')[0])){
                  response.error('You can only vote once! ');
                  return
                }
                else {

                  from.push(request.object.get('from')[0]);
                    console.log(from);
                    sug[0].set('from',from);
                    sug[0].set('from_length',from.length);
                    sug[0].set('voted', false);
                    sug[0].set('url',sug[0].get('url'));
                  request.object=sug[0];
                  sug[0].destroy({useMasterKey:true});
                  response.success();

                }
              }
            }
            ,error:function(err){console.log(err);}
          });
    }
    else response.success();
});
