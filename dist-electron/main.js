import { BrowserWindow as e, Menu as t, Tray as n, app as r, dialog as i, nativeImage as a, shell as o } from "electron";
import { fileURLToPath as s } from "node:url";
import c from "node:path";
import l from "node:fs";
import u from "node:http";
//#region electron/main.ts
var d = c.dirname(s(import.meta.url));
process.env.APP_ROOT = c.join(d, "..");
var f = process.env.VITE_DEV_SERVER_URL, p = c.join(process.env.APP_ROOT, "dist-electron"), m = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = f ? c.join(process.env.APP_ROOT, "public") : m;
var h = r.isPackaged ? c.join(process.resourcesPath, "public/data") : c.join(process.env.APP_ROOT, "public/data");
r.requestSingleInstanceLock() ? r.on("second-instance", () => {
	g && (g.isMinimized() && g.restore(), g.focus());
}) : r.quit(), console.log("[Main] Bible Data Path:", h);
var g = null, _ = null, v = null, y = null, b = 8080, x = {
	processed: 0,
	total: 0
};
async function S() {
	let e = c.join(r.getPath("userData"), "hymnal"), t = c.join(e, "hymnal_images"), n = c.join(e, "music_data.json"), i = c.join(e, "saved_contis.json"), a = c.join(e, "settings.json");
	if (l.existsSync(e) || l.mkdirSync(e, { recursive: !0 }), l.existsSync(t) || l.mkdirSync(t, { recursive: !0 }), l.existsSync(n) || l.writeFileSync(n, "[]", "utf8"), l.existsSync(i) || l.writeFileSync(i, "[]", "utf8"), l.existsSync(a) || l.writeFileSync(a, "{}", "utf8"), y && typeof y.seedInitialData == "function") {
		let e = await y.seedInitialData();
		e.success && e.count && console.log(`[Init] Seeded ${e.count} songs to built-in DB.`);
	}
}
async function C() {
	g = new e({
		width: 1200,
		height: 800,
		show: !0,
		icon: c.join(process.env.VITE_PUBLIC || c.join(d, "../public"), "icon.png"),
		webPreferences: {
			preload: c.join(d, "preload.mjs"),
			webSecurity: !0,
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), g.webContents.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
	let { registerHymnalIPC: t } = await import("./hymnalIPC-DoFh5nsz.js");
	t(g), f ? g.loadURL(f) : g.loadURL(`http://localhost:${b}/index.html`);
}
function w() {
	let e = c.join(process.env.VITE_PUBLIC || c.join(d, "../public"), "icon.png");
	v = new n(a.createFromPath(e).resize({
		width: 16,
		height: 16
	}));
	let i = t.buildFromTemplate([
		{
			label: "찬양 브라우저 열기",
			click: () => o.openExternal(`http://localhost:${b}`)
		},
		{
			label: "관리 창 열기 (Electron)",
			click: () => {
				g ? g.show() : C().then(() => g?.show());
			}
		},
		{ type: "separator" },
		{
			label: "종료",
			click: () => {
				r.isQuitting = !0, r.quit();
			}
		}
	]);
	v.setToolTip("ceum 성경CCM"), v.setContextMenu(i), v.on("click", () => {
		o.openExternal(`http://localhost:${b}`);
	});
}
function T() {
	return new Promise((e) => {
		_ = u.createServer(async (e, t) => {
			if (t.setHeader("Access-Control-Allow-Origin", "*"), t.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE"), t.setHeader("Access-Control-Allow-Headers", "Content-Type"), e.method === "OPTIONS") {
				t.writeHead(204), t.end();
				return;
			}
			let n = decodeURIComponent(e.url || "/").split("?")[0];
			if (n.startsWith("/api/")) {
				let a = n.replace("/api/", ""), o = "";
				e.on("data", (e) => {
					o += e;
				}), e.on("end", async () => {
					try {
						let e = o ? JSON.parse(o) : {}, n = { error: "Unknown action" };
						if (a === "get-songs") n = await y.getSongs();
						else if (a === "get-settings") n = await y.getSettings();
						else if (a === "save-settings") n = await y.saveSettings(e);
						else if (a === "get-saved-contis") n = await y.getSavedContis();
						else if (a === "save-conti") n = await y.saveConti(e);
						else if (a === "delete-saved-conti") n = await y.deleteSavedConti(e.id);
						else if (a === "add-album") n = await y.addAlbum(e);
						else if (a === "update-album") n = await y.updateAlbum(e);
						else if (a === "delete-album") n = await y.deleteAlbum(e.id);
						else if (a === "update-song") n = await y.updateSong(e);
						else if (a === "delete-song") n = await y.deleteSong(e);
						else if (a === "process-images") x = {
							processed: 0,
							total: e.total || 100
						}, n = await y.processImages(e, (e) => {
							x = e;
						});
						else if (a === "sync-gdrive") x = {
							processed: 0,
							total: 100
						}, n = await y.syncGDrive(e.albumId, (e) => {
							x = e;
						});
						else if (a === "get-progress") n = x;
						else if (a === "get-auth-url") n = { url: await y.getAuthUrl() };
						else if (a === "confirm-auth") n = await y.confirmAuth(e.code);
						else if (a === "open-external") y.openExternal(e.url), n = { success: !0 };
						else if (a === "select-folder") {
							r.focus({ steal: !0 });
							let e = await i.showOpenDialog({
								properties: ["openDirectory"],
								title: "앨범 이미지 폴더 선택"
							});
							n = { path: e.filePaths && e.filePaths.length > 0 ? e.filePaths[0] : null };
						} else if (a === "resize-window") {
							if (g) {
								let { width: t, height: r } = e;
								t && r && (g.setSize(t, r, !0), n = { success: !0 });
							}
						} else console.log("Unknown API action requested:", a);
						t.writeHead(200, { "Content-Type": "application/json" }), t.end(JSON.stringify(n));
					} catch (e) {
						t.writeHead(500), t.end(JSON.stringify({ error: e.message }));
					}
				});
				return;
			}
			if (n.startsWith("/resource/")) {
				let e = n.replace("/resource/", "");
				e = e.replace("hymnal_images/", "");
				let i = c.join(r.getPath("userData"), "hymnal", "hymnal_images", e);
				l.readFile(i, (e, n) => {
					if (e) {
						t.writeHead(404), t.end("Resource Not Found");
						return;
					}
					t.writeHead(200, { "Content-Type": "image/webp" }), t.end(n);
				});
				return;
			}
			(n === "/" || n === "") && (n = "/index.html");
			let a = n.startsWith("/") ? n.slice(1) : n;
			if (n.startsWith("/data/")) {
				let e = c.basename(n), r = c.join(h, e);
				console.log(`[Main] Serving Bible File: ${e} from ${r}`), l.access(r, l.constants.F_OK, (e) => {
					if (e) {
						console.error(`[Main] Bible File Not Found at: ${r}`), t.writeHead(404), t.end("Bible File Not Found");
						return;
					}
					l.readFile(r, (e, n) => {
						if (e) {
							console.error(`[Main] Error reading bible file: ${e.message}`), t.writeHead(500), t.end("Error reading bible file");
							return;
						}
						t.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }), t.end(n);
					});
				});
				return;
			}
			let o = c.join(m, a);
			l.access(o, l.constants.F_OK, (e) => {
				let n = e ? c.join(m, "index.html") : o;
				l.readFile(n, (e, r) => {
					if (e) {
						t.writeHead(404), t.end("Not Found");
						return;
					}
					let i = c.extname(n).toLowerCase(), a = {
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
					t.writeHead(200, { "Content-Type": a[i] || "application/octet-stream" }), t.end(r);
				});
			});
		}), _.on("error", (e) => {
			if (e.code === "EADDRINUSE") {
				let e = `포트 ${b}가 이미 사용 중입니다.\n\n앱이 이미 실행 중이거나 다른 프로그램이 해당 포트를 쓰고 있습니다.\n기존 앱을 종료하거나 컴퓨터를 재부팅 후 다시 시도해 주세요.`;
				i.showErrorBox("서버 구동 실패", e), r.quit();
			} else i.showErrorBox("서버 오류", `서버 구동 중 예기치 못한 오류가 발생했습니다: ${e.message}`);
		}), _.listen(b, "0.0.0.0", () => {
			console.log(`Local server running at http://localhost:${b}`), e(b);
		});
	});
}
r.whenReady().then(async () => {
	let { createHymnalLogic: e } = await import("./hymnalIPC-DoFh5nsz.js");
	y = e(), await S(), await T(), w(), C();
}), r.on("window-all-closed", () => {
	process.platform;
}), r.on("activate", () => {}), r.on("before-quit", () => {
	_ && _.close();
});
//#endregion
export { p as MAIN_DIST, m as RENDERER_DIST, f as VITE_DEV_SERVER_URL };
