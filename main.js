const { app, BrowserWindow, ipcMain, clipboard, shell, dialog, Notification, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const log = require('./logger');
const chatStore = require('./chatStore');

// ── Platform helper ────────────────────────────────────────────────────────────
function getPlatformInstallerExtension() {
    switch (process.platform) {
        case 'win32': return '.exe';
        case 'darwin': return '.dmg';
        case 'linux': return '.AppImage';
        default: return null;
    }
}

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
let latestInstallerAssetUrl = ''; // Cached download URL for the platform installer
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

        // Find the latest stable installer asset URL for this platform (skip revoked releases)
        const isRevoked = (r) => /^\[revoked\]/i.test((r.name || '').trim());
        const latestStable = releases.find(r => !r.prerelease && !isRevoked(r));
        if (latestStable) {
            const ext = getPlatformInstallerExtension();
            const installerAsset = ext
                ? (latestStable.assets || []).find(a => a.name && a.name.endsWith(ext))
                : null;
            if (installerAsset) {
                latestInstallerAssetUrl = installerAsset.browser_download_url;
                log.info(`Found installer asset: ${installerAsset.name}`);
            }
        }

        const hasUpdate = latestStable && compareVersions(latestStable.tag_name, currentVersion) > 0;
        const settings = loadSettings();

        // Check if user's current version has been revoked
        const currentRevoked = releases.find(r => {
            const tagVersion = r.tag_name.replace(/^v/, '');
            return tagVersion === currentVersion && isRevoked(r);
        });

        // Send ALL releases to renderer for Version History
        const allReleases = releases.map(r => ({
            version: r.tag_name,
            name: r.name || r.tag_name,
            body: r.body || 'No changelog provided.',
            date: r.published_at ? new Date(r.published_at).toLocaleDateString() : '',
            url: r.html_url,
            prerelease: !!r.prerelease,
            revoked: isRevoked(r)
        }));

        if (hasUpdate) {
            log.info(`Update available: ${latestStable.tag_name}`);
        } else {
            log.info('App is up to date');
        }

        if (currentRevoked) {
            log.warn(`Current version ${currentVersion} has been REVOKED`);
        }

        mainWindow.webContents.send('update-available', {
            currentVersion: currentVersion,
            latestVersion: latestStable ? latestStable.tag_name : currentVersion,
            hasUpdate: !!hasUpdate,
            hasInstallerAsset: !!latestInstallerAssetUrl,
            autoUpdate: settings.autoUpdate,
            releases: allReleases,
            isRevoked: !!currentRevoked,
            revokedVersion: currentRevoked ? currentRevoked.tag_name : null,
            recommendedVersion: latestStable ? latestStable.tag_name : null,
            recommendedUrl: latestStable ? latestStable.html_url : null
        });
    } catch (err) {
        log.error(`Update check failed: ${err.message}`);
    }
}

// ── News feed ──────────────────────────────────────────────────────────────────
async function fetchNews() {
    log.info('Fetching news feed...');
    try {
        const { net } = require('electron');
        const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/news.json`;
        const response = await net.fetch(url, {
            headers: { 'User-Agent': 'NullChat-News' }
        });

        if (!response.ok) {
            log.warn(`News fetch HTTP error: ${response.status}`);
            mainWindow.webContents.send('news-data', { items: [] });
            return;
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.items)) {
            log.warn('News feed: invalid format');
            mainWindow.webContents.send('news-data', { items: [] });
            return;
        }

        const now = new Date();
        const items = data.items.filter(item => {
            if (item.expires) {
                try { return new Date(item.expires) > now; } catch (_) { return true; }
            }
            return true;
        });

        log.info(`News feed: ${items.length} item(s) loaded`);
        mainWindow.webContents.send('news-data', { items });
    } catch (err) {
        log.error(`News fetch failed: ${err.message}`);
        mainWindow.webContents.send('news-data', { items: [] });
    }
}

// ── Download update ─────────────────────────────────────────────────────────────
let isDownloading = false;

ipcMain.handle('download-update', async () => {
    if (isDownloading) return { success: false, error: 'Download already in progress' };
    if (!latestInstallerAssetUrl) {
        log.warn('No installer asset URL available');
        return { success: false, error: 'No installer found' };
    }

    isDownloading = true;
    log.info('Starting update download...');
    const { net } = require('electron');

    try {
        const response = await net.fetch(latestInstallerAssetUrl, {
            headers: { 'User-Agent': 'NullChat-Updater' }
        });

        if (!response.ok) {
            log.warn(`Download HTTP error: ${response.status}`);
            isDownloading = false;
            return { success: false, error: `HTTP ${response.status}` };
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const tempDir = app.getPath('temp');
        const fileName = latestInstallerAssetUrl.split('/').pop() || `NullChat-Setup${getPlatformInstallerExtension() || ''}`;
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

    switch (process.platform) {
        case 'win32': {
            const { spawn } = require('child_process');
            spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
            break;
        }
        case 'darwin': {
            shell.openPath(downloadedInstallerPath);
            break;
        }
        case 'linux': {
            fs.chmodSync(downloadedInstallerPath, 0o755);
            const { spawn } = require('child_process');
            spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
            break;
        }
        default:
            log.warn('Unsupported platform for auto-install: ' + process.platform);
            shell.showItemInFolder(downloadedInstallerPath);
            return false;
    }

    app.quit();
    return true;
});

// ── Window bounds persistence ───────────────────────────────────────────────────
const BOUNDS_PATH = path.join(app.getPath('userData'), 'window-bounds.json');
let boundsDebounceId = null;

function loadWindowBounds() {
    try {
        if (fs.existsSync(BOUNDS_PATH)) {
            const bounds = JSON.parse(fs.readFileSync(BOUNDS_PATH, 'utf-8'));
            // Validate that the window is on a visible display
            const displays = screen.getAllDisplays();
            const visible = displays.some(d => {
                const area = d.workArea;
                return bounds.x < area.x + area.width && bounds.x + bounds.width > area.x &&
                       bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
            });
            if (visible && bounds.width >= 480 && bounds.height >= 400) return bounds;
        }
    } catch (_) { }
    return null;
}

function saveWindowBounds() {
    if (!mainWindow || mainWindow.isMinimized() || mainWindow.isMaximized()) return;
    if (boundsDebounceId) clearTimeout(boundsDebounceId);
    boundsDebounceId = setTimeout(() => {
        try {
            const bounds = mainWindow.getBounds();
            fs.writeFileSync(BOUNDS_PATH, JSON.stringify(bounds), 'utf-8');
        } catch (_) { }
    }, 500);
}

// ── Window creation ─────────────────────────────────────────────────────────────
let mainWindow;
let tray = null;
let isQuitting = false;

function createTray() {
    if (tray) return;
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('NullChat');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show NullChat', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

function destroyTray() {
    if (tray) { tray.destroy(); tray = null; }
}

function createWindow() {
    log.info('Creating main window');
    const savedBounds = loadWindowBounds();
    mainWindow = new BrowserWindow({
        width: savedBounds ? savedBounds.width : 900,
        height: savedBounds ? savedBounds.height : 650,
        x: savedBounds ? savedBounds.x : undefined,
        y: savedBounds ? savedBounds.y : undefined,
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

    mainWindow.on('resize', saveWindowBounds);
    mainWindow.on('move', saveWindowBounds);

    if (process.platform !== 'darwin') {
        mainWindow.setMenuBarVisibility(false);
    }
    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        const version = app.getVersion();
        const rootTitle = `NullChat ${version}`;
        mainWindow.setTitle(isDebugInstance ? `${rootTitle} [DEBUG #${debugInstanceId}]` : rootTitle);

        mainWindow.show();
        log.info('Main window visible');
        checkForUpdates();
        fetchNews();
    });

    // Minimize to tray instead of closing (when enabled)
    mainWindow.on('close', (e) => {
        if (!isQuitting && loadSettings().minimizeToTray) {
            e.preventDefault();
            mainWindow.hide();
            if (!tray) createTray();
            log.info('Window hidden to tray');
        }
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
    // Only allow http/https URLs for security
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
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
    ringtoneVolume: 0.25,
    showWelcome: true,
    notificationsEnabled: true,
    notificationSounds: true,
    minimizeToTray: false
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

// Tray toggle — create/destroy tray when setting changes
ipcMain.on('tray-toggle', (_event, enabled) => {
    if (enabled) { createTray(); } else { destroyTray(); }
});

// Renderer log relay — accept anonymous log entries from the renderer process
ipcMain.on('log-from-renderer', (_event, level, message) => {
    if (level === 'error') log.error(`[renderer] ${message}`);
    else if (level === 'warn') log.warn(`[renderer] ${message}`);
    else log.info(`[renderer] ${message}`);
});

// ── Chat persistence IPC handlers ────────────────────────────────────────────────
const userDataPath = app.getPath('userData');

ipcMain.handle('chat-save-message', (_event, friendPeerId, sender, text, msgType) => {
    try {
        return chatStore.saveMessage(userDataPath, cachedUserId, friendPeerId, sender, text, msgType || 'text');
    } catch (err) {
        log.error(`Failed to save chat message: ${err.message}`);
        return null;
    }
});

ipcMain.handle('chat-load-messages', (_event, friendPeerId, limit, beforeId) => {
    try {
        return chatStore.loadMessages(userDataPath, cachedUserId, friendPeerId, limit || 50, beforeId || 0);
    } catch (err) {
        log.error(`Failed to load chat messages: ${err.message}`);
        return [];
    }
});

ipcMain.handle('chat-get-message-count', (_event, friendPeerId) => {
    try {
        return chatStore.getMessageCount(userDataPath, cachedUserId, friendPeerId);
    } catch (err) {
        log.error(`Failed to get message count: ${err.message}`);
        return 0;
    }
});

ipcMain.handle('chat-get-size', (_event, friendPeerId) => {
    try {
        return chatStore.getChatSize(userDataPath, cachedUserId, friendPeerId);
    } catch (err) {
        return 0;
    }
});

ipcMain.handle('chat-delete', (_event, friendPeerId) => {
    try {
        chatStore.deleteChat(userDataPath, cachedUserId, friendPeerId);
        log.info('Chat deleted for peer');
        return true;
    } catch (err) {
        log.error(`Failed to delete chat: ${err.message}`);
        return false;
    }
});

ipcMain.handle('chat-exists', (_event, friendPeerId) => {
    try {
        return chatStore.chatExists(userDataPath, friendPeerId);
    } catch (err) {
        return false;
    }
});

ipcMain.handle('chat-set-recording', (_event, friendPeerId, isRecording) => {
    try {
        chatStore.setRecordingState(userDataPath, cachedUserId, friendPeerId, isRecording);
        return true;
    } catch (err) {
        log.error(`Failed to set recording state: ${err.message}`);
        return false;
    }
});

ipcMain.handle('chat-get-recording', (_event, friendPeerId) => {
    try {
        return chatStore.getRecordingState(userDataPath, cachedUserId, friendPeerId);
    } catch (err) {
        return false;
    }
});

ipcMain.handle('chat-check-cleanup', () => {
    try {
        return chatStore.checkAutoCleanup(userDataPath, cachedUserId);
    } catch (err) {
        log.error(`Auto-cleanup check failed: ${err.message}`);
        return { warnings: [], deleted: [] };
    }
});

ipcMain.handle('chat-search', (_event, friendPeerId, query, limit) => {
    try {
        return chatStore.searchMessages(userDataPath, cachedUserId, friendPeerId, query, limit || 50);
    } catch (err) {
        log.error(`Failed to search chat messages: ${err.message}`);
        return [];
    }
});

ipcMain.handle('chat-list', () => {
    try {
        return chatStore.listChats(userDataPath);
    } catch (err) {
        log.error(`Failed to list chats: ${err.message}`);
        return [];
    }
});

// ── Notification IPC handler ────────────────────────────────────────────────
ipcMain.on('show-notification', (_event, title, body) => {
    if (!Notification.isSupported()) return;
    const n = new Notification({
        title: title || 'NullChat',
        body: body || '',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        silent: true  // Sound is handled by the renderer
    });
    n.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
    n.show();
});

// ── File transfer IPC handlers ──────────────────────────────────────────────
ipcMain.handle('file-open-dialog', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);
    return {
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size
    };
});

ipcMain.handle('file-read', async (_event, filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        return buffer;
    } catch (err) {
        log.error(`Failed to read file: ${err.message}`);
        return null;
    }
});

ipcMain.handle('file-save-as', async (_event, fileName, buffer) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName
    });
    if (result.canceled || !result.filePath) return null;
    try {
        fs.writeFileSync(result.filePath, Buffer.from(buffer));
        log.info(`File saved: ${result.filePath}`);
        return result.filePath;
    } catch (err) {
        log.error(`Failed to save file: ${err.message}`);
        return null;
    }
});

// ── App lifecycle ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    chatStore.initMasterKey(app.getPath('userData'));
    log.info('Chat persistence master key initialized');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        log.shutdown();
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    destroyTray();
    chatStore.closeAll();
    log.shutdown();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
