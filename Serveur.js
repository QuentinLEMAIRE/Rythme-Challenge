var connect = require('connect')
  , fs = require('fs')
  , app = connect()
  , server = require('http').createServer(app)
  , urlrouter = require('urlrouter')
  , io = require('socket.io')(server)
  , port = 8080
  , state = {}
;

// ##### URL Router #####

app.use( urlrouter( function(app) {

	app.get('/', function(req, res, next) {
		req.url += req.originalUrl + '/index.html';

		next();
	});

}));

app.use(require('serve-static')(__dirname));

// Start server

server.listen(port);

console.log("Serveur started");

var notes = ["Ronde", "Blanche", "Blanchepointee", "Noire", "Noirepointee", "Croche", "Deuxcroches", "Demisoupir", "Quatredoubles", "Soupir"];
var patterns = [[0]
			  , [1, 9, 3]
			  , [1, 3, 6]
			  , [3, 1, 9]
			  , [9, 5, 7, 1]
			  , [8, 3, 1]
			  , [3, 9, 6, 3]
			  , [1, 3, 9]
			  , [1, 8, 6]
			  , [2, 6]
			  , [6, 4, 5, 3]]; // Mesures faites pour durer 4 temps

// ##### Music generation #####

function generateSheet( callback ) {
	var sheet = [];
	var n = patterns.length;
	var bars = 4; // Nombre de mesures

	for ( var i = 0 ; i < bars ; i++ ) {
		var bar = patterns[Math.floor(Math.random() * n)];
		var m = bar.length;

		for ( var j = 0 ; j < m ; j++ ) {
			sheet.push(notes[bar[j]]);
		}
	}
	console.log(sheet);
	callback(sheet);
}



io.on('connection', function(socket) {

	socket.on('join', function(username) {
		socket.username = username;
		state[socket.id] = 'pause';
		socket.score = 0;

		socket.emit('chat', 'You just joined the game');

		var text = '<b>' + username + '</b> just joined the game';
		socket.broadcast.emit('chat', text);

		socket.emit('chat', 'Prepare for the next game');

		console.log("New player : " + username);
	});

	socket.on('chat', function(message) {
		var text = '<b>' + socket.username + '</b> : ' + message; 
		socket.emit('chat', text);
		socket.broadcast.emit('chat', text);
	});

	socket.on('ready', function(username) {
		if ( state[socket.id] === 'pause' ) {
			state[socket.id] = 'ready';
			socket.emit('chat', "You are ready.");
			var text = '<b>' + username + '</b> is ready';
			socket.broadcast.emit('chat', text);
		}

		var all_ready = true;
		for ( id in state ) {
			if ( state[id] !== 'ready' ) {
				all_ready = false;
			}
		}

		if ( all_ready ) {
			generateSheet( function(sheet) {
				io.sockets.emit('game_begin', sheet);
				best_score = 0;
				best_names = [];
			})
		}
	});

	socket.on('game_begin', function() {
		state[socket.id] = 'playing';
		socket.emit('chat', "The game is starting !");
	});

	socket.on('game_end', function(score) {
		state[socket.id] = 'pause';

		if ( score > best_score ) {
			best_score = score;
			best_names = [socket.username];
		} else if ( score == best_score ) {
			best_names.push(socket.username);
		}
		if (score==undefined){
				score = 0;
			}
		var text = 'You scored ' + score.toString() + ' points.';
		socket.emit('chat', text);

		var all_finished = true;
		for ( id in state ) {
			if ( state[id] !== 'pause' ) {
				all_finished = false;
			}
		}

		if ( all_finished ) {

			if ( best_names.length == 0 ) {
				io.sockets.emit('chat', "No result available.");
			} else {
				var text = '<b>' + best_names[0].toString();

				if ( best_names.length > 1 ) {
					for ( var i = 1 ; i < best_names.length ; i++ ) {
						text += ' and <b>' + best_names[i].toString() + '</b>';
					}
				}
				
				text += ' won the round with ' + best_score.toString() + ' points !';

				io.sockets.emit('chat', text);
			}
			
		}
	});

	socket.on('disconnect', function() {
		var text = '<b>' + socket.username + '</b> has disconnected';
		socket.broadcast.emit('chat', text);

		console.log("User " + socket.username + " disconnected.")

		delete state[socket.id];
	});
});

