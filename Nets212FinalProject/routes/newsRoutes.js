/**
 * 
 */
const stemmer = require("stemmer");
const AWS = require("aws-sdk");
AWS.config.update({region:'us-east-1'});


var searchNews =  async function(request, response) {
	var docClient = new AWS.DynamoDB.DocumentClient();
	
 
    //split the sequence of keywords and parse them
    keywords = request.query.keyword.split(" ")
    keywords = keywords.filter(function(val, index) {
        return keywords.indexOf(val) == index;
    })

    for (let i = 0; i < keywords.length; i++) {
        curr = keywords[i]
        curr = curr.toLowerCase()
        curr = stemmer(curr)
        keywords[i] = curr
    }

    newset = new Set()
    results = []
    promisearray = []

    //assemble our list of promises of queries for retrieving all relevant keywords
    for (let i = 0; i < keywords.length; i++) {
        
        
        //for each keyword create a query for the inverted database for matching ted talks for keywords

        if (newset.size == 15){
            break
        }
        
        currkeyword = keywords[i]
        
        var params = {
            KeyConditionExpression: "#keyword = :keyword",
            TableName: 'NewsSearch',
            ExpressionAttributeNames: {
                "#keyword": "keyword"
            },
            ExpressionAttributeValues: {
                ":keyword": currkeyword
            },
        
        
        };
        
        let temp = []
        
        currpromise = docClient.query(params, function(err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            temp = data.Items
            for (var i = 0; i < temp.length; i++){
                if (temp[i] != undefined){
                    
    //add the ids of ted talks that match our keyword query to a set to remove duplicates
    //cap the sie of the set to 15 so we can break early
                newset.add(temp[i]["headline"])
                if(newset.size == 15){
                    break
                }
            
                }
            }
        }
        }).promise();
        
        
        promisearray.push(currpromise)
    }

    //use an await to ensure that all promises are kept
    console.log(promisearray)
    finalresults = await Promise.all(promisearray)
    console.log(newset)
    counter = 0


    //take the first 15 elements in the set or fewer if the seize of the set < 15 and add them to our results
    for (const curritem of newset) {
        if (counter == 15){
            break;
        }
        else{
            results.push(curritem)
        }
        counter = counter +1
    
    }


    otherpromisearray = []



    for (let i = 0; i < results.length; i++) {
    //loop through the array containing the ted talk ids of our queried ted talks 
    //query for data on the ted talk corresponding to each ted talk id

    var docClient = new AWS.DynamoDB.DocumentClient();
    let parsedword = results[i];
    
    var params = {
        KeyConditionExpression: "headline = :headline",
        TableName: 'News',
        ExpressionAttributeValues: {
            ":headline": parsedword
        },
    
    };
    
    
    
    console.log(finalresults) 

    actualfinalresults = new Set()


    //initialize a hashmap to prevent duplicate links from being generated
    tracker = new Map()

    currpromise = docClient.query(params, function(err, data) {
    if (err) {
        console.log("Error", err);
    } else {
        
        //query for ted talks that correspond to the given talk ids
        result = data.Items
        actualfinalresults.add(result);  	
        
    }
    }).promise();
    
    otherpromisearray.push(currpromise)
        
    }

    newfinalresults = await Promise.all(otherpromisearray)
    console.log(newfinalresults)
    console.log(actualfinalresults);

    var outputarray = Array.from(actualfinalresults)

    response.render("newssearch.ejs", {results: outputarray[0]})

 
}; 

var newsRoutes = {

	searchNews: searchNews,
}

module.exports = newsRoutes; 









