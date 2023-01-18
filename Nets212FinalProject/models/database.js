var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
const { v4: uuidv4 } = require('uuid');
var SHA3 = require('crypto-js/sha3');
const { map } = require('async');

/**
* use distinct user id to get the password from the Account database
* @param {String} username passed in from the routes.js
* @param {Function} callback a callback function to routes.js 
 */
var checkLogin = function(username, password, callback) {
	getUserID(username, function(err, userID) {
		if(err) {
			console.log("GETUSERID ERROR", err)
			callback(err, null)
		} else if (!userID) { //username doesn't exist
			console.log('username doesnt exist')
			callback(err, null)
		} else {
			var hashedPassword = SHA3(password).toString();
			var params = {
				Key: {
					"userID": {
						"S": userID
					}
				},
				TableName: "Accounts",
				AttributesToGet: [ 'password' ]
			}
			db.getItem(params, function(err, data) {
				if (err) {
					callback(err, null)
				} else if (!data.Item || data.Item.password.S != hashedPassword) { // username does not exist or invalid password
					console.log('wrong password')
					console.log(hashedPassword);
					callback(err, null)
				} else { 
					callback(err, data.Item.password.S)
				}
			})
		}
	})
	
	
}

/**
Responsible for: 
1. `
 */
var addUser = function(username, fname, lname, email, password, affiliation, birthday, callback) {
	// generate unique user id
	var uid = uuidv4();
	var hashedPassword = SHA3(password).toString();
	getUserID(username, function(err, data) {
		
		if (err) {
			console.log("CHECK USERNAME ERROR: ", err);
		} else if (data) { // username already exists
			console.log("Data is ", data)
			callback(err, data);
		} else { // username does not exist, add them into the database
			var params = {
				TableName: "Accounts",
				Item: {
					'userID': {S: uid},
					'firstName': {S: fname},
					'lastName': {S: lname},
					'email': {S: email},
					'password': {S: hashedPassword},
					'affiliation': {S: affiliation},
					'birthday': {S: birthday},
					'username': {S: username}
				}
			}
			
			// TODO: deal with error
			db.putItem(params, function(err, data) {
				
				// add the username to the username -> id table
				db.putItem({TableName: "Usernames",Item: {'username': {S: username}, 'userID': {S: uid}}}, function(err, data) {
					// callback(err, null);
				})
				
				// 
				async function performAction() {
					// make array from 1, 2, 3, ..., username length
					const myArray = Array.from({length: username.length}, (_, i) => i + 1);
					
					// add the username prefixes into the prefix table
					for (const index of myArray) {
						
						await updateItemBasedOnUserName(username, index, uid)
					}
				}
				performAction();					
			})
			callback(err, data)
		}
	})
}

// return a promise 
async function getUserIDsFromPrefix(myPrefix) {
	console.log("reachedlol")
	var params = {
		TableName: "Prefix",
		Key: {
			'prefix' : {
				"S": myPrefix
			} 
		},
		AttributesToGet: ['userIDs']
	}
	
	await doThis(params);
	
}
	
//Update account information, create status update if affiliation is changed
var updateAccount = function(oldUsername, oldPassword, uid, username, email, password, affiliation, callback) {
	// if no input was made, then just make the old password the new password
	if (password == "") {
		password = oldPassword;
	} else { // hash the new password
		password = SHA3(password).toString();
	}
	// retrieve unique user id, proceed only if the user already exists
	getUserID(oldUsername, function(err, data) {
		if (err) {
			console.log("CHECK USERNAME ERROR: ", err);
		} else if (data) { // old username exists
			getUserID(username, function(err, data) {
				if (err) {
					console.log(err);
				} else if (data && oldUsername != username) { //New username already in use
					console.log("New username already in use ", data)
					callback(err);
				} else {
					console.log("New username is valid");
					var params = { //New username not is use, proceed
						TableName: "Accounts",
						Key: {
							userID: {S: uid},
						},
						UpdateExpression: 'set username = :un, email = :em, password = :pw, affiliation = :af',
						ExpressionAttributeValues: {
							':un': {S: username},
							':em': {S: email},
							':pw': {S: password}, 
							':af': {S: affiliation}
						}
					}
					//Update the item in the accounts table
					db.updateItem(params, function(err, data) {
						if (err) {
							callback(err);
						} else {
							//if the username was changed, then also update the usernames table
							if (oldUsername != username) {
								var params2 = {
									TableName: "Usernames",
									Key: {
										username: {S: oldUsername},
									}
								}
								//delete old entry
								db.deleteItem(params2, function(err, dataa) {
									if (err) {
										callback(err);
									} else {
										// add the username to the username -> id table
										db.putItem({TableName: "Usernames",Item: {'username': {S: username}, 'userID': {S: uid}}}, function(err, data) {
											console.log("Successfully updated username");
											callback(null, dataa);
										});
									}
								});
							} else {
								console.log("Succesfully updated user information");
								callback(null, data);
							}
						}
					})
				}
			})
		} else {
			console.log("user doesn't exist, please create account first")
		}
	})
}



	
async function doThis(params) {
	db.getItem(params, function(err, data) {
	console.log("yooooooo")
	if (err) {
		console.log("i was here")
		return {err: true, data: null}
	} else if (data.Item) {
		console.log("i was here1")
		return {err: false, data: data.Item.userIDs}
	} else {
		console.log("i was here2")
		return {err: false, data: null}
	}
	})
}
	


async function updateItemBasedOnUserName(username, index, uid) {
	
	var myPrefix = username.substring(0, index).toLowerCase()
	
	// check for the result 
	let result = getUserIDsFromPrefix(myPrefix);
	
	
	if (result.err) {
		console.log("database/updateItemBasedOnUserName/" + err);
	} else { // prefix exists or not doens't really matter lol 
		var prefixParams = {
			TableName: "Prefix",
			// getItem with key as a prefix of the string. 
			Key: {
				'prefix': {S: myPrefix}
			},
			UpdateExpression: "ADD userIDs :u",
			ExpressionAttributeValues: {
				":u": {
					"SS": [uid]
				}
			},
			ReturnValues: "ALL_NEW"
		}
		let b = await pleaseUpdateItem(prefixParams)
		async function pleaseUpdateItem(prefixParams) {
			db.updateItem (prefixParams, function(err, data) {
				if (err) {
					console.log(err);
				} else {
					console.log("no error!!")
				}
			})
		}
	}
}


var getSearchResult = function(searchName, callback) {
	var params = {
		TableName: "Prefix",
		Key: {
			'prefix': {
				"S": searchName
			}
		}, 
		AttributesToGet: ['userIDs']
	}
	db.getItem(params, function(err, data) {
		
		if (err) {
			console.log("database/getSearchResult", err);
			callback(err, data)
		} else if (data.Item) { // username is in the string 
			
			const currentData = data.Item.userIDs.SS
			var myBeautifulList = []
			// change unique ID to userName
			
			function getItemForGetResult(userID) {
				var params = {
					TableName: "Accounts",
					Key: {
						'userID': {
							"S": userID
						}
					},
				}
				
				return db.getItem(params).promise()
			}
			
			var arrayOfPromises = currentData.map(getItemForGetResult)
			
			Promise.all(arrayOfPromises).then(
				successfulDataArray => {
					for (var i = 0; i <  successfulDataArray.length; i++) {
						
						myBeautifulList.push(successfulDataArray[i].Item.username.S)
					}
					callback(err, myBeautifulList)
				}
				
			) 
					
		} else {
			callback(err, null) // username is not in the prefix table
		}
	})
}

// returns getItem of username. return the username if it exists, null otherwise
var getUserID = function(username, usernameCallback) {
	var params = {
		TableName: "Usernames",
		Key: {
			'username': {
				"S" : username
			}
		},
		AttributesToGet: ['userID']
	}

	db.getItem(params, function(err, data) {
		console.log(data);
		if (err) {
			console.log(err);
		} else if (data.Item){
			
			//console.log("USER EXISTS")
			usernameCallback(err, data.Item.userID.S);
		} else {
			console.log("USERNAME DOESNT EXIST");
			usernameCallback(err, null);
		}
	})
}

/**
get user info from username
 */
var getUserInfo = function(username, callback) {
	getUserID(username, function(err, userID) {
		if(err) {
			console.log("GETUSERID ERROR")
			callback(err, null)
		} else if (userID) {
			// console.log("userid: ", userID);
			var params = {
				TableName: "Accounts",
				Key: {
					'userID': {
						"S": userID
					}
				},
			}
			db.getItem(params, function(err, data) {
				if(err) {
					console.log("GET ACCOUNT ERROR:", err)
				} else {
					// console.log(data);
				}
				callback(err, data);
			})
		} else { // user doesn't exist'
			console.log('lol');
		}
	})
}

var getUserInfoFromID = function(userID, callback) {
			
	var params = {
		TableName: "Accounts",
		Key: {
			'userID': {
				"S": userID
			}
		},
	}

	db.getItem(params, function(err, data) {
		if(err) {
			console.log("GET ACCOUNT ERROR:", err)
			callback(err, null)
		} else {
			// console.log(data);
			callback(err, data)
		}
		
	})
}


var getSuggestions = function(term, data) {
	var params = {
		
	}
}

// Table Posts1: userID (ID of the user wall being written on), postID
// Table Posts2: creatorID (ID of post creator), postID
// if a user posts on their own wall, the post will be added only to post 1 to prevent duplicates
// returns an array of post dictionaries
var getPosts = function(username, callback) {
	console.log("entered getPosts in database.js: ", username);
	getUserID(username, function(err, userID) {
		var param1 = {
			TableName: 'Posts1',
			KeyConditionExpression: 'userID = :userID',
			ExpressionAttributeValues: {
				':userID': {'S': userID}
			}
		}
		db.query(param1, function(err, data) {
			console.log("QUERY 1 data", data);
			if (err) {
				console.log("QUERYING POSTS1 TABLE FAILED", err);
			} else {
				var param2 = {
					TableName: 'Posts2',
					KeyConditionExpression: 'creatorID = :userID2',
					ExpressionAttributeValues: {
						':userID2': {'S': userID}
					}
				}
				db.query(param2, function(err2, data2) {
					console.log("QUERY 2 DATA: ", data2)
					if (err2) {
						console.log("QUERYIN POSTS2 TABLE FAILED", err2);
					} else {
						if (!data.Items && !data2.Items) {
							console.log("cb 1");
							callback(err2, null)
						} else {
							var result;
							if (!data.Items) {
								result = data2.Items;
							} else if (!data2.Items) {
								result = data1.Items;
							} else {
								result = data.Items.concat(data2.Items);
							}
							//var wallIDs = result.map(i => i.userID.S);
							//var creatorIDs = result.map(i => i.creatorID.S);
							Promise.all(result.map(function(post) {
								return new Promise (function(resolve, reject){
									var reqParams = {
										TableName: "Accounts",
										Key: {"userID": {
											"S" : post.userID.S
										}}
									};
									db.getItem(reqParams, function(err, userIdData) {
										if (err) {
											console.log(err);
											reject(err);
										} else {
											//console.log("post username data: ", userIdData);
											post.username = userIdData.Item.username;
											post.userFirstName = userIdData.Item.firstName;
											post.userLastName = userIdData.Item.lastName;
											resolve(userIdData);
										}
									})
								})
							})).then(function() {
								Promise.all(result.map(function(post) {
									return new Promise (function(resolve, reject){
										var reqParams = {
											TableName: "Accounts",
											Key: {"userID": {
												"S" : post.creatorID.S
											}}
										};
										db.getItem(reqParams, function(err, creatorIdData) {
											if (err) {
												console.log(err);
												reject(err);
											} else {
												//console.log("accounts creatorID data", creatorIdData);
												post.creatorUsername = creatorIdData.Item.username;
												post.creatorFirstName = creatorIdData.Item.firstName;
												post.userLastName = creatorIdData.Item.lastName;
												resolve(creatorIdData);
											}
										})
									})
								})).then(function() {
									console.log("cb 2");
									callback(null, result);
								}).catch(function(err) {
									console.log("cb 3");						
									callback(err, null);
								})
							}).catch(function(err){
								console.log("cb 4");
								callback(err, null);
							})
						}
					}
				})
			}
		})
		
	})
}

//User name is the username of the wall which the post is going on, creator name is
//the user name of the creator of the post
var addPost = function(username, creatorname, content, callback) {
	console.log("adding post for: ", username, "created by: ", creatorname);
	var timestamp = Date.now() + "";
	var postID = uuidv4();
	console.log("Generated postID: ", postID, "at time: ", timestamp);
	
	getUserID(username, function(err, userID) {
		if (err) {
			console.log("error retrieving userID", err);
			callback(err);
		} else {
			getUserID(creatorname, function(err, creatorID) {
				if (err) {
					console.log("error getting creatorID", err);
					callback(err);
				} else {
					var paramsPosts1 = {
						TableName: "Posts1",
						Item: {
							'userID': {S: userID},
							'creatorID': {S: creatorID},
							'postID': {S: postID},
							'content': {S: content},
							'timestamp': {N: timestamp}
						}
					};
					db.putItem(paramsPosts1, function(err, data) {
						if (err) {
							console.log("error creating post", err);
							callback(err)
						} else {
							console.log("successfully added post to post1");
							if (userID !== creatorID) {
								var paramsPosts2 = {
									TableName: "Posts2",
									Item: {
										'userID': {S: userID},
										'creatorID': {S: creatorID},
										'postID': {S: postID},
										'content': {S: content},
										'timestamp': {N: timestamp}
									}
								};
								db.putItem(paramsPosts2, function(err, data) {
									if (err) {
										console.log("error creating post", err);
										callback(err)
									} else {
										console.log("added post to posts2");
										callback(null, 'Success')
									}
								})
							} else {
								callback(null, 'Success')
							}
						}			
					});
				}
			});
		}
	});
}

var logMessage = function(chatID, userID, message, timestamp, fname, lname, callback) {
	console.log("Logging message: ", message);
	var params = {
		TableName: "ChatRoomMessages",
		Item: {
			'chatID': {S: chatID},
			'userID': {S: userID},
			'message': {S: message},
			'timestamp': {N: timestamp},
			'firstName': {S: fname},
			'lastName': {S: lname}
		}
	}
	db.putItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			console.log("Succesfully logged message");
			callback(null, data);
		}
	})
}

var addComment = function(postID, username, content, callback) {
	var commentID = uuidv4();
	var time = Date.now() + "";
	
	getUserID(username, function(err, userID) {
		if(err || !userID) {
			console.log("user trying to add comment is not in accounts table", err, data);
			callback(err, userID);
		} else {
			var params = {
				TableName: "Comments",
				Item: {
					'postID': {S: postID},
					'commentID': {S: commentID},
					'creatorID': {S: userID},
					'timestamp': {N: time},
					'content': {S: content},
				}
			}
			
			db.putItem(params, function(err, data) {
				if (err) {
					callback(err, null);
				} else {
					console.log("successfully added comment to database");
					callback(null, data);
				}
			})
		}
	})
	
}

var getComments = function(postID, callback) {
	var params = {
		TableName: "Comments",
		KeyConditionExpression: 'postID = :postID',
		ExpressionAttributeValues: {
			':postID': {'S': postID}
		}
	}
	db.query(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			console.log("successfully queried for comments");
			console.log(data);
			var creatorIDs = data.Items.map(i => i.creatorID.S);
			console.log(creatorIDs);
			
			var currItemIndex = 0; //uhh this can't be the right way to do this .-.
			Promise.all(creatorIDs.map(function(value){
				return new Promise (function(resolve, reject){
					var usernameParams = {
						TableName: "Accounts",
						Key: {"userID": {
							"S" : value
						}}
					};
					db.getItem(usernameParams, function(err, usernameData) {
						if(err) {
							console.log(err);
							reject(err);
						} else {
							console.log("USERNAME DATA: ", usernameData);
							data.Items[currItemIndex].username = usernameData.Item.username;
							data.Items[currItemIndex].firstName = usernameData.Item.firstName;
							data.Items[currItemIndex].lastName = usernameData.Item.lastName;
							currItemIndex++;
							resolve(usernameData);
						}
					})
				})
			})).then(function(usernameData) {
				callback(null, data.Items);
			}).catch(function(err) {
				callback(err, null);
			})
		}
	})
}

var getMessages = function(chatID, callback) {
    var param = {
		TableName: 'ChatRoomMessages',
		KeyConditionExpression: 'chatID = :chatID',
		ExpressionAttributeValues: {
			':chatID': {'S': chatID}
		}
	}
	db.query(param, function(err, data) {
		if (err) {
			console.log("QUERYING MESSAGES TABLE FAILED", err);
			callback(err, null);
		} else {
			callback(null, data.Items);
		}
	})
}

//Promises run twice for some reason
var getListOfUsernames = function(userIDs, callback) {
	const usernames = [];
    promiseList = [];
    for (var i = 0; i < userIDs.length; i++) {
		var userID = userIDs[i];
		var params = {
			TableName: "Accounts",
			Key: {
				'userID': {
					"S": userID
				}
			},
		}
		const promise = db.getItem(params, function(err, data) {
			if(!data) {
				console.log("GET ACCOUNT ERROR:", err)
			} else {
				var username = data.Item.username.S;
				usernames.push(username);
			}
		}).promise();

        promiseList.push(promise);
    }
    Promise.all(promiseList).then(
        success => {
            callback(null, usernames);
        },
        error => {
            console.log("error with promise list");
        }
    )
}

var getUserChats = function(userID, callback) {
	var param = {
		TableName: 'ChatRooms',
		KeyConditionExpression: 'userID = :userID',
		ExpressionAttributeValues: {
			':userID': {'S': userID}
		}
	}
	db.query(param, function(err, data) {
		if (err) {
			console.log("QUERYING CHATS TABLE FAILED", err);
			callback(err, null);
		} else {
			callback(null, data.Items);
		}
	})
}

var getUserChatsWithMembers = function(userID, callback) {
	getUserChats(userID, function(err, chatRooms) {
		if (err) {
			console.log("error getting chat rooms");
		} else {
			const chatRoomUsers = new Map();
			const promiseList = [];
			if (chatRooms) {
				for (var i = 0; i < chatRooms.length; i++) {
					const chatRoom =  chatRooms[i].chatID.S;
					var params = {
						TableName: 'ChatRoomMembers',
						KeyConditionExpression: 'chatID = :chatID',
						ExpressionAttributeValues: {
							':chatID': {'S': chatRoom}
						}
					}
					const promise = db.query(params, function(err, data) {
						if (err) {
							console.log("error getting members in chat room");
						} else {
							if (!chatRoomUsers.get(chatRoom)) {
								chatRoomUsers.set(chatRoom, []);
								for (var j = 0; j < data.Items.length; j++) {
									if (data.Items[j].userID.S === userID) {
										chatRoomUsers.get(chatRoom).push("you");
									} else {
										var temp = data.Items[j].firstName.S + " " + data.Items[j].lastName.S;
										chatRoomUsers.get(chatRoom).push(temp);
									}
								}
							}
						}
					}).promise();
					promiseList.push(promise);
				}
				Promise.all(promiseList).then(
					success => {
						for (let key of chatRoomUsers.keys()) {
							console.log("key: ", key, "value: ", chatRoomUsers.get(key));
						}
						callback(null, chatRoomUsers);
					},
					error => {
						console.log("Error retrieving all users for chats");
					}
				)
			} else {
				callback(true, false);
			}
			
		}
	})
}

var userInChat = function(chatID, userID, callback) {
	var params = {
		TableName: 'ChatRoomMembers',
		KeyConditionExpression: 'chatID = :chatID',
		ExpressionAttributeValues: {
			':chatID': {'S': chatID}
		}
	}
	db.query(params, function(err, data) {
		if (err) {
			console.log("error getting members in chat room");
		} else {
			for (let userInfo of data.Items) {
				var memberID = userInfo.userID.S;
				if (memberID === userID) {
					console.log("user is in chat");
					return callback(true);
				}
			}
			console.log("user not in chat");
			return callback(null);
		}
	})
}

//Create new chatRoom with new uuid as chatID, callback returns this chatID as data. userID is of the nofitication sender
var createChatRoom = function(userID, firstName, lastName, callback) {
	var chatID = uuidv4();
	var chatRoomsParams = {
		TableName: "ChatRooms",
		Item: {
			'userID': {S: userID},
			'chatID': {S: chatID}
		}
	};

	db.putItem(chatRoomsParams, function(err, data) {
		if (err) {
			callback(err);
		} else {
			chatRoomMembersParams = {
				TableName: "ChatRoomMembers",
				Item: {
					'userID': {S: userID},
					'chatID': {S: chatID},
					'firstName': {S: firstName},
					'lastName': {S: lastName}
				}
			}
			db.putItem(chatRoomMembersParams, function(error, data) {
				if (error) {
					callback(error);
				} else {
					callback(null, chatID);
				}
			})
		}
	})
}

//Once a chat invitation is accepted, add user to respective tables. userID is that of the recipient, chatID is stored in notification table
var addUserToChatRoom = function(userID, chatID, firstName, lastName, callback) {
	var chatRoomsParams = {
		TableName: "ChatRooms",
		Item: {
			'userID': {S: userID},
			'chatID': {S: chatID}
		}
	};

	db.putItem(chatRoomsParams, function(err, data) {
		if (err) {
			callback(err);
		} else {
			chatRoomMembersParams = {
				TableName: "ChatRoomMembers",
				Item: {
					'userID': {S: userID},
					'chatID': {S: chatID},
					'firstName': {S: firstName},
					'lastName': {S: lastName}
				}
			}
			db.putItem(chatRoomMembersParams, function(error, data) {
				if (error) {
					callback(error);
				} else {
					callback(null, chatID);
				}
			})
		}
	})
}

var addLike = function(postID, username, callback) {
	//get userID from username
	getUserID(username, function(err, userid) {
		if(err) {
			console.log(err);
		} else {
			console.log("id of liker", userid);
			var params = {
				TableName: "Likes",
				Item: {
					'postID': {S: postID},
					'userID': {S: userid}
				}
			};
			db.putItem(params, function(error, data) {
				if(error) {
					console.log("failed to add like");
					callback(error, null);
				} else {
					console.log(data);
					callback(null, data);
				}
			})
		}
	})
}

var getLikes = function(postID, username, callback) {
	getUserID(username, function(err, userid) {
		if(err) {
			console.log(err);
		} else {
			console.log("id", userid);
			var params = {
				TableName: 'Likes',
				KeyConditionExpression: 'postID = :postID',
				ExpressionAttributeValues: {
					':postID' : {'S': postID}
				}
			};
			db.query(params, function(error, data) {
				if(error) {
					callback(error, null, null);
				} else {
					// check if user has already liked
					const hasLiked = data.Items.filter(i => i.userID.S === userid);
					console.log("HAS LIKED DATA", hasLiked);
					if (hasLiked.length == 0) {
						callback(null, data.Items.length, false);
					} else {
						callback(null, data.Items.length, true);
					}
				}
			})
		}
	})
}

var removeLike = function(postID, username, callback) {
	getUserID(username, function(err, userid) {
		if(err) {
			callback(err, null);
		} else {
			var params = {
				TableName: "Likes",
				Key: {
					'postID' : {
						'S': postID
					},
					'userID' : {
						'S': userid
					}
				}
			};
			
			db.deleteItem(params, function(err, data) {
				if (err) {
					callback(err, null);
				} else {
					console.log(data);
					callback(err, data);
				}
			})
		}
	})
}

var database = {
	addUser: addUser,
	getUserInfo: getUserInfo, 
	getPosts: getPosts,
	getUserInfoFromID: getUserInfoFromID,
	getSearchResult: getSearchResult,
	getSuggestions: getSuggestions,
	checkLogin: checkLogin,
	addPost: addPost,
	updateAccount: updateAccount,
	getUserID: getUserID, //lmk if this is bad security/should only be called in this file
	logMessage: logMessage,
	addComment: addComment,
	getComments: getComments,
	getMessages: getMessages,
	getListOfUsernames: getListOfUsernames,
	getUserChatsWithMembers: getUserChatsWithMembers,
	userInChat: userInChat,
	addLike: addLike,
	getLikes: getLikes,
	removeLike: removeLike,
}
module.exports = database;
