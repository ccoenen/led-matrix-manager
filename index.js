const {spawn} = require('child_process');
const fs = require('fs');

const bodyParser = require('body-parser');
const express = require('express');
const app = express();

const vv = '/home/pi/rpi-rgb-led-matrix/utils/video-viewer';
const iv = '/home/pi/rpi-rgb-led-matrix/utils/led-image-viewer';
const vvparameters = ['--led-cols=64', '--led-chain=3', '--led-brightness=40'];

let matrixProcess;
let outputbuffer = [];

function stopAll(callback) {
	if (matrixProcess) {
		matrixProcess.on("exit", () => {
			matrixProcess = null;
			callback();
		});
		matrixProcess.kill();
	} else {
		console.log("no process is running");
		callback();
	}
}

function displayMedia(fileName) {
	const file = '/home/pi/led-matrix-manager/media/' + fileName;
	console.log("Attempting to play " + file);
	stopAll(() => {
		const params = vvparameters.concat(['-f', file]);
		if (matrixProcess) {
			console.error("THERE IS ALREADY A PROCESS RUNNING: %s", matrixProcess);
			return;
		}
		if (fileName.endsWith('.pixelmatrix')) {
			matrixProcess = spawn('/usr/bin/nice', ['-n', '-10', iv].concat(params));
		} else {
			matrixProcess = spawn('/usr/bin/nice', ['-n', '-10', vv].concat(params));
		}
		matrixProcess.on('exit', (code, signal) => {
			console.log(`child process exited with exit code ${code}`);
			matrixProcess = null;
		});
		redirectStdOut(matrixProcess);
		redirectStdErr(matrixProcess);
	});
}

function redirectStdOut(childProcess) {
	childProcess.stdout.on("data", (data) => {
		outputbuffer.push(data);
		console.log("O: " + data.toString());
	});
}
function redirectStdErr(childProcess) {
	childProcess.stderr.on("data", (data) => {
		outputbuffer.push(data);
		console.error("E: " + data.toString());
	});
}

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', (req, res) => {
	fs.readdir('media', (error, files) => {
		res.render('index', {files, outputbuffer});
	});
});

app.get('/play/:file', (req, res) => {
	displayMedia(req.params.file);
	res.redirect('/');
});

app.get('/stop', (req, res) => {
	stopAll(() => {});
	res.redirect('/');
});

app.post('/download', (req, res) => {
	console.log(`Requested download of ${req.body.url}`);
	const namePattern = '%(title)s-%(id)s';
	const filenameProcess = spawn('./youtube-dl/youtube-dl', ['--get-filename', '-o', namePattern, req.body.url]);
	redirectStdErr(filenameProcess);
	let filename = "";
        filenameProcess.stdout.on('data', (data) => {
		filename += data.toString();
	});
	filenameProcess.on('close', () => {
		filename = filename.trim().replace(/[\/ ]/,'_');
		console.log("downloading %s to %s", req.body.url, filename);

		const yt = spawn('./youtube-dl/youtube-dl', ['--write-info-json', '--write-thumbnail', '-f', '160/worstvideo[width>192]', '-o', `media/${filename}.%(ext)s`, req.body.url]);
		yt.on('exit', () => {
			console.log("download complete, now converting");
		        const ffmpeg = spawn('/usr/bin/ffmpeg', ['-y', '-i', `media/${filename}.mp4`, '-filter:v', 'scale=192:32:force_original_aspect_ratio=increase,crop=192:32:0:y', `media/${filename}.crop.mp4`]);
	                redirectStdOut(ffmpeg);
			redirectStdErr(ffmpeg);
			ffmpeg.on('exit', (code) => {
				if (code !== 0) {
					console.error('Error while converting video');
					return;
				}

				const streamConversion = spawn(vv, vvparameters.concat(['-v', '-O', `media/${filename}.pixelmatrix`, `media/${filename}.crop.mp4`]));
		                redirectStdOut(streamConversion);
				redirectStdErr(streamConversion);
				streamConversion.on('exit', (code) => {
					console.log("stream conversion finished");
					if (code !== 0) {
						console.error('Error while converting video');
						return;
					} else {
						displayMedia(filename + '.pixelmatrix');
					}
				});
			});
		});
		redirectStdOut(yt);
		redirectStdErr(yt);
	});

	res.redirect('/');
});

app.listen(3000, function () {
	console.log('Example app listening on port 3000!');
});

const ipDisplay = spawn(`./ip-display.sh`);
ipDisplay.on('exit', (code) => {
	if (code === 0) {
		displayMedia("ip.png");
	} else {
		displayMedia("ip-failed.png");
	}
});

