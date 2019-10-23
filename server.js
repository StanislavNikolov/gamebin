const express = require('express');
const app     = express();
const port    = 8081;
const multer  = require('multer');
const fs      = require('fs');

const idBroker     = require('./id_broker.js');
const htmlRenderer = require('./html_renderer.js');

const multerStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, __dirname + '/tmp/'),
	filename   : (req, file, cb) => cb(null, idBroker.getRandomString(10))
});

const KILOBYTE = 1000;
const multerUpload = multer({
                            storage: multerStorage,
                            limits: {fileSize: 50 * KILOBYTE}
                     });

app.get('/', (req, res) => res.redirect('/upload'));

app.get('/game/:gameId', (req, res) => {
	const gameId = req.params.gameId;

	if(!idBroker.checkId(gameId) || !idBroker.checkGameExists(gameId)) {
		res.status(404).send('wrong game id');
		return;
	}

	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(`${new Date().toISOString()} get`, gameId, ip);
	res.send(htmlRenderer.getLoadGameHTML(gameId));
});

app.get('/ujs/:gameId.js', (req, res) => {
	res.sendFile(__dirname + '/ujs/' + req.params.gameId);
});

app.get('/upload', (req, res) => {
	res.sendFile(__dirname + '/upload.html');
});

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

		if(req.file == null) return;

		const newGameId = idBroker.getNewId();

		const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		console.log(`${new Date().toISOString()} upload`, newGameId, ip);

		fs.rename(req.file.path, __dirname + '/ujs/' + newGameId, (err) => {
			if(err) throw err;
			res.redirect('/game/' + newGameId);
		});
	});
});

app.get('/list', (req, res) => {
	const path = `${__dirname}/ujs`;
	let result_html = '';
	fs.readdir(path, (err, files) => {
		let arr = [];
		for(const file of files) {
			const date = new Date(fs.statSync(`${path}/${file}`).mtime.getTime());
			arr.push({date: date, file: file});
		}
		arr.sort((a, b) => a.date - b.date);
		for(const p of arr) {
			result_html += `<a href="/game/${p.file}">${p.file}</a> - ${p.date}<br>`;
		}
		res.send(result_html);
	});
});

app.listen(port, () => console.log(`Listening on port ${port}!`));

app.use('/common', express.static(__dirname + '/common'));
app.use('/prism',  express.static(__dirname + '/node_modules/prismjs'));

app.get('/noty.css',     (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.css'));
app.get('/noty.min.js',  (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.min.js'));
