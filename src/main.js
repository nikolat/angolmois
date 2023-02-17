'use strict';
const { app, ipcMain, BrowserWindow, shell } = require('electron');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;

const createWindow = () => {
	mainWindow = new BrowserWindow({
		title: app.name,
		width: 800,
		height: 640,
		minWidth: 800,
		minHeight: 640,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	// https://blog.katsubemakito.net/nodejs/electron/click-to-defaultbrowser
	const handleUrlOpen = (e, url)=>{
		if(url.match(/^http/)){
			e.preventDefault()
			shell.openExternal(url)
		}
	}
	mainWindow.webContents.on('will-navigate', handleUrlOpen);
	mainWindow.webContents.on('new-window', handleUrlOpen);

	mainWindow.loadFile('angolmois-web/dist/index.html');
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
};

app.whenReady().then(() => {
	createWindow();
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

let sstp_mes = '';
let sstp_id = -1;
ipcMain.on('ipc-SSTP-send', (event, data) => {
	const hwnd = data[0];
	const script = data[1];
	let mes = ''
		+ 'EXECUTE SAORI/1.0\n'
		+ 'Charset: UTF-8\n'
		+ 'SecurityLevel: Local\n'
		+ 'Argument0: DSSTPSend\n'
		+ 'Argument1: ' + hwnd + '\n'
		+ 'Argument2: result\n'
		+ 'Argument3: NOTIFY SSTP/1.1\n'
		+ 'Argument4: Charset: UTF-8\n'
		+ 'Argument5: Sender: angolmois-electron\n'
		+ 'Argument6: Event: OnNostr\n'
		+ 'Argument7: Option: nobreak\n'
		+ 'Argument8: Script: ' + script + '\n'
		+ 'Argument9: Reference0: Nostr/0.1\n';
	for (let i = 2; i < data.length; i++) {
		mes += 'Argument' + (8 + i) + ': Reference' + (i - 1) + ': ' + data[i] + '\n';
	}
	mes += '\n';
	sstp_mes += mes;
	clearTimeout(sstp_id);
	sstp_id = setTimeout(execSSTP, 500);
});

const execSSTP = () => {
	const dt1 = new Date().toISOString().replace(/[T.:]/g, '-').replace(/Z/, '');
	const saoridir = `${__dirname}\\saori\\`
	const path1 = `${saoridir}log\\sstp_${dt1}_request.txt`;
	fs.writeFile(path1, sstp_mes, (error) => {
		sstp_mes = '';
		if (error != null) {
			console.error('ERROR', error);
			return;
		}
		childProcess.exec(`${saoridir}shioricaller.exe ${saoridir}HandUtil.dll ${saoridir} < ${path1}`, (error, stdout, stderr) => {
			const dt2 = new Date().toISOString().replace(/[T.:]/g, '-').replace(/Z/, '');
			if (error) {
				console.error('ERROR', error);
				const path2 = `${saoridir}log\\sstp_${dt2}_error.txt`;
				fs.writeFile(path2, error.message, (err) => {
				if (err != null) {
					console.error('ERROR', err);
					return;
				}
				});
				return;
			}
			const path2 = `${saoridir}log\\sstp_${dt2}_response.txt`;
			fs.writeFile(path2, stdout, (error) => {
				if (error != null) {
					console.error('ERROR', error);
					return;
				}
			});
			return stdout;
		});
	});
};

//FOMから起動中のゴースト情報を取得
ipcMain.on('ipc-request-ghost-info', (event) => {
	const saoridir = `${__dirname}\\saori\\`
	const path0 = `${saoridir}log\\`;
	fs.rmSync(path0, { recursive: true, force: true });
	fs.mkdirSync(path0);
	const mes1 = ''
		+ 'EXECUTE SAORI/1.0\n'
		+ 'Charset: UTF-8\n'
		+ 'SecurityLevel: Local\n'
		+ 'Argument0: GetFMO\n'
		+ 'Argument1: SakuraUnicode\n'
		+ '\n';
	const dt1 = new Date().toISOString().replace(/[T.:]/g, '-').replace(/Z/, '');
	const path1 = `${saoridir}log\\sstp_${dt1}_request.txt`;
	fs.writeFile(path1, mes1, (error) => {
		if (error != null) {
			console.error('ERROR', error);
			return;
		}
	});
	childProcess.exec(`${saoridir}shioricaller.exe ${saoridir}HandUtil.dll ${saoridir} < ${path1}`, (error, stdout, stderr) => {
		if(error) {
			return console.error('ERROR', error);
		}
		const res = stdout;
		const lines = res.split('\r\n');
		const hwnds = [];
		const names = [];
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].indexOf('.hwnd' + String.fromCharCode(1)) >= 0) {
				const hwnd = lines[i].split(String.fromCharCode(1))[1].replace('\r', '');
				hwnds.push(hwnd);
			}
			else if (lines[i].indexOf('.name' + String.fromCharCode(1)) >= 0) {
				const name = lines[i].split(String.fromCharCode(1))[1].replace('\r', '');
				names.push(name);
			}
		}
		const dt2 = new Date().toISOString().replace(/[T.:]/g, '-').replace(/Z/, '');
		const path2 = `${saoridir}log\\sstp_${dt2}_response.txt`;
		fs.writeFile(path2, res, (error) => {
			if (error != null) {
				console.error('ERROR', error);
				return;
			}
		});
		mainWindow.webContents.send('ipc-receive-ghost-info', [names, hwnds]);
	});
});
