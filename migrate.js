const fs = require('fs');
const { Pool } = require('pg');
const db = new Pool({
	host: 'localhost',
	user: 'postgres',
	database: 'gamebin',
});

const addGameJS = async (shorthand, code, isPublic, isObfuscated, ip, date) => {
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		const insertGameSQL = `
			INSERT INTO games(is_public, shorthand, pishtov_version, uploader_ip, upload_date)
			VALUES($1, $2, $3, $4, $5) RETURNING id `;
		const gres = await client.query(insertGameSQL, [isPublic, shorthand, 'asd', ip, date]);

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

const badDate = new Date('2020-04-12T13:48:35.000Z');
fs.readdir('ujs/', (err, files) => {
	for(const file of files) {
		const date = new Date(fs.statSync(`ujs/${file}`).mtime.getTime());
		const data = fs.readFileSync(`ujs/${file}`, 'utf8');

		const isPublic = !(date.getTime() == badDate.getTime());
		addGameJS(file, data, isPublic, false, 'v1imported-unknown', date)
		.then(res => {
			console.log(file, res);
		})
		.catch(err => {
			console.log(err);
		});
	}
});
