const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
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

// ── Update checker ──────────────────────────────────────────────────────────────
const GITHUB_REPO = 'xDerApfelx/NullChat';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

function compareVersions(a, b) {
    // Returns 1 if a > b, -1 if a < b, 0 if equal
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

async function checkForUpdates() {
    try {
        const { net } = require('electron');
        const currentVersion = app.getVersion();

        const response = await net.fetch(RELEASES_API, {
            headers: { 'User-Agent': 'NullChat-Updater' }
        });

        if (!response.ok) return;

        const releases = await response.json();
        if (!releases || !releases.length) return;

        // Filter releases newer than current version
        const newerReleases = releases.filter(r => {
            const tag = r.tag_name || '';
            return compareVersions(tag, currentVersion) > 0;
        });

        if (newerReleases.length === 0) return;

        const latest = newerReleases[0];
        const updateData = {
            latestVersion: latest.tag_name,
            downloadUrl: latest.html_url,
            releases: newerReleases.map(r => ({
                version: r.tag_name,
                name: r.name || r.tag_name,
                body: r.body || 'No changelog provided.',
                date: r.published_at ? new Date(r.published_at).toLocaleDateString() : '',
                url: r.html_url
            }))
        };

        mainWindow.webContents.send('update-available', updateData);
    } catch (err) {
        console.warn('Update check failed:', err.message);
    }
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
        // Check for updates after the window is visible
        checkForUpdates();
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

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('open-external', (_event, url) => {
    shell.openExternal(url);
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
