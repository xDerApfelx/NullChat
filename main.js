const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Config helpers ──────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadOrCreateUserId() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            if (data.userId) return data.userId;
        }
    } catch (_) {
        // corrupted file → regenerate
    }
    const userId = uuidv4();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ userId }), 'utf-8');
    return userId;
}

// ── Window creation ─────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 650,
        minWidth: 480,
        minHeight: 400,
        backgroundColor: '#36393f',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

// ── IPC handlers ────────────────────────────────────────────────────────────────
ipcMain.handle('get-user-id', () => {
    return loadOrCreateUserId();
});

ipcMain.handle('copy-to-clipboard', (_event, text) => {
    clipboard.writeText(text);
    return true;
});

// ── App lifecycle ───────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
