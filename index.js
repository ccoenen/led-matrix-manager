const {spawn} = require('child_process');
const fs = require('fs');

const bodyParser = require('body-parser');
const express = require('express');
const app = express();

const vv = '/home/pi/rpi-rgb-led-matrix/utils/video-viewer';
const vvparameters = '--led-cols=64 --led-chain=3 -f';

let matrixProcess;
let outputbuffer = [];

function stopAll() {
	if (matrixProcess) {
		matrixProcess.kill();
	} else {
		console.log("no process is running");
	}
}

function redirectOutputs(childProcess) {
	childProcess.stdout.on("data", (data) => {outputbuffer.push(data)});
	childProcess.stderr.on("data", (data) => {outputbuffer.push(data)});
}

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', (req, res) => {
	fs.readdir('media', (error, files) => {
		res.render('index', {files, outputbuffer});
	});
});

app.get('/play/:file', (req, res) => {
	const file = '/home/pi/led-matrix-manager/media/' + req.params.file;
	console.log("Attempting to play " + file);
	stopAll();
	matrixProcess = spawn(vv, ['--led-cols=64', '--led-chain=3', '-f', file]);
	matrixProcess.on('exit', (code, signal) => {
		console.log(`child process exited with exit code ${code}`);
		matrixProcess = null;
	});
	redirectOutputs(matrixProcess);
	res.redirect('/');
});

app.get('/stop', (req, res) => {
	stopAll();
	res.redirect('/');
});

app.post('/download', (req, res) => {
	console.log(`Requested download of ${req.body.url}`);
	const yt = spawn('youtube-dl', ['--write-info-json', '--write-thumbnail', '-f', '160/worstvideo[width>192]', '-o', 'media/%(title)s-%(id)s.%(ext)s', req.body.url]);
	redirectOutputs(yt);
	res.redirect('/');
});

app.listen(3000, function () {
	console.log('Example app listening on port 3000!');
});
