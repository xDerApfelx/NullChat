const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getUserId: () => ipcRenderer.invoke('get-user-id'),
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, data) => callback(data)),

    // Friends list
    getFriends: () => ipcRenderer.invoke('get-friends'),
    saveFriends: (data) => ipcRenderer.invoke('save-friends', data),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

    // Update download
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),

    // Anonymous logger relay — sends log entries to the main process
    log: (level, message) => ipcRenderer.send('log-from-renderer', level, message)
});
