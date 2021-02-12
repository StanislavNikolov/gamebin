/* sometimes the cleaner upload_framework.sh does not work,
 * because postgres refuses to do read_file
 */

const db = require('../db.js');
const fs = require('fs');

const readDir = (path, client) => {
	let filenames;
	try {
		filenames = fs.readdirSync(path);
	} catch(ex) { console.log(ex); return; }
	for(const file of filenames) {
		try {
			const data = fs.readFileSync(`${path}/${file}`, 'hex');
			const f = `${path}/${file}`.substr(2);
			console.log(f, data.substr(0, 10));
			client.query('INSERT INTO files(content) VALUES ($1) ON CONFLICT DO NOTHING', [data]);
			client.query(`
				INSERT INTO framework_files(framework_name, filename, file_contents_hash)
				VALUES ('v1', $1, MD5($2))
			`, [f, '\\x' + data]);
		} catch(ex) {
			if(ex.errno == -21 && file !== '.git') {
				readDir(`${path}/${file}`, client);
			}
		}

	}
};

db.connect().then(client => {
	process.chdir('pishtov');
	client.query('BEGIN');
	readDir('.', client);
	client.query('COMMIT');
	process.exit(0);
})
