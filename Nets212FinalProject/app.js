/* Some initialization boilerplate. Also, we include the code from
   routes/routes.js, so we can have access to the routes. Note that
   we get back the object that is defined at the end of routes.js,
   and that we use the fields of that object (e.g., routes.get_main)
   to access the routes. */

var express = require('express');
var routes = require('./routes/routes.js');
var newsRoutes = require('./routes/newsRoutes');
var chatRoutes = require('./routes/chatRoutes');
var friendRoutes = require('./routes/friendRoutes')
var visualizerRoutes = require('./routes/visualizerRoutes')

var async = require("async");
var app = express();

var SHA3 = require("crypto-js/sha3");
//const http = require('http').Server(app);
// const http = require('http');
const path = require("path");
// const io = require('socket.io')(http);

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var session = require('express-session')
app.use(session({secret:'loginSecret'}))
app.use(express.urlencoded());
//app.use(express.bodyParser());
//app.use(__dirname, express.static('public'));
app.use("/assets", express.static(__dirname + "/public"));



app.get('/', routes.login);
app.get('/signup', routes.signUp);
app.post('/createAccount', routes.createAccount);
app.get('/homePage', routes.homePage);
app.get('/getUserInfo', routes.getUserInfo);
app.get('/getPosts', routes.getPosts);
app.post('/login', routes.checkLogin);
app.get('/accountChange', routes.accountChange);
app.post('/addPost', routes.addPost);
app.post('/updateAccount', routes.updateAccount);

app.post('/getSearchResult', routes.getSearchResult)
app.get('/user/:user', routes.renderOtherUserPage)
app.get('/getOtherUserPage', routes.getOtherUserPage)

app.get("/chatRoom", chatRoutes.joinRoom);
app.post('/logMessage', chatRoutes.logMessage);
app.get('/chats', chatRoutes.getChatRooms);


// friend 
app.post('/addFriend', friendRoutes.addFriend);
app.get('/getNotifications', routes.getNotifications)
app.post('/acceptFriendRequest', friendRoutes.acceptFriendRequest)

// visualizer
app.get('/friendvisualization', visualizerRoutes.getFriendVisualizer)
app.get('/visualize', function(req, res) {
   res.render('visualize.ejs')
})
app.post('/getMoreFriends', visualizerRoutes.getMoreFriends)
app.get('/searchNews', newsRoutes.searchNews)






//app.post('/join', chatRoutes.join);
app.post('/leave', chatRoutes.leave);


/*io.on('connection', (socket) => {
   socket.on('chat message', (msg) => {
     io.emit('chat message', msg);
   });
 });*/

//Socket io for chat
io.on("connection", (socket) => {
   socket.on("chat message", obj => {
      io.to(obj.room).emit("chat message", obj);
   });

   socket.on("join room", obj => {
      console.log("joined room");
      socket.join(obj.room);
   });

   socket.on("leave room", obj => {
      console.log("left room");
      socket.leave(obj.room);
   });
});

app.post('/addComment', routes.addComment);
app.get('/getComments', routes.getComments);
app.post("/addLike", routes.addLike);
app.get("/getLikes", routes.getLikes);
app.post('/removeLike', routes.removeLike);

app.get("/therealhomepage", routes.getRealHomepage);
app.get("/newsfeed", routes.getNewsfeed);

//app.listen(8080);
server.listen(8080, () => {
   console.log('Server running on port 8080. Now open http://localhost:8080/ in your browser!');
});
console.log("Directory", __dirname);