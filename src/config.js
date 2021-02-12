// TODO verify config is correct

const fs = require('fs');

let file = '';
try {
	file = fs.readFileSync('config.json', 'utf8');
} catch(ex) {
	console.error('Missing config.json. Copy config_template.json to config.json and edit it accordingly.');
	process.exit(1);
}

try {
	const config = JSON.parse(file);
	module.exports = config;
} catch(ex) {
	console.log(ex);
	process.exit(1);
}
