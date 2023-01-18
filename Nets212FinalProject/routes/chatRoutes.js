var db = require('../models/database.js');

//Called when attempting to join a chat room
var joinRoom = function(req, res) {
    if (req.session.username) {
        //first fetch the userID
		db.getUserInfo(req.session.username, function(err, data) {
            if (!data) {
                console.log("error retrieving user ID");
            } else {
                var userID = data.Item.userID.S;
                var firstName = data.Item.firstName.S;
                var lastName = data.Item.lastName.S;
                //Check if the current user is a member of the chat they are attempting to join
                console.log("ChatID: ", req.query.chatID);
                db.userInChat(req.query.chatID, userID, function(member) {
                    if (member) {
                        //If they are in the chat, retrieve logged messages and redirect to the chat room
                        db.getMessages(req.query.chatID, function(err, messages) {
                            if (err) {
                                console.log("error retrieving messages");
                            } else {
                                //Sort messages by time posted
                                messages.sort(function(a, b) {
                                    return a.timestamp.N - b.timestamp.N;
                                })
                              
                                //Render with relevent data
                                res.render("chatRoom.ejs", {user: userID, roomID: req.query.chatID, 
                                                                messages: messages, 
                                                                username: req.session.username,
                                                                firstName: firstName, 
                                                                lastName: lastName});
                            }
                        })
                    } else {
                        //If they are not, simply redirect to the home page
                        res.redirect("/homepage");
                    }
                })
            }
        });
	} else {
        //if not logged it, redirect to log in page
		res.redirect('/')
	}
}

/*
var getUsernameFromID = function(req, res) {
    db.getUserInfoFromID(req.body.userID, function(err, data) {
        if (!data) {
            console.log(err);
        } else {
            return res.send({success:true, username: data.Item.username.S});
        }
    })
}
*/

var leave = function(req, res) {
    
}

//Log each message that is sent into dynamo
var logMessage = function(req, res) {
    db.getUserInfoFromID(req.body.userID, function(err, info) {
        var fname = info.Item.firstName.S;
        var lname = info.Item.lastName.S;
        db.logMessage(req.body.chatID, req.body.userID, req.body.message, req.body.timestamp, fname, lname, function(err, data) {
            if (err) {
                console.log("error logging message", err);
                return res.send({success: false});
            } else {
                console.log("Succesfully logged message on server side");
                return res.send({success: true});
            }
        })
    })
}

//get all chat rooms a user is in
var getChatRooms = function(req, res) {
    if (req.session.username) {
        //get user ID from username
		db.getUserID(req.session.username, function(err, data) {
            if (err) {
                console.log("error retrieving user ID");
            } else {
                //get the chats they are in from db
                db.getUserChatsWithMembers(data, function(err, chatsMap) {
                    if (err) {
                        console.log("no chats to display");
                        res.render('chats.ejs', {chatsMap: null});
                    } else {
                        console.log("Map keyed by chatID valued by members: ", chatsMap);
                        var chatsArray = Array.from(chatsMap, ([chatID, users]) => ({chatID, users}));
                        res.render('chats.ejs', {chatsMap: chatsArray});
                    }
                });
            }
        });
	} else {
		res.redirect('/')
	}
}

var chatRoutes = {
    joinRoom: joinRoom,
    leave: leave,
    logMessage: logMessage,
    getChatRooms: getChatRooms
}

module.exports = chatRoutes;