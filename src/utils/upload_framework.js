/* sometimes the cleaner upload_framework.sh does not work,
 * because postgres refuses to do read_file
 */

const FRAMEWORK_ID = 'v2';

const db = require('../db.js');
const fs = require('fs');

const readDir = async (path, client) => {
	let filenames;
	try {
		filenames = fs.readdirSync(path);
	} catch(ex) { console.log(ex); return; }
	for(const file of filenames) {

		if(file === 'game.js') {
			console.log(`IGNORING ${path}/${file}`);
			continue;
		}

		try {
			const data = fs.readFileSync(`${path}/${file}`);
			const b64data = Buffer.from(data).toString('base64');
			const f = `${path}/${file}`.substr(2);
			console.log('Uploading', f);
			await client.query("INSERT INTO files(content) VALUES (DECODE($1, 'base64')) ON CONFLICT DO NOTHING", [b64data]);
			await client.query(`
				INSERT INTO framework_files(framework_name, filename, file_contents_hash)
				VALUES ($1, $2, MD5(DECODE($3, 'base64')))
			`, [FRAMEWORK_ID, f, b64data]);
		} catch(ex) {
			if(ex.errno == -21 && file !== '.git') {
				await readDir(`${path}/${file}`, client);
			} else {
				console.log('Failed ', file, ex)
			}
		}

	}
};

db.connect().then(client => {
	process.chdir('pishtov');
	client.query('BEGIN')
	.then(() => readDir('.', client))
	.then(() => client.query('COMMIT'))
	.then(() => process.exit(0));
})
