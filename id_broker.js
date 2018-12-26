const fs = require('fs');

const possible = 'abcdefghijklmnopqrstuvwxyz';

const getRandomString = (len) => {
	let out = "";
	for(let i = 0;i < len;i ++) out += possible[Math.floor(Math.random() * possible.length)];
	return out;
}

const checkGameExists = (gameId) => fs.existsSync(__dirname + '/ujs/' + gameId);

const getNewId = () => {
	let id;
	do {
		id = getRandomString(4);
	} while(checkGameExists(id));

	return id;
}


// TODO implement
const checkId = () => {
	return true;
}

module.exports.getRandomString = getRandomString;
module.exports.checkGameExists = checkGameExists;
module.exports.getNewId        = getNewId;
module.exports.checkId         = checkId;
