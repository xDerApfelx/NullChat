// ── DOM Elements ────────────────────────────────────────────────────────────────
const loginView = document.getElementById('login-view');
const chatView = document.getElementById('chat-view');
const myIdEl = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-btn');
const friendIdInput = document.getElementById('friend-id-input');
const connectBtn = document.getElementById('connect-btn');
const statusText = document.getElementById('status-text');
const chatMessages = document.getElementById('chat-messages');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const muteBtn = document.getElementById('mute-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const peerAvatar = document.getElementById('peer-avatar');
const peerName = document.getElementById('peer-name');
const toastEl = document.getElementById('toast');

// ── State ───────────────────────────────────────────────────────────────────────
let peer = null;
let conn = null;
let localStream = null;
let activeCall = null;
let myId = '';
let isMuted = false;

// ── Anonymous logger shorthand ──────────────────────────────────────────────────
const rlog = {
    info: (msg) => window.electronAPI.log('info', msg),
    warn: (msg) => window.electronAPI.log('warn', msg),
    error: (msg) => window.electronAPI.log('error', msg)
};

// ── Toast helper ────────────────────────────────────────────────────────────────
function showToast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { toastEl.className = 'toast'; }, 3500);
}

// ── Time helper ─────────────────────────────────────────────────────────────────
function timestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── DOM: add a chat message ─────────────────────────────────────────────────────
function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = 'message ' + sender; // 'self' or 'friend'

    const content = document.createTextNode(text);
    div.appendChild(content);

    const time = document.createElement('span');
    time.className = 'timestamp';
    time.textContent = timestamp();
    div.appendChild(time);

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── View switching ──────────────────────────────────────────────────────────────
function showChat(friendId) {
    const short = friendId.substring(0, 8);
    peerAvatar.textContent = short[0].toUpperCase();
    peerName.textContent = short + '…';

    loginView.style.display = 'none';
    chatView.style.display = 'flex';

    addSystemMessage('Connected to ' + friendId);
    msgInput.focus();
}

function showLogin() {
    chatView.style.display = 'none';
    loginView.style.display = 'flex';
    chatMessages.innerHTML = '';
    statusText.textContent = '';
    statusText.className = 'status-text';
    connectBtn.disabled = false;
    friendIdInput.value = '';
    isMuted = false;
    muteBtn.textContent = '🎤 Mute';
    muteBtn.classList.remove('muted');
}

// ── Voice call helpers ──────────────────────────────────────────────────────────
async function getLocalAudio() {
    if (localStream) return localStream;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return localStream;
    } catch (err) {
        console.warn('Microphone access denied:', err);
        showToast('Microphone access denied — voice disabled', 'error');
        rlog.warn('Microphone access denied');
        return null;
    }
}

function playRemoteStream(stream) {
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play().catch(() => { });
}

async function initiateVoiceCall(friendId) {
    const stream = await getLocalAudio();
    if (!stream) return;

    activeCall = peer.call(friendId, stream);
    activeCall.on('stream', playRemoteStream);
    activeCall.on('close', () => { activeCall = null; });
    addSystemMessage('🎤 Voice call active');
    rlog.info('Outgoing voice call started');
}

function answerCall(incomingCall) {
    getLocalAudio().then((stream) => {
        if (!stream) {
            incomingCall.answer(); // answer without stream
        } else {
            incomingCall.answer(stream);
        }
        activeCall = incomingCall;
        activeCall.on('stream', playRemoteStream);
        activeCall.on('close', () => { activeCall = null; });
        addSystemMessage('🎤 Voice call active');
        rlog.info('Incoming voice call answered');
    });
}

// ── Data connection wiring ──────────────────────────────────────────────────────
function wireConnection(dataConn) {
    conn = dataConn;

    conn.on('data', (data) => {
        addMessage(data, 'friend');
        rlog.info('User (friend) sent message');
    });

    conn.on('close', () => {
        addSystemMessage('Peer disconnected.');
        rlog.info('Peer connection closed by remote');
        cleanup();
        showLogin();
        showToast('Peer disconnected', 'error');
    });

    conn.on('error', (err) => {
        console.error('Connection error:', err);
        rlog.error('Connection error: ' + err.type);
        showToast('Connection error: ' + err.message, 'error');
    });
}

// ── Send message ────────────────────────────────────────────────────────────────
function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || !conn || !conn.open) return;
    conn.send(text);
    addMessage(text, 'self');
    rlog.info('User (me) sent message');
    msgInput.value = '';
    msgInput.focus();
}

// ── Cleanup ─────────────────────────────────────────────────────────────────────
function cleanup() {
    if (activeCall) { activeCall.close(); activeCall = null; }
    if (conn) { conn.close(); conn = null; }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
}

// ── Initialize PeerJS ───────────────────────────────────────────────────────────
async function init() {
    // Get persisted user ID from main process
    myId = await window.electronAPI.getUserId();
    myIdEl.textContent = myId;

    peer = new Peer(myId, {
        // Uses default public PeerJS cloud server (0.peerjs.com)
    });

    peer.on('open', (id) => {
        myIdEl.textContent = id;
        statusText.textContent = 'Ready to connect';
        statusText.className = 'status-text success';
        rlog.info('PeerJS connected to signaling server');
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        rlog.error('PeerJS error: ' + err.type);
        if (err.type === 'peer-unavailable') {
            statusText.textContent = 'Peer not found. Check the ID and try again.';
            statusText.className = 'status-text error';
            connectBtn.disabled = false;
        } else if (err.type === 'unavailable-id') {
            statusText.textContent = 'Your ID is busy. Restart the app.';
            statusText.className = 'status-text error';
        } else {
            showToast('Error: ' + err.message, 'error');
        }
    });

    // ── Incoming data connections ──
    peer.on('connection', (incomingConn) => {
        if (conn && conn.open) {
            // Already connected to someone; reject
            incomingConn.close();
            return;
        }

        wireConnection(incomingConn);

        incomingConn.on('open', () => {
            showChat(incomingConn.peer);
            rlog.info('Incoming peer connection established');
        });
    });

    // ── Incoming voice calls ──
    peer.on('call', (incomingCall) => {
        answerCall(incomingCall);
    });
}

// ── Event listeners ─────────────────────────────────────────────────────────────

// Copy ID
copyBtn.addEventListener('click', async () => {
    await window.electronAPI.copyToClipboard(myId);
    copyBtn.textContent = '✓ Copied';
    copyBtn.classList.add('copied');
    setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
    }, 2000);
});

// Connect to friend
connectBtn.addEventListener('click', () => {
    const friendId = friendIdInput.value.trim();
    if (!friendId) {
        statusText.textContent = 'Please enter a friend\'s ID.';
        statusText.className = 'status-text error';
        return;
    }
    if (friendId === myId) {
        statusText.textContent = 'You can\'t connect to yourself!';
        statusText.className = 'status-text error';
        return;
    }
    if (!peer || peer.destroyed) {
        statusText.textContent = 'Peer not ready. Restart app.';
        statusText.className = 'status-text error';
        return;
    }

    connectBtn.disabled = true;
    statusText.textContent = 'Connecting…';
    statusText.className = 'status-text';

    const outgoing = peer.connect(friendId, { reliable: true });

    outgoing.on('open', () => {
        wireConnection(outgoing);
        showChat(friendId);
        rlog.info('Outgoing peer connection established');
        // Also initiate voice call
        initiateVoiceCall(friendId);
    });

    outgoing.on('error', (err) => {
        rlog.error('Outgoing connection failed: ' + err.type);
        statusText.textContent = 'Connection failed: ' + err.message;
        statusText.className = 'status-text error';
        connectBtn.disabled = false;
    });
});

// Allow Enter key to connect
friendIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectBtn.click();
});

// Send message
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Mute / unmute
muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
    muteBtn.textContent = isMuted ? '🔇 Unmute' : '🎤 Mute';
    muteBtn.classList.toggle('muted', isMuted);
    rlog.info(isMuted ? 'Microphone muted' : 'Microphone unmuted');
});

// Disconnect
disconnectBtn.addEventListener('click', () => {
    rlog.info('User disconnected manually');
    cleanup();
    showLogin();
    // Re-initialise peer so we can accept new connections
    init();
    showToast('Disconnected', 'success');
});

// ── Start ───────────────────────────────────────────────────────────────────────
init();

// ── Update notification ─────────────────────────────────────────────────────────
const updateBanner = document.getElementById('update-banner');
const updateVersion = document.getElementById('update-version');
const updateOverlay = document.getElementById('update-overlay');
const updateReleasesEl = document.getElementById('update-releases');
const updateSkipBtn = document.getElementById('update-skip-btn');
const updateDownloadBtn = document.getElementById('update-download-btn');
const currentVersionEl = document.getElementById('current-version');

let updateDownloadUrl = '';

window.electronAPI.onUpdateAvailable(async (data) => {
    // Show banner
    updateVersion.textContent = data.latestVersion;
    updateBanner.style.display = 'block';
    updateDownloadUrl = data.downloadUrl;

    // Set current version
    const currentVer = await window.electronAPI.getAppVersion();
    currentVersionEl.textContent = 'v' + currentVer;

    // Build release list for modal
    updateReleasesEl.innerHTML = '';
    data.releases.forEach(r => {
        const item = document.createElement('div');
        item.className = 'update-release-item';

        const header = document.createElement('div');
        header.className = 'update-release-header';

        const version = document.createElement('span');
        version.className = 'update-release-version';
        version.textContent = r.version;

        const date = document.createElement('span');
        date.className = 'update-release-date';
        date.textContent = r.date;

        header.appendChild(version);
        header.appendChild(date);

        const body = document.createElement('div');
        body.className = 'update-release-body';
        body.textContent = r.body;

        item.appendChild(header);
        item.appendChild(body);
        updateReleasesEl.appendChild(item);
    });
});

// Open modal when banner is clicked
updateBanner.addEventListener('click', () => {
    updateOverlay.style.display = 'flex';
});

// Skip button
updateSkipBtn.addEventListener('click', () => {
    updateOverlay.style.display = 'none';
});

// Download button
updateDownloadBtn.addEventListener('click', () => {
    if (updateDownloadUrl) {
        window.electronAPI.openExternal(updateDownloadUrl);
    }
    updateOverlay.style.display = 'none';
});

// Close modal when clicking outside
updateOverlay.addEventListener('click', (e) => {
    if (e.target === updateOverlay) {
        updateOverlay.style.display = 'none';
    }
});
