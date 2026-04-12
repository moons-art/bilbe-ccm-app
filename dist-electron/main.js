import { BrowserWindow, Menu, Tray, app, dialog, nativeImage, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
//#region electron/main.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var BIBLE_DATA_PATH = app.isPackaged ? path.join(process.resourcesPath, "public/data") : path.join(process.env.APP_ROOT, "public/data");
console.log("[Main] Bible Data Path:", BIBLE_DATA_PATH);
var win = null;
var localServer = null;
var tray = null;
var hymnalLogic = null;
var FIXED_PORT = 8080;
var lastProgress = {
	processed: 0,
	total: 0
};
async function initHymnalDir() {
	const hymnalDir = path.join(app.getPath("userData"), "hymnal");
	const imagesDir = path.join(hymnalDir, "hymnal_images");
	const dbPath = path.join(hymnalDir, "music_data.json");
	const contisPath = path.join(hymnalDir, "saved_contis.json");
	const settingsPath = path.join(hymnalDir, "settings.json");
	if (!fs.existsSync(hymnalDir)) fs.mkdirSync(hymnalDir, { recursive: true });
	if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
	if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, "[]", "utf8");
	if (!fs.existsSync(contisPath)) fs.writeFileSync(contisPath, "[]", "utf8");
	if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, "{}", "utf8");
	if (hymnalLogic && typeof hymnalLogic.seedInitialData === "function") {
		const result = await hymnalLogic.seedInitialData();
		if (result.success && result.count) console.log(`[Init] Seeded ${result.count} songs to built-in DB.`);
	}
}
async function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		show: true,
		icon: path.join(process.env.VITE_PUBLIC || path.join(__dirname, "../public"), "icon.png"),
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			webSecurity: true,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	win.webContents.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
	const { registerHymnalIPC } = await import("./hymnalIPC-CHqbKHLp.js");
	registerHymnalIPC(win);
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadURL(`http://localhost:${FIXED_PORT}/index.html`);
}
function createTray() {
	const iconPath = path.join(process.env.VITE_PUBLIC || path.join(__dirname, "../public"), "icon.png");
	tray = new Tray(nativeImage.createFromPath(iconPath).resize({
		width: 16,
		height: 16
	}));
	const contextMenu = Menu.buildFromTemplate([
		{
			label: "찬양 브라우저 열기",
			click: () => shell.openExternal(`http://localhost:${FIXED_PORT}`)
		},
		{
			label: "관리 창 열기 (Electron)",
			click: () => {
				if (win) win.show();
				else createWindow().then(() => win?.show());
			}
		},
		{ type: "separator" },
		{
			label: "종료",
			click: () => {
				app.isQuitting = true;
				app.quit();
			}
		}
	]);
	tray.setToolTip("ceum 성경CCM");
	tray.setContextMenu(contextMenu);
	tray.on("click", () => {
		shell.openExternal(`http://localhost:${FIXED_PORT}`);
	});
}
function startLocalServer() {
	return new Promise((resolve) => {
		localServer = http.createServer(async (req, res) => {
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			if (req.method === "OPTIONS") {
				res.writeHead(204);
				res.end();
				return;
			}
			let urlPath = decodeURIComponent(req.url || "/").split("?")[0];
			if (urlPath.startsWith("/api/")) {
				const action = urlPath.replace("/api/", "");
				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});
				req.on("end", async () => {
					try {
						const parsedBody = body ? JSON.parse(body) : {};
						let result = { error: "Unknown action" };
						if (action === "get-songs") result = await hymnalLogic.getSongs();
						else if (action === "get-settings") result = await hymnalLogic.getSettings();
						else if (action === "save-settings") result = await hymnalLogic.saveSettings(parsedBody);
						else if (action === "get-saved-contis") result = await hymnalLogic.getSavedContis();
						else if (action === "save-conti") result = await hymnalLogic.saveConti(parsedBody);
						else if (action === "delete-saved-conti") result = await hymnalLogic.deleteSavedConti(parsedBody.id);
						else if (action === "add-album") result = await hymnalLogic.addAlbum(parsedBody);
						else if (action === "update-album") result = await hymnalLogic.updateAlbum(parsedBody);
						else if (action === "delete-album") result = await hymnalLogic.deleteAlbum(parsedBody.id);
						else if (action === "update-song") result = await hymnalLogic.updateSong(parsedBody);
						else if (action === "delete-song") result = await hymnalLogic.deleteSong(parsedBody);
						else if (action === "process-images") {
							lastProgress = {
								processed: 0,
								total: parsedBody.total || 100
							};
							result = await hymnalLogic.processImages(parsedBody, (p) => {
								lastProgress = p;
							});
						} else if (action === "sync-gdrive") {
							lastProgress = {
								processed: 0,
								total: 100
							};
							result = await hymnalLogic.syncGDrive(parsedBody.albumId, (p) => {
								lastProgress = p;
							});
						} else if (action === "get-progress") result = lastProgress;
						else if (action === "get-auth-url") result = { url: await hymnalLogic.getAuthUrl() };
						else if (action === "confirm-auth") result = await hymnalLogic.confirmAuth(parsedBody.code);
						else if (action === "open-external") {
							hymnalLogic.openExternal(parsedBody.url);
							result = { success: true };
						} else if (action === "select-folder") {
							app.focus({ steal: true });
							const dialogResult = await dialog.showOpenDialog({
								properties: ["openDirectory"],
								title: "앨범 이미지 폴더 선택"
							});
							result = { path: dialogResult.filePaths && dialogResult.filePaths.length > 0 ? dialogResult.filePaths[0] : null };
						} else if (action === "resize-window") {
							if (win) {
								const { width, height } = parsedBody;
								if (width && height) {
									win.setSize(width, height, true);
									result = { success: true };
								}
							}
						} else console.log("Unknown API action requested:", action);
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify(result));
					} catch (err) {
						res.writeHead(500);
						res.end(JSON.stringify({ error: err.message }));
					}
				});
				return;
			}
			if (urlPath.startsWith("/resource/")) {
				let fileName = urlPath.replace("/resource/", "");
				fileName = fileName.replace("hymnal_images/", "");
				const filePath = path.join(app.getPath("userData"), "hymnal", "hymnal_images", fileName);
				fs.readFile(filePath, (err, data) => {
					if (err) {
						res.writeHead(404);
						res.end("Resource Not Found");
						return;
					}
					res.writeHead(200, { "Content-Type": "image/webp" });
					res.end(data);
				});
				return;
			}
			if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
			const relativePath = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
			if (urlPath.startsWith("/data/")) {
				const bibleFileName = path.basename(urlPath);
				const bibleFilePath = path.join(BIBLE_DATA_PATH, bibleFileName);
				console.log(`[Main] Serving Bible File: ${bibleFileName} from ${bibleFilePath}`);
				fs.access(bibleFilePath, fs.constants.F_OK, (err) => {
					if (err) {
						console.error(`[Main] Bible File Not Found at: ${bibleFilePath}`);
						res.writeHead(404);
						res.end("Bible File Not Found");
						return;
					}
					fs.readFile(bibleFilePath, (err, data) => {
						if (err) {
							console.error(`[Main] Error reading bible file: ${err.message}`);
							res.writeHead(500);
							res.end("Error reading bible file");
							return;
						}
						res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
						res.end(data);
					});
				});
				return;
			}
			const filePath = path.join(RENDERER_DIST, relativePath);
			fs.access(filePath, fs.constants.F_OK, (err) => {
				const finalPath = err ? path.join(RENDERER_DIST, "index.html") : filePath;
				fs.readFile(finalPath, (err, data) => {
					if (err) {
						res.writeHead(404);
						res.end("Not Found");
						return;
					}
					const ext = path.extname(finalPath).toLowerCase();
					const mimeTypes = {
						".html": "text/html",
						".js": "text/javascript",
						".mjs": "text/javascript",
						".css": "text/css",
						".json": "application/json",
						".png": "image/png",
						".jpg": "image/jpeg",
						".jpeg": "image/jpeg",
						".gif": "image/gif",
						".svg": "image/svg+xml",
						".woff": "font/woff",
						".woff2": "font/woff2",
						".ttf": "font/ttf",
						".wasm": "application/wasm",
						".txt": "text/plain"
					};
					res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
					res.end(data);
				});
			});
		});
		localServer.listen(FIXED_PORT, "0.0.0.0", () => {
			console.log(`Local server running at http://localhost:${FIXED_PORT}`);
			resolve(FIXED_PORT);
		});
	});
}
app.whenReady().then(async () => {
	const { createHymnalLogic } = await import("./hymnalIPC-CHqbKHLp.js");
	hymnalLogic = createHymnalLogic();
	await initHymnalDir();
	await startLocalServer();
	createTray();
	createWindow();
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {}
});
app.on("activate", () => {});
app.on("before-quit", () => {
	if (localServer) localServer.close();
});
//#endregion
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
