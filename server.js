const express = require('express');
const app     = express();
const port    = 3110;
const fs      = require('fs');

const rateLimit  = require("express-rate-limit");
const fileUpload = require('express-fileupload');

const idBroker     = require('./id_broker.js');


const MAX_FILE_SIZE = 50 * 1000; // in bytes
app.use(fileUpload({ limits: { fileSize: MAX_FILE_SIZE } }));

app.set('trust proxy', 1);
const uploadFileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 60,
  message: "Too many uploads from this IP, please try again after an hour"
});

app.use('/pishtov', express.static(__dirname + '/pishtov'));

app.get('/',              (req, res) => res.redirect(`upload`));
app.get('/upload',        (req, res) => res.sendFile('upload.html', { root: __dirname }));
app.get('/game/:gameId/', (req, res) => res.sendFile('pishtov/start.html', { root: __dirname }));

app.get('/noty.css',      (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.css'));
app.get('/noty.min.js',   (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.min.js'));

app.get('/game/:gameId/game.js', (req, res) => {
	const gameId = req.params.gameId;

	if(!idBroker.checkId(gameId) || !idBroker.checkGameExists(gameId)) {
		res.status(404).send('wrong game id');
		return;
	}

	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(`${new Date().toISOString()} get`, gameId, ip);
	res.sendFile(`ujs/${req.params.gameId}`, { root: __dirname });
});

app.get('/game/:gameId/images/:image', (req, res) => {
	res.redirect(`../../../pishtov/images/${req.params.image}`);
});

const addGameJS = (code, callback) => {
	const newGameId = idBroker.getNewId();

	fs.writeFile(`ujs/${newGameId}`, code, (err) => {
		if(err) callback(err, null);
		else callback(null, newGameId);
	});
};

app.post('/upload', uploadFileLimiter, (req, res) => {
	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

	let code = null;
	if(req.body != null && req.body.textarea != null && req.body.textarea.length > 0) {
		// using textarea, ignoring file
		code = req.body.textarea;
	} else if(req.file != null && req.files.file != null) {
		// using file upload
		code = req.files.file.data;
	}

	if(code == null) {
		console.log(`${new Date().toISOString()} upload`, ip, 'FAILED - did not send anthing');
		res.send('failed');
		return;
	}

	addGameJS(code, (err, newGameId) => {
		if(err) {
			console.log(`${new Date().toISOString()} upload`, ip, 'FAILED - error in addGameJS', err);
			res.send('failed');
			return;
		}
		res.redirect(`../game/${newGameId}/`);
		console.log(`${new Date().toISOString()} upload`, ip, 'OK', newGameId);
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
			result_html += `<a href="game/${p.file}/">${p.file}</a> - ${p.date}<br>`;
		}
		res.send(result_html);
	});
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
