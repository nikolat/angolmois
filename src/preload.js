const { contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld(
	"api", {
		RequestGhostInfo: () => ipcRenderer.send("ipc-request-ghost-info"),
		SendSSTP: (arg) => ipcRenderer.send("ipc-SSTP-send", arg),
		ReceiveGhostInfo: (listener) => {
			ipcRenderer.on("ipc-receive-ghost-info", (event, arg) => listener(arg));
		}
	},
);
