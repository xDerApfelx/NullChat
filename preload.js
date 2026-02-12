const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getUserId: () => ipcRenderer.invoke('get-user-id'),
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text)
});
