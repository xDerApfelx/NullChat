const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const log = require('./logger');

// ── Debug Mode Setup ────────────────────────────────────────────────────────────
const debugArg = process.argv.find(a => a.startsWith('--debug-instance'));
const isDebugInstance = !!debugArg;
let debugInstanceId = 1;
if (isDebugInstance) {
    // Parse instance ID from --debug-instance=N (default: 1)
    const match = debugArg.match(/=(\d+)/);
    if (match) debugInstanceId = parseInt(match[1], 10);
    const debugPath = path.join(app.getPath('userData'), `debug-instance-${debugInstanceId}`);
    if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
    }
    app.setPath('userData', debugPath);
}

// ── Initialise logger early ─────────────────────────────────────────────────────
log.init(app.getPath('userData'));
log.installCrashHandlers();
log.info(`App starting (v${app.getVersion()}) ${isDebugInstance ? '[DEBUG INSTANCE]' : ''}`);

// ── Config helpers ──────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadOrCreateUserId() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            if (data.userId) {
                log.info('User ID loaded from config');
                return data.userId;
            }
        }
    } catch (_) {
        log.warn('Config file corrupted, regenerating user ID');
    }
    const userId = uuidv4();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ userId }), 'utf-8');
    log.info('New user ID generated');
    return userId;
}

// ── Update checker ──────────────────────────────────────────────────────────────
const GITHUB_REPO = 'xDerApfelx/NullChat';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

function compareVersions(a, b) {
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
    log.info('Checking for updates...');
    try {
        const { net } = require('electron');
        const currentVersion = app.getVersion();

        const response = await net.fetch(RELEASES_API, {
            headers: { 'User-Agent': 'NullChat-Updater' }
        });

        if (!response.ok) {
            log.warn(`Update check HTTP error: ${response.status}`);
            return;
        }

        const releases = await response.json();
        if (!releases || !releases.length) {
            log.info('No releases found on GitHub');
            return;
        }

        const newerReleases = releases.filter(r => {
            const tag = r.tag_name || '';
            return compareVersions(tag, currentVersion) > 0;
        });

        if (newerReleases.length === 0) {
            log.info('App is up to date');
            return;
        }

        log.info(`Update available: ${newerReleases[0].tag_name} (${newerReleases.length} newer release(s))`);

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
        log.error(`Update check failed: ${err.message}`);
    }
}

// ── Window creation ─────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
    log.info('Creating main window');
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
        const version = app.getVersion();
        const rootTitle = `NullChat ${version}`;
        mainWindow.setTitle(isDebugInstance ? `${rootTitle} [DEBUG #${debugInstanceId}]` : rootTitle);

        mainWindow.show();
        log.info('Main window visible');
        checkForUpdates();
    });

    mainWindow.on('closed', () => {
        log.info('Main window closed');
        mainWindow = null;
    });
}

// ── IPC handlers ────────────────────────────────────────────────────────────────
// Cache user ID at startup (avoid re-reading config on every IPC call)
const cachedUserId = loadOrCreateUserId();

ipcMain.handle('get-user-id', () => {
    return cachedUserId;
});

ipcMain.handle('copy-to-clipboard', (_event, text) => {
    clipboard.writeText(text);
    log.info('ID copied to clipboard');
    return true;
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('open-external', (_event, url) => {
    // Only allow GitHub URLs for security
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
        log.info('Opening external URL in browser');
        shell.openExternal(url);
    } else {
        log.warn('Blocked external URL: ' + url);
    }
    return true;
});

// ── Friends list persistence ────────────────────────────────────────────────────
const FRIENDS_PATH = path.join(app.getPath('userData'), 'friends.json');

ipcMain.handle('get-friends', () => {
    try {
        if (fs.existsSync(FRIENDS_PATH)) {
            return JSON.parse(fs.readFileSync(FRIENDS_PATH, 'utf-8'));
        }
    } catch (_) {
        log.warn('Friends file corrupted, returning empty list');
    }
    return { sidebarOpen: true, friends: [] };
});

ipcMain.handle('save-friends', (_event, data) => {
    try {
        fs.writeFileSync(FRIENDS_PATH, JSON.stringify(data, null, 2), 'utf-8');
        log.info('Friends list saved');
        return true;
    } catch (err) {
        log.error('Failed to save friends: ' + err.message);
        return false;
    }
});

// Renderer log relay — accept anonymous log entries from the renderer process
ipcMain.on('log-from-renderer', (_event, level, message) => {
    if (level === 'error') log.error(`[renderer] ${message}`);
    else if (level === 'warn') log.warn(`[renderer] ${message}`);
    else log.info(`[renderer] ${message}`);
});

// ── App lifecycle ───────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        log.shutdown();
        app.quit();
    }
});

app.on('before-quit', () => {
    log.shutdown();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
