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

// ── Update system ───────────────────────────────────────────────────────────────
const GITHUB_REPO = 'xDerApfelx/NullChat';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
let latestExeAssetUrl = ''; // Cached download URL for the latest .exe
let downloadedInstallerPath = ''; // Path to downloaded installer

function compareVersions(a, b) {
    const cleanA = a.replace(/^v/, '');
    const cleanB = b.replace(/^v/, '');
    const coreA = cleanA.replace(/-.*$/, '').split('.').map(Number);
    const coreB = cleanB.replace(/-.*$/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((coreA[i] || 0) > (coreB[i] || 0)) return 1;
        if ((coreA[i] || 0) < (coreB[i] || 0)) return -1;
    }
    // Same core version: pre-release < stable (e.g. 2.0.0-beta.1 < 2.0.0)
    const preA = cleanA.includes('-');
    const preB = cleanB.includes('-');
    if (preA && !preB) return -1;
    if (!preA && preB) return 1;
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

        // Find the latest stable .exe asset URL
        const latestStable = releases.find(r => !r.prerelease);
        if (latestStable) {
            const exeAsset = (latestStable.assets || []).find(a => a.name && a.name.endsWith('.exe'));
            if (exeAsset) {
                latestExeAssetUrl = exeAsset.browser_download_url;
                log.info(`Found installer asset: ${exeAsset.name}`);
            }
        }

        const hasUpdate = latestStable && compareVersions(latestStable.tag_name, currentVersion) > 0;
        const settings = loadSettings();

        // Send ALL releases to renderer for Version History
        const allReleases = releases.map(r => ({
            version: r.tag_name,
            name: r.name || r.tag_name,
            body: r.body || 'No changelog provided.',
            date: r.published_at ? new Date(r.published_at).toLocaleDateString() : '',
            url: r.html_url,
            prerelease: !!r.prerelease
        }));

        if (hasUpdate) {
            log.info(`Update available: ${latestStable.tag_name}`);
        } else {
            log.info('App is up to date');
        }

        mainWindow.webContents.send('update-available', {
            currentVersion: currentVersion,
            latestVersion: latestStable ? latestStable.tag_name : currentVersion,
            hasUpdate: !!hasUpdate,
            hasExeAsset: !!latestExeAssetUrl,
            autoUpdate: settings.autoUpdate,
            releases: allReleases
        });
    } catch (err) {
        log.error(`Update check failed: ${err.message}`);
    }
}

// ── Download update ─────────────────────────────────────────────────────────────
let isDownloading = false;

ipcMain.handle('download-update', async () => {
    if (isDownloading) return { success: false, error: 'Download already in progress' };
    if (!latestExeAssetUrl) {
        log.warn('No installer asset URL available');
        return { success: false, error: 'No installer found' };
    }

    isDownloading = true;
    log.info('Starting update download...');
    const { net } = require('electron');

    try {
        const response = await net.fetch(latestExeAssetUrl, {
            headers: { 'User-Agent': 'NullChat-Updater' }
        });

        if (!response.ok) {
            log.warn(`Download HTTP error: ${response.status}`);
            isDownloading = false;
            return { success: false, error: `HTTP ${response.status}` };
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const tempDir = app.getPath('temp');
        const fileName = latestExeAssetUrl.split('/').pop() || 'NullChat-Setup.exe';
        downloadedInstallerPath = path.join(tempDir, fileName);

        const fileStream = fs.createWriteStream(downloadedInstallerPath);
        let downloaded = 0;

        // Handle disk errors (e.g. disk full, permission denied)
        fileStream.on('error', (err) => {
            log.error(`File write error: ${err.message}`);
        });

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fileStream.write(Buffer.from(value));
            downloaded += value.byteLength;

            if (contentLength > 0) {
                const percent = Math.round((downloaded / contentLength) * 100);
                if (mainWindow) {
                    mainWindow.webContents.send('download-progress', { percent });
                }
            }
        }

        fileStream.end();
        await new Promise(resolve => fileStream.on('finish', resolve));

        log.info(`Update downloaded to: ${downloadedInstallerPath}`);
        isDownloading = false;
        return { success: true };
    } catch (err) {
        log.error(`Update download failed: ${err.message}`);
        isDownloading = false;
        return { success: false, error: err.message };
    }
});

ipcMain.handle('install-update', () => {
    if (!downloadedInstallerPath || !fs.existsSync(downloadedInstallerPath)) {
        log.warn('No downloaded installer found');
        return false;
    }

    log.info('Launching installer and quitting...');
    const { spawn } = require('child_process');
    spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
    return true;
});

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

// ── Settings persistence ────────────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_SETTINGS = {
    autoUpdate: true,
    micDeviceId: '',
    speakerDeviceId: '',
    micGain: 1.0,
    noiseSuppression: true,
    vadEnabled: true,
    vadThreshold: 0.015,
    ringtoneVolume: 0.25
};

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) };
        }
    } catch (_) {
        log.warn('Settings file corrupted, using defaults');
    }
    return { ...DEFAULT_SETTINGS };
}

ipcMain.handle('get-settings', () => {
    return loadSettings();
});

ipcMain.handle('save-settings', (_event, data) => {
    try {
        const current = loadSettings();
        const merged = { ...current, ...data };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
        log.info('Settings saved');
        return true;
    } catch (err) {
        log.error('Failed to save settings: ' + err.message);
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
