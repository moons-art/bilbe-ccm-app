let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
	on(...args) {
		const [channel, listener] = args;
		return electron.ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
	},
	off(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.off(channel, ...omit);
	},
	send(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.send(channel, ...omit);
	},
	invoke(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.invoke(channel, ...omit);
	},
	hymnal: {
		getSettings: () => electron.ipcRenderer.invoke("hymnal:get-settings"),
		saveSettings: (settings) => electron.ipcRenderer.invoke("hymnal:save-settings", settings),
		addAlbum: (album) => electron.ipcRenderer.invoke("hymnal:add-album", album),
		updateAlbum: (album) => electron.ipcRenderer.invoke("hymnal:update-album", album),
		deleteAlbum: (albumId) => electron.ipcRenderer.invoke("hymnal:delete-album", albumId),
		getSongs: () => electron.ipcRenderer.invoke("hymnal:get-songs"),
		selectFolder: () => electron.ipcRenderer.invoke("hymnal:select-folder"),
		processImages: (args) => electron.ipcRenderer.invoke("hymnal:process-images", args),
		onProgress: (callback) => {
			const sub = (_, data) => callback(data);
			electron.ipcRenderer.on("hymnal:process-progress", sub);
			return () => electron.ipcRenderer.off("hymnal:process-progress", sub);
		},
		syncGDrive: (albumId) => electron.ipcRenderer.invoke("hymnal:sync-gdrive", albumId),
		getAuthUrl: () => electron.ipcRenderer.invoke("hymnal:get-auth-url"),
		waitForAuthCode: () => electron.ipcRenderer.invoke("hymnal:wait-for-auth-code"),
		confirmAuth: (code) => electron.ipcRenderer.invoke("hymnal:confirm-auth", code),
		updateSong: (song) => electron.ipcRenderer.invoke("hymnal:update-song", song),
		deleteSong: (songId) => electron.ipcRenderer.invoke("hymnal:delete-song", songId),
		exportCSV: (args) => electron.ipcRenderer.invoke("hymnal:export-csv", args),
		importCSV: () => electron.ipcRenderer.invoke("hymnal:import-csv"),
		openExternal: (url) => electron.ipcRenderer.send("hymnal:open-external", url)
	}
});
//#endregion
