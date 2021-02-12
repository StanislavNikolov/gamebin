const config = require('./config.js');

const { Pool } = require('pg');
const pool = new Pool({
	host:     config['POSTGRES_HOST'],
	port:     config['POSTGRES_PORT'],
	user:     config['POSTGRES_USER'],
	password: config['POSTGRES_PASS'],
	database: config['DATABASE_NAME']
});

module.exports = pool;
