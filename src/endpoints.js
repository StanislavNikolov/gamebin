const config = require('./config.js');
const db     = require('./db.js');
const AdmZip = require('adm-zip');

const getFileByGame = async (shorthand, filename) => {
	const SQL = `
		SELECT content
		FROM games
		JOIN games_files ON games_files.game_id = games.id
		JOIN files ON games_files.file_contents_hash = MD5(files.content)
		WHERE games.shorthand = $1 and games_files.filename = $2
	`;

	const {rows} = await db.query(SQL, [shorthand, filename]);
	if(rows.length === 0) {
		throw new Error('Not found');
	}
	return rows[0];
}

const checkGameExists = async (shorthand) => {
	const SQL = 'SELECT 1 FROM games WHERE games.shorthand = $1';
	const {rows} = await db.query(SQL, [shorthand]);
	return rows.length > 0;
}

const addGameByGameJSOnly = async (ip, shorthand, code) => {
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		const insertGameSQL = `
			INSERT INTO games(is_public, shorthand, uploader_ip, upload_date)
			VALUES(true, $1, $2, $3) RETURNING id
		`;
		const gres1 = await client.query(insertGameSQL, [shorthand, ip, new Date()]);
		const gameId = gres1.rows[0].id;

		const b64code = Buffer.from(code).toString('base64');

		// TODO performance
		// https://stackoverflow.com/questions/34708509/how-to-use-returning-with-on-conflict-in-postgresql
		// https://stackoverflow.com/questions/35265453/use-insert-on-conflict-do-nothing-returning-failed-rows
		const insertFileSQL = `
			INSERT INTO files(content) VALUES (DECODE($1, 'base64'))
			ON CONFLICT DO NOTHING
		`;
		await client.query(insertFileSQL, [b64code]);

		const getHashSQL = `SELECT MD5(content) AS hash FROM files WHERE content=DECODE($1, 'base64')`;
		const hash = (await client.query(getHashSQL, [b64code])).rows[0].hash;

		const insertGameJSRelation = `
			INSERT INTO games_files (game_id, filename, file_contents_hash)
			VALUES ($1, 'game.js', $2)
		`;
		await client.query(insertGameJSRelation, [gameId, hash]);

		// TODO support other frameworks
		const insertFrRelation = `
			INSERT INTO games_files (game_id, filename, file_contents_hash)
			SELECT $1, filename, file_contents_hash
			FROM framework_files
			WHERE framework_name = 'v1'
		`;
		await client.query(insertFrRelation, [gameId]);

		await client.query('COMMIT');

		return gameId;
	} catch (e) {
		await client.query('ROLLBACK');
		if(e.code === '23505') { // unique_violation
			throw new Error('shorthand exists');
		} else {
			console.error('addGameByGameJSOnly failed', e);
			throw e;
		}
	} finally {
		client.release();
	}
}

const addGameByZIP = async (ip, shorthand, file) => {
	const zip = new AdmZip(file.data);
	const zipEntries = zip.getEntries();
	if(zipEntries.length > 1000) {
		throw Error('Too many files in the zip archive');
	}

	for(const entry of zipEntries) {
		//console.log(entry.entryName);
		if(zip.readFile(entry).length > config['LIMITS']['PER_FILE']) {
			throw Error('File too big!');
		}
	}

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		const insertGameSQL = `
			INSERT INTO games(is_public, shorthand, uploader_ip, upload_date)
			VALUES(true, $1, $2, $3) RETURNING id
		`;
		const gres1 = await client.query(insertGameSQL, [shorthand, ip, new Date()]);
		const gameId = gres1.rows[0].id;

		// TODO performance
		// https://stackoverflow.com/questions/34708509/how-to-use-returning-with-on-conflict-in-postgresql
		// https://stackoverflow.com/questions/35265453/use-insert-on-conflict-do-nothing-returning-failed-rows
		for(const entry of zipEntries) {
			const filename = entry.name;
			const content = zip.readFile(entry);

			const insertFileSQL = `
				INSERT INTO files(content) VALUES ($1)
				ON CONFLICT DO NOTHING
			`;
			await client.query(insertFileSQL, [content]);

			const getHashSQL = `SELECT MD5(content) AS hash FROM files WHERE content=$1`;
			const hash = (await client.query(getHashSQL, [content])).rows[0].hash;

			const insertGameJSRelation = `
				INSERT INTO games_files (game_id, filename, file_contents_hash)
				VALUES ($1, $2, $3)
			`;
			await client.query(insertGameJSRelation, [gameId, filename, hash]);
		}

		await client.query('COMMIT');

		return gameId;
	} catch (e) {
		await client.query('ROLLBACK');
		if(e.code === '23505') { // unique_violation
			throw new Error('shorthand exists');
		} else {
			console.error('addGameByGameJSOnly failed', e);
			throw e;
		}
	} finally {
		client.release();
	}
}

module.exports.serveGame = async (req, res) => {
	const shorthand = req.params.shorthand;
	if(!await checkGameExists(shorthand)) {
		res.status(404).send(`Invalid game url`);
		return;
	}

	// first try to send game's index.html
	try {
		const {content} = await getFileByGame(shorthand, 'index.html');
		res.set('Content-Type', 'text/html');
		res.send(content);
		return;
	} catch(ex) {}

	// if it doesn't exist, send start.html
	try {
		const {content} = await getFileByGame(shorthand, 'start.html');
		res.set('Content-Type', 'text/html');
		res.send(content);
		return;
	} catch(ex) {}

	res.send('Invalid game: Neither index.html nor start.html found');
}

module.exports.serveFile = async (req, res) => {
	const shorthand = req.params.shorthand;
	const filename = req.params['0'];

	try {
		// TODO dynamic type from db
		//res.set('Content-Type', 'text/javascript');
		const {content} = await getFileByGame(shorthand, filename);
		res.send(content);
	} catch(ex) {
		res.status(404).send('No such file');
	}
};

/*
const getFileByHash = async (hash) => {
	const SQL = `
		SELECT content
		FROM files
		WHERE MD5(content) = $1
	`;

	const {rows} = await db.query(SQL, [hash]);
	if(rows.length === 0) {
		throw new Error('Not found');
	}
	return rows[0];
}

module.exports.serveFileByHash = async (req, res) => {
	const hash = req.params.hash;

	try {
		// TODO dynamic type from db
		res.set('Content-Type', 'text/javascript');
		const {content} = await getFileByHash(hash);
		res.send(content);
	} catch(ex) {
		res.status(404).send('No such file');
	}
}
*/

module.exports.upload = async (req, res) => {
	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

	if(req.body == null) {
		console.log(`${ip} send bad request`);
		res.status(400).send('Bad request');
	}

	const shorthand = req.body.shorthand;

	if(typeof shorthand !== 'string') {
		res.status(400).send(`Invalid game shorthand`);
		return;
	}
	if(shorthand.length < 4) {
		res.status(400).send(`Shorthand too short.`);
		return;
	}
	if(shorthand.length > 32) {
		res.status(400).send(`Shorthand too long.`);
		return;
	}

	console.log(`Upload request: ${ip}, ${shorthand}`);

	try {
		if(typeof req.body.textarea === 'string' && req.body.textarea.length > 1) {
			// using textarea, ignoring file
			if(req.body.textarea.length >= config['LIMITS']['PER_FILE']) {
				console.log(`${new Date().toISOString()} upload`, ip, `FAILED - file too big ${code.length}`);
				throw new Error('Code is too big');
			}

			await addGameByGameJSOnly(ip, shorthand, req.body.textarea);
		} else {
			if(req.files == null || req.files.file == null) {
				res.status(400).send('Bad request');
				return;
			}
			await addGameByZIP(ip, shorthand, req.files.file);
		}
	} catch(error) {
		if(error.message === 'shorthand exists') {
			res.status(400).send('Shorthand exists.');
		} else {
			console.error('Unknown error during upload:', error);
			res.status(500).send('Something failed. Please try again.');
		}
		return;
	}

	res.redirect(`../game/${shorthand}/`);
}

module.exports.listGames = async (req, res) => {
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
		const header = `Showing <b>${rows.length}</b> games:<br><br>`;
		res.send(style + header + gameListHTML);
	} catch(error) {
		console.error(error);
		res.status(500).send("Something went wrong :<");
	}
}
