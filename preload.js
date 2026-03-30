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

    // File transfer
    fileOpenDialog: () => ipcRenderer.invoke('file-open-dialog'),
    fileRead: (filePath) => ipcRenderer.invoke('file-read', filePath),
    fileSaveAs: (fileName, buffer) => ipcRenderer.invoke('file-save-as', fileName, buffer),

    // Desktop notifications
    showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),

    // Tray toggle
    trayToggle: (enabled) => ipcRenderer.send('tray-toggle', enabled),

    // Anonymous logger relay — sends log entries to the main process
    log: (level, message) => ipcRenderer.send('log-from-renderer', level, message),

    // Chat persistence
    chatSaveMessage: (friendPeerId, sender, text, msgType) =>
        ipcRenderer.invoke('chat-save-message', friendPeerId, sender, text, msgType),
    chatLoadMessages: (friendPeerId, limit, beforeId) =>
        ipcRenderer.invoke('chat-load-messages', friendPeerId, limit, beforeId),
    chatGetMessageCount: (friendPeerId) =>
        ipcRenderer.invoke('chat-get-message-count', friendPeerId),
    chatGetSize: (friendPeerId) =>
        ipcRenderer.invoke('chat-get-size', friendPeerId),
    chatDelete: (friendPeerId) =>
        ipcRenderer.invoke('chat-delete', friendPeerId),
    chatExists: (friendPeerId) =>
        ipcRenderer.invoke('chat-exists', friendPeerId),
    chatSearch: (friendPeerId, query, limit) =>
        ipcRenderer.invoke('chat-search', friendPeerId, query, limit),
    chatSetRecording: (friendPeerId, isRecording) =>
        ipcRenderer.invoke('chat-set-recording', friendPeerId, isRecording),
    chatGetRecording: (friendPeerId) =>
        ipcRenderer.invoke('chat-get-recording', friendPeerId),
    chatCheckCleanup: () =>
        ipcRenderer.invoke('chat-check-cleanup'),
    chatList: () =>
        ipcRenderer.invoke('chat-list')
});
