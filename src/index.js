const config     = require('./config.js');
const endpoints  = require('./endpoints.js');
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const fileUpload = require('express-fileupload');

const app = express();

app.set('trust proxy', 1);
app.use(fileUpload({ limits: { fileSize: config['LIMITS']['PER_FILE'] } }));

// TODO make this configurable
const uploadFileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 60,
  message: "Too many uploads from this IP, please try again in an hour"
});

app.get('/',                 (req, res) => res.redirect(`upload`));
app.get('/upload',           (req, res) => res.sendFile('upload.html', { root: __dirname }));
app.get('/noty.css',         (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.css'));
app.get('/noty.min.js',      (req, res) => res.sendFile(__dirname + '/node_modules/noty/lib/noty.min.js'));

//app.get('/files/:hash',       endpoints.serveFile);
app.use('/lib/noty', express.static('../node_modules/noty/lib'));

app.get('/game/:shorthand',   endpoints.serveGame);
app.get('/game/:shorthand/*', endpoints.serveFile);

app.post('/upload', uploadFileLimiter, endpoints.upload);
app.get('/list',                       endpoints.listGames);

app.listen(config['LISTEN_PORT'], () => {
	console.log(`Listening on port ${config['LISTEN_PORT']}!`);
});
