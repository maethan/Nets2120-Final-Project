var db = require('../models/database.js');
var friendDB = require('../models/friendDatabase.js');


var login = function(req, res) {
	res.render('login.ejs', {message: req.session.messageHomepage});
}

// can delete this
var signUp = function(req, res) {
	res.render('signup.ejs');
}

var createAccount = function(req, res) {
	var username = req.body.username;
	var firstName = req.body.fname; 
	var lastName = req.body.lname; 
	var email = req.body.email;
	var password = req.body.password; 
	var affiliation = req.body.affiliation; 
	var birthDate = req.body.birthDate;

	db.addUser(username, firstName, lastName, email, password, affiliation, birthDate, function(err, data) {
		if (err) {
			console.log(err);
		} else if (data){
			console.log("DATA: ", data)
			res.send({success: false});
		} else {
			console.log("successful account creation")
			req.session.username = username;
			res.send({success: true, url: '/homePage'});
		}
	})
}

var getUserInfo = function(req, res) {
	//console.log(req.session)
	var username = req.session.username;
	console.log("current user: ", username);
	db.getUserInfo(username, function(err, data) {
		//console.log(data.Item.firstName.S);
		res.send(data);
	})
}

var homePage = function(req, res) {
	if (req.session.username) {
		req.session.visitinguser = req.session.username;
		res.render('homepage.ejs')
	} else {
		res.redirect('/')
	}
}

var checkLogin = function(req, res) {
	db.checkLogin(req.body.username, req.body.password, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false})
		} else if (!data) { // data == null
			console.log('invalid login credentials')
			res.send({success: false})
		} else {
			req.session.username = req.body.username;
			res.send({success: true, url: '/homePage'})
		}
	})
}

// requires a user parameter (to get the posts for)
var getPosts = function(req, res) {
	console.log("USERNAME IN GET POSTS:", req.session.visitinguser)
	db.getPosts(req.session.visitinguser, function(err, data) {
		if (err) {
			console.log(err)
		} else {
			console.log("SERVER SIDE GETPOSTS DATA", data)
			// sort post data by time here - and then take top 20 or so posts
			data.sort(function(a, b) {
				return b.timestamp.N - a.timestamp.N;
			})
			data = data.slice(0, 20);
			//console.log("SORTED DATA", data);
			res.send(data)
		}
	})
}

var getSearchResult = function(req, res) {
	
	var searchName = req.body.searchName
	db.getSearchResult(searchName, function(err, data) {
		if (err) {
			console.log(err)
			res.send(JSON.stringify({status: false, list: null}))
		} else if (data) {
			var contentString = '<ul style="list-style: none;">'
			for (var i = 0; i < data.length; i++) {
				let theString = "/user/" + data[i]
				contentString += '<li>' + '<a href=' + theString + '>' + data[i] + '</a> </li>'
			}
			contentString += '</ul>'
			//res.send(JSON.stringify({list: data}))
			res.send(JSON.stringify({status: true, list: contentString}))
		} else {
			res.send(JSON.stringify({status: false, list: null}))
		}
	})
}

var getUserInfoFromID = function(req, res) {
		db.getUserInfoFromID(req.body.userID, function(err, data) {
			if (!data) {
				console.log("error getting user info from id");
			} else {
				return res.send({info: data.Item})
			}
		})
}


var accountChange = function(req, res) {
	if (req.session.username) {
		res.render('accountchange.ejs', {user: req.session.username});
	} else {
		res.redirect('/')
	}
}

var addPost = function(req, res) {
	var creator = req.session.username
	console.log("Creator: ", creator);
	db.addPost(req.body.username, creator, req.body.content, function(err, data) {
		if (err) {
			console.log("error adding post", err);
		} else {
			console.log("Adding post");
			res.send({success: true});
		}
	});
}

//TODO: When updating username, also update the search, absolutely 0 clue how to do this
var updateAccount = function(req, res) {
	console.log("User is updating account");
	var uid = req.body.userID;
	var username = req.body.username;
	var oldUsername = req.session.username;
	var email = req.body.email;
	var password = req.body.password; 
	var oldPassword = req.body.oldPassword;
	var affiliation = req.body.affiliation; 

	db.updateAccount(oldUsername, oldPassword, uid, username, email, password, affiliation, function(err, data) {
		if (err) {
			console.log("error updating account information");
			res.send({success: false});
		} else {
			console.log("successful account update");
			req.session.username = username;
			res.send({success: true});
		}
	})
}

var renderOtherUserPage = function(req, res) {
	console.log('want to lookup' + req.params.user)
	req.session.visitinguser = req.params.user
	res.render('otheruserpage.ejs')
}

var getOtherUserPage = function(req, res) {
	var username = req.session.visitinguser 
	console.log(username)
	db.getUserInfo(username, function(err, data) {
		console.log("my data", data)
		res.send(data);
	})
}

var addComment = function(req, res) {
	db.addComment(req.body.postID, req.session.username, req.body.content, function(err, data) {
		if(err) {
			console.log(err);
		} else {
			res.send({success:true});
		}
	});
}



// passes in a postid, gets comments for that post
var getComments = function(req, res) {
	console.log("POSTID: ", req.query.postID);
	db.getComments(req.query.postID, function(err, data) {
		if (err) {
			console.log("GETCOMMENTS ERROR", err);
		} else {
			console.log("data", data);
			// add userID attribute to each element in array
			// sort comments by time
			data.sort((a, b) => b.timestamp - a.timestamp);
			res.send(data);
		}
	});
}

var getNotifications = function(req, res) {
	var userName = req.session.username 
	friendDB.getNotifications(userName, function(err, data) {
		// send something back to client please 
		if (err) {
			var content = {
                "success": false, 
                "data" : null
            }
			res.send(JSON.stringify(content))
		} else {
			data.slice(0, 20);
			var content = {
				"success": true, 
				"data": data
			} 
			res.send(JSON.stringify(content))
		}
	})
}

var getHomePagePosts = function(req, res) {
	// get user's friends. then get those friends' posts and sort by time
	
}

var addLike = function(req, res) {
	db.addLike(req.body.postID, req.session.username, function(err, data) {
		if(err) {
			console.log(err);
			res.send({success: false});
		} else {
			res.send({success: true});
		}
	})
}

// gets number of likes and returns if the user has already liked the item
var getLikes = function(req, res) {
	db.getLikes(req.query.postID, req.session.username, function(err, likesCount, alreadyLiked) {
		if (err) {
			console.log(err);
		} else {
			res.send({numLikes: likesCount, alreadyLiked: alreadyLiked})
		}
	})
}

var removeLike = function(req, res) {
	db.removeLike(req.body.postID, req.session.username, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			console.log(data);
			res.send({success: true});
		}
	})
}

var getRealHomepage = function(req, res) {
	
}

var renderNewsfeed = function(req, res) {
	res.render("newsfeed.ejs");
}

var routes = {
	login: login,
	signUp: signUp,
	createAccount: createAccount,
	homePage: homePage,
	getUserInfo: getUserInfo,
	getPosts: getPosts,
	getUserInfoFromID: getUserInfoFromID,
	getSearchResult: getSearchResult,
	checkLogin: checkLogin,
	accountChange: accountChange,
	addPost: addPost,
	updateAccount: updateAccount,
	getOtherUserPage: getOtherUserPage, 
	renderOtherUserPage: renderOtherUserPage,

	
	addComment: addComment,
	getComments: getComments,

	getNotifications: getNotifications,
	
	addLike: addLike,
	getLikes: getLikes,
	removeLike: removeLike,
	
	getRealHomepage: getRealHomepage,
	getNewsfeed: renderNewsfeed,
}

module.exports = routes; 