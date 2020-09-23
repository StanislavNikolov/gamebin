const express = require('express');
const app     = express();
const port    = 3110;
const fs      = require('fs');

const rateLimit  = require("express-rate-limit");
const fileUpload = require('express-fileupload');

const jsObfuscator = require('javascript-obfuscator');

const { Pool } = require('pg');
const db = new Pool({
	host: 'localhost',
	user: 'postgres',
	database: 'gamebin',
});

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

app.get('/game/:shorthand/game.js', async (req, res) => {
	try {
		const shorthand = req.params.shorthand;
		const SQL = `
			SELECT content, is_obfuscated
			FROM files
			JOIN games ON game_id = games.id
			WHERE games.shorthand = $1
		`;

		const {rows} = await db.query(SQL, [shorthand]);
		if(rows.length === 0) {
			res.status(404).send("No such game");
			return;
		}

		res.set('Content-Type', 'text/javascript'); // browsers give warnings if mime is incorrect
		if(rows[0].is_obfuscated) {
			res.send(jsObfuscator.obfuscate(rows[0].content).getObfuscatedCode());
		} else {
			res.send(rows[0].content);
		}
	} catch(error) {
		console.error(error);
		res.status(500).send("Something went wrong :<");
	}
});

app.get('/game/:gameId/images/:image', (req, res) => {
	res.redirect(`../../../pishtov/images/${req.params.image}`);
});

const addGameJS = async (shorthand, code, isPublic, isObfuscated, ip) => {
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		const insertGameSQL = `
			INSERT INTO games(is_public, shorthand, pishtov_version, uploader_ip, upload_date)
			VALUES($1, $2, $3, $4, $5) RETURNING id `;
		const gres = await client.query(insertGameSQL, [isPublic, shorthand, 'asd', ip, new Date()]);

		const insertFileSQL = `
			INSERT INTO files(game_id, content, is_obfuscated)
			VALUES ($1, $2, $3)`;
		await client.query(insertFileSQL, [gres.rows[0].id, code, isObfuscated]);

		await client.query('COMMIT');

		return gres.rows[0].id;
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
};

app.post('/upload', uploadFileLimiter, (req, res) => {
	res.header('Access-Control-Allow-Origin', '*');

	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

	let code = null;
	if(req.body != null && req.body.textarea != null && req.body.textarea.length > 0) {
		// using textarea, ignoring file
		code = req.body.textarea;
	} else if(req.files != null && req.files.file != null) {
		// using file upload
		code = req.files.file.data;
	}

	if(code == null) {
		console.log(`${new Date().toISOString()} upload`, ip, 'FAILED - did not send anything');
		res.json({error: 'bad request'});
		return;
	}

	if(code.length >= MAX_FILE_SIZE) {
		console.log(`${new Date().toISOString()} upload`, ip, `FAILED - file too big ${code.length}`);
		res.json({error: 'file limit exceeded'});
		return;
	}

	const isPublic = req.body.public || false;
	const obfuscate = req.body.obfuscate || false;

	const shorthand = Math.random().toString(36).substring(2, 8); // random string
	addGameJS(shorthand, code, isPublic, obfuscate, ip)
	.then(newGameId => {
		console.log(`${new Date().toISOString()} upload`, ip, 'OK', newGameId);
		res.json({url: `https://${req.headers.host}/game/${shorthand}/`});
	})
	.catch(err => {
		console.log(`${new Date().toISOString()} upload`, ip, 'FAILED - error in addGameJS', err);
		res.json({error: 'database error'});
	});
});

app.get('/list', async (req, res) => {
	try {
		const SQL = `
			SELECT shorthand, upload_date
			FROM games
			WHERE is_public = true
			ORDER BY upload_date DESC
		`;

		const {rows} = await db.query(SQL, []);
		const gameListHTML = rows.map(curr => {
			const upl = curr.upload_date;
			const date = upl.toISOString().substring(0, 10);
			const time = `${String(upl.getHours()).padStart(2, '0')}:${String(upl.getMinutes()).padStart(2, '0')}`;
			return `${date} ${time} - <a href="game/${curr.shorthand}/">${curr.shorthand}</a>`;
		}).join('<br>');

		const style = `<style>a { font-family: monospace; }</style>`;
		const header = `Showing <b>${rows.length}</b> public games:<br><br>`;
		res.send(style + header + gameListHTML);
	} catch(error) {
		console.error(error);
		res.status(500).send("Something went wrong :<");
	}
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
