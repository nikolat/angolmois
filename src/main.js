'use strict';
const { app, ipcMain, BrowserWindow, shell } = require('electron');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

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
	const ifGhost = data[2];
	let mes = ''
        + 'NOTIFY SSTP/1.1\r\n'
        + 'Charset: UTF-8\r\n'
        + 'Sender: angolmois-electron\r\n'
        + 'SecurityLevel: external\r\n'
        + 'Event: OnNostr\r\n'
        + 'Option: nobreak\r\n'
        + 'ReceiverGhostHWnd: ' + hwnd + '\r\n'
        + 'IfGhost: ' + ifGhost + '\r\n'
        + 'Script: ' + script + '\r\n';
    for (let i = 3; i < data.length; i++) {
            mes += 'Reference' + (i - 2) + ': ' + data[i] + '\r\n';
    }


    mes += '\r\n';
	sstp_mes = mes;
	clearTimeout(sstp_id);
	sstp_id = setTimeout(execSSTP, 500);
});

const execSSTP = () => {
    const client = net.connect('9801', '127.0.0.1', () => {
        client.write(sstp_mes);
    });
    client.on('data', data => {
        // do something
        client.destroy();
    });
    client.on('error', error => {
        // 何かエラーメッセージを表示した方がいいけど良い方法が思いつかない
    });
};

//FMOから起動中のゴースト情報を取得
ipcMain.on('ipc-request-ghost-info', (event) => {
	const mes1 = ''
		+ 'EXECUTE SSTP/1.1\r\n'
		+ 'Charset: UTF-8\r\n'
		+ 'SecurityLevel: external\r\n'
		+ 'Command: GetFMO\r\n'
		+ '\r\n';
    const client = net.connect('9801', '127.0.0.1', () => {
        client.write(mes1);
    });
    client.on('data', data => {
		const res = data.toString();
		const lines = res.split('\r\n');
		const hwnds = [];
		const names = [];
		const keronames = [];
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].indexOf('.hwnd' + String.fromCharCode(1)) >= 0) {
				const hwnd = lines[i].split(String.fromCharCode(1))[1].replace('\r', '');
				hwnds.push(hwnd);
			}
			else if (lines[i].indexOf('.name' + String.fromCharCode(1)) >= 0) {
				const name = lines[i].split(String.fromCharCode(1))[1].replace('\r', '');
				names.push(name);
			}
			else if (lines[i].indexOf('.keroname' + String.fromCharCode(1)) >= 0) {
				const keroname = lines[i].split(String.fromCharCode(1))[1].replace('\r', '');
				keronames.push(keroname);
			}
		}
		mainWindow.webContents.send('ipc-receive-ghost-info', [hwnds, names, keronames]);
        client.destroy();
    });
    client.on('error', error => {
        // 何かエラーメッセージを表示した方がいいけど良い方法が思いつかない
    });
});
