const { app, BrowserWindow, ipcMain, Menu, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { fitZoom, stepUser } = require('./zoom');

const dataFile = () => path.join(app.getPath('userData'), 'habits.json');
const backupDir = () => path.join(app.getPath('userData'), 'backups');
const winFile = () => path.join(app.getPath('userData'), 'window.json');
const pad = (n) => String(n).padStart(2, '0');
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function pruneBackups() {
  try {
    const files = fs.readdirSync(backupDir()).map((f) => ({ f, t: fs.statSync(path.join(backupDir(), f)).mtimeMs }));
    files.sort((a, b) => b.t - a.t).slice(150).forEach((x) => fs.unlinkSync(path.join(backupDir(), x.f)));
  } catch (e) {}
}
function backup(tag) {
  try {
    if (!fs.existsSync(dataFile())) return;
    fs.mkdirSync(backupDir(), { recursive: true });
    const dest = path.join(backupDir(), tag ? `habits-${tag}-${Date.now()}.json` : `habits-${stamp()}.json`);
    if (!tag && fs.existsSync(dest)) return;
    fs.copyFileSync(dataFile(), dest);
    pruneBackups();
  } catch (e) {}
}

ipcMain.on('load', (e) => {
  try { e.returnValue = fs.readFileSync(dataFile(), 'utf8'); } catch (err) { e.returnValue = null; }
});
ipcMain.on('save', (e, json) => {
  try {
    fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
    const tmp = dataFile() + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, dataFile());
  } catch (err) {}
});
ipcMain.on('backup', (e, tag) => backup(String(tag || 'manual').replace(/[^a-z0-9-]/gi, '')));
ipcMain.on('openFolder', () => { shell.openPath(app.getPath('userData')); });
ipcMain.handle('export', async (e, json) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, {
    defaultPath: `habit-tracker-backup-${stamp()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!r.canceled && r.filePath) fs.writeFileSync(r.filePath, json, 'utf8');
});
ipcMain.handle('import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return fs.readFileSync(r.filePaths[0], 'utf8'); } catch (err) { return null; }
});

// remember window size / position between launches (only restored if still on a connected screen)
function loadBounds() {
  const def = { width: 1180, height: 760, zoom: 1 };
  try {
    const b = JSON.parse(fs.readFileSync(winFile(), 'utf8'));
    if (!b || !(b.width >= 760) || !(b.height >= 540)) return def;
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x >= a.x - 20 && b.y >= a.y - 20 && b.x + 120 <= a.x + a.width && b.y + 80 <= a.y + a.height;
    });
    const zoom = b.zoom >= 0.6 && b.zoom <= 1.8 ? b.zoom : 1;
    return visible ? { x: b.x, y: b.y, width: b.width, height: b.height, max: !!b.max, zoom } : { width: b.width, height: b.height, max: !!b.max, zoom };
  } catch (e) { return def; }
}
let userZoom = 1;
function saveBounds(win) {
  try {
    const max = win.isMaximized();
    const b = max ? win.getNormalBounds() : win.getBounds();
    fs.mkdirSync(path.dirname(winFile()), { recursive: true });
    fs.writeFileSync(winFile(), JSON.stringify({ ...b, max, zoom: userZoom }));
  } catch (e) {}
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const b = loadBounds();
  const win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, minWidth: 760, minHeight: 540,
    backgroundColor: '#0b0c0f', title: 'Habit Tracker',
    icon: path.join(__dirname, '..', '..', 'build', 'icon-256.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0c0f', symbolColor: '#8a8e98', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required' // lets the soft completion chime play reliably
    }
  });
  userZoom = b.zoom || 1;
  if (b.max) win.maximize();
  win.on('close', () => saveBounds(win));

  // scale the whole UI to the window so it looks right small, maximised or full screen
  let lastApply = 0, trailing = null;
  const applyZoom = () => {
    if (win.isDestroyed()) return;
    const [w, h] = win.getContentSize();
    win.webContents.setZoomFactor(fitZoom(w, h, userZoom));
    lastApply = Date.now();
  };
  const schedule = () => {                       // throttled while dragging the window edge, always settles at the end
    clearTimeout(trailing);
    if (Date.now() - lastApply > 50) applyZoom();
    trailing = setTimeout(applyZoom, 70);
  };
  ['resize', 'maximize', 'unmaximize', 'restore', 'enter-full-screen', 'leave-full-screen'].forEach((e) => win.on(e, schedule));
  win.webContents.on('dom-ready', applyZoom);
  win.webContents.on('did-finish-load', applyZoom);
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta;
    if (mod && (input.key === '=' || input.key === '+')) { userZoom = stepUser(userZoom, 1); ev.preventDefault(); applyZoom(); }
    else if (mod && input.key === '-') { userZoom = stepUser(userZoom, -1); ev.preventDefault(); applyZoom(); }
    else if (mod && input.key === '0') { userZoom = stepUser(userZoom, 0); ev.preventDefault(); applyZoom(); }
    else if (input.key === 'F11') { ev.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win;
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { backup(); win = createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
