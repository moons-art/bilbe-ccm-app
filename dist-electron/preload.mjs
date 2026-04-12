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
		openExternal: (url) => electron.ipcRenderer.send("hymnal:open-external", url),
		generateSlides: (args) => electron.ipcRenderer.invoke("hymnal:generate-slides", args),
		onSlidesProgress: (callback) => {
			const listener = (_, data) => callback(data);
			electron.ipcRenderer.on("hymnal:slides-progress", listener);
			return () => electron.ipcRenderer.removeListener("hymnal:slides-progress", listener);
		},
		generatePDF: (args) => electron.ipcRenderer.invoke("hymnal:generate-pdf", args),
		onPDFProgress: (callback) => {
			const listener = (_, data) => callback(data);
			electron.ipcRenderer.on("hymnal:pdf-progress", listener);
			return () => electron.ipcRenderer.removeListener("hymnal:pdf-progress", listener);
		},
		getSavedContis: () => electron.ipcRenderer.invoke("hymnal:get-saved-contis"),
		saveConti: (conti) => electron.ipcRenderer.invoke("hymnal:save-conti", conti),
		deleteSavedConti: (id) => electron.ipcRenderer.invoke("hymnal:delete-saved-conti", id),
		resizeWindow: (width, height) => electron.ipcRenderer.send("hymnal:resize-window", {
			width,
			height
		}),
		writeClipboard: (text) => electron.ipcRenderer.send("hymnal:write-clipboard", text)
	}
});
//#endregion
