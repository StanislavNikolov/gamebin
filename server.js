const express = require('express');
const app     = express();
const port    = 8081;
const mustache = require('mustache');
const multer  = require('multer');
const fs      = require('fs');

const randomString = (len) => {
	let out = "";
	const possible = "abcdefghijklmnopqrstuvwxyz";
	for(let i = 0;i < len;i ++) out += possible[Math.floor(Math.random() * possible.length)];
	return out;
}

const multerStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, __dirname + '/tmp/'),
	filename   : (req, file, cb) => cb(null, randomString(10))
});

const KILOBYTE = 1000;
const multerUpload = multer({
                            storage: multerStorage,
                            limits: {fileSize: 50 * KILOBYTE}
                     });

const HTML_loadgame = `
<html>
<head>
<style>
    body, canvas {
        margin: 0;
        padding: 0;
        overflow: hidden;
    }
</style>
</head>
<body onload="init()">
	<canvas id="canvas-id" width="800" height="600">
		<script src="/common/prepishtov.js"></script>
		<script src="/ujs/{{gameId}}.js"></script>
		<script src="/common/afterpishtov.js"></script>
	</canvas>
</body>
</html>
`;

const checkGameExists = (gameId) => fs.existsSync(__dirname + '/ujs/' + gameId);

app.get('/', (req, res) => res.redirect('/upload'));

app.get('/game/:gameId', (req, res) => {
	const gameId = req.params.gameId;
	if(!checkGameExists(gameId)) {
		res.status(404).send('wrong game id');
		return;
	}
	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log('get', gameId, ip);
	res.send(mustache.render(HTML_loadgame, {gameId: gameId}));
});

app.get('/ujs/:gameId.js', (req, res) => {
	// TODO SECURITY big security hole
	res.sendFile(__dirname + '/ujs/' + req.params.gameId);
});

app.get('/upload', (req, res) => {
	res.sendFile(__dirname + '/upload.html');
});

const nextGameId = () => {
	let id;
	do {
		id = randomString(4);
	} while(checkGameExists(id));
	return id;
};

app.post('/upload', (req, res) => {
	multerUpload.single('gamejs')(req, res, (err) => {
		if(err) {
			if(err.code === "LIMIT_FILE_SIZE") {
				console.log('someone tried to upload too big file');
				res.send('File too large');
				return;
			}

			// TODO this codepath is not well tested

			console.log(err);
			res.send('Unkown error');
			return;
		}

		const newGameId = nextGameId();

		console.log('uploaded new game:', newGameId);

		fs.rename(req.file.path, __dirname + '/ujs/' + newGameId, (err) => {
			if(err) throw err;
			res.redirect('/game/' + newGameId);
		});
	});
});

app.listen(port, () => console.log(`Listening on port ${port}!`));

app.use('/common', express.static(__dirname + '/common'));

app.get('/noty.css',     (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.css'));
app.get('/noty.min.js',  (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.min.js'));
