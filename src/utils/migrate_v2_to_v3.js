const fs = require('fs');
const { Pool } = require('pg');
const oldDB = new Pool({
	host: 'localhost',
	user: 'postgres',
	password: '1rf1cHV9u37g12Z0z',
	database: 'gamebin',
});

const db = require('../db.js');

const addGameByGameJSOnly = async (ip, shorthand, uploadDate, code) => {
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		const insertGameSQL = `
			INSERT INTO games(is_public, shorthand, uploader_ip, upload_date)
			VALUES(true, $1, $2, $3) RETURNING id
		`;
		const gres1 = await client.query(insertGameSQL, [shorthand, ip, uploadDate]);
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
		console.log(e);
		await client.query('ROLLBACK');
		if(e.code === '23505') { // unique_violation
			throw new Error('shorthand exists');
		} else {
			//console.error('addGameByGameJSOnly failed', e);
			throw e;
		}
	} finally {
		client.release();
	}
}


const SQL = `
SELECT shorthand, uploader_ip, upload_date, content
FROM games
JOIN files ON files.game_id = games.id
`;

const wtf = async () => {
	const res = await oldDB.query(SQL);
	for(const row of res.rows) {
		try {
			await addGameByGameJSOnly(row.uploader_ip, row.shorthand, row.upload_date, row.content);
		} catch(e) {
			console.log('failed', row.shorthand);
		}
	}
};

wtf().then(() => {
	console.log('done');
	process.exit(0);
});
