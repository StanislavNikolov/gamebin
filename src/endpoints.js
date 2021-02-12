const config = require('./config.js');
const db     = require('./db.js');

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
};

module.exports.serveGame = async (req, res) => {
	const shorthand = req.params.shorthand;
	if(!await checkGameExists(shorthand)) {
		res.send(`Invalid game url`);
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
		res.set('Content-Type', 'text/javascript');
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

const addGameByGameJSOnly = async (ip, shorthand, code) => {
	if(code.length >= config['LIMITS']['PER_FILE']) {
		console.log(`${new Date().toISOString()} upload`, ip, `FAILED - file too big ${code.length}`);
		res.send('file too big');
		throw new Error('Code is too big');
		return;
	}

	console.log(code);
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		const insertGameSQL = `
			INSERT INTO games(is_public, shorthand, pishtov_version, uploader_ip, upload_date)
			VALUES($1, $2, $3, $4, $5) RETURNING id
		`;
		const gres1 = await client.query(insertGameSQL, [true, shorthand, 'asd', ip, new Date()]);
		const gameId = gres1.rows[0].id;

		// TODO performance
		// https://stackoverflow.com/questions/34708509/how-to-use-returning-with-on-conflict-in-postgresql
		// https://stackoverflow.com/questions/35265453/use-insert-on-conflict-do-nothing-returning-failed-rows
		const insertFileSQL = `
			INSERT INTO files(content) VALUES ($1)
			ON CONFLICT DO NOTHING
		`;
		await client.query(insertFileSQL, [code]);

		const getHashSQL = `SELECT MD5(content) AS hash FROM files WHERE content=$1`;
		const hash = (await client.query(getHashSQL, [code])).rows[0].hash;

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
		console.log(e);
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

module.exports.upload = async (req, res) => {
	const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

	if(req.body == null) {
		console.log(`${ip} send bad request`);
		res.status(400).send('Bad request');
	}

	// TODO get shorthand from request
	const shorthand = Math.random().toString(36).substring(2, 8); // random string

	console.log(ip, shorthand, req.body);

	if(typeof req.body.textarea === 'string') {
		// using textarea, ignoring file
		try {
			await addGameByGameJSOnly(ip, shorthand, req.body.textarea);
		} catch(ex) {
			res.status(400).send('Bad request');
			return;
		}
	}
	// TODO
	//addGameByZIP(ip, shorthand, zip);

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
