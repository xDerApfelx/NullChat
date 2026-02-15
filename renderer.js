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
const peerNameEl = document.getElementById('peer-name');
const toastEl = document.getElementById('toast');

// Sidebar elements
const friendsSidebar = document.getElementById('friends-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
const friendsListEl = document.getElementById('friends-list');
const friendsEmpty = document.getElementById('friends-empty');
const addFriendBtn = document.getElementById('add-friend-btn');
const sidebarCallHint = document.getElementById('sidebar-call-hint');
const callHintName = document.getElementById('call-hint-name');

// Add Friend Modal elements
const friendOverlay = document.getElementById('friend-overlay');
const friendModalId = document.getElementById('friend-modal-id');
const friendNameInput = document.getElementById('friend-name-input');
const friendSaveBtn = document.getElementById('friend-save-btn');
const friendCancelBtn = document.getElementById('friend-cancel-btn');

// Connection Request Modal elements
const requestOverlay = document.getElementById('request-overlay');
const requestModalName = document.getElementById('request-modal-name');
const requestModalId = document.getElementById('request-modal-id');
const requestAcceptBtn = document.getElementById('request-accept-btn');
const requestDeclineBtn = document.getElementById('request-decline-btn');

// ── Configuration ───────────────────────────────────────────────────────────────
const CALL_TIMEOUT_MS = 90000;  // Auto-dismiss incoming call UI after 30 seconds
const SAVE_DEBOUNCE_MS = 5000;  // Debounce delay for sidebar state saves

// ── State ───────────────────────────────────────────────────────────────────────
let peer = null;
let conn = null;
let localStream = null;
let remoteAudio = null;     // Remote audio element (cleaned up on disconnect)
let activeCall = null;
let myId = '';
let isMuted = false;
let currentPeerId = null;
let friendsData = { sidebarOpen: true, friends: [] };
let pendingConn = null;     // Incoming connection waiting for accept/decline
let ringingPeerId = null;   // Peer ID of the friend currently ringing
let callTimeoutId = null;   // Timer for auto-dismissing unanswered calls
let saveDebounceId = null;  // Timer for debounced friend saves

// ── Anonymous logger shorthand ──────────────────────────────────────────────────
const rlog = {
    info: (msg) => window.electronAPI.log('info', msg),
    warn: (msg) => window.electronAPI.log('warn', msg),
    error: (msg) => window.electronAPI.log('error', msg)
};

// ── Ringtone ────────────────────────────────────────────────────────────────────
const ringtone = new Audio('assets/ringtone.mp3');
ringtone.volume = 0.25;
let ringtoneLoops = 0;

function startRinging() {
    ringtoneLoops = 0;
    ringtone.currentTime = 0;
    ringtone.play().catch(() => { });
}

ringtone.addEventListener('ended', () => {
    ringtoneLoops++;
    if (ringtoneLoops < 2) {
        ringtone.currentTime = 0;
        ringtone.play().catch(() => { });
    }
});

function stopRinging() {
    ringtone.pause();
    ringtone.currentTime = 0;
    ringtoneLoops = 0;
}

// ── Default-mute helper ─────────────────────────────────────────────────────────
function applyDefaultMute() {
    if (localStream) {
        localStream.getAudioTracks().forEach(t => t.enabled = false);
    }
    isMuted = true;
    muteBtn.textContent = '🔇 Unmute';
    muteBtn.classList.add('muted');
}

// ── Sidebar highlight helper ────────────────────────────────────────────────────
function highlightFriend(peerId, active) {
    const items = friendsListEl.querySelectorAll('.friend-item');
    items.forEach(item => {
        if (item.dataset.friendId === peerId) {
            if (active) {
                item.classList.add('ringing');
                // Add phone emoji with shake if not already present
                if (!item.querySelector('.friend-ring-icon')) {
                    const icon = document.createElement('span');
                    icon.className = 'friend-ring-icon';
                    icon.textContent = '📞';
                    item.insertBefore(icon, item.firstChild);
                }
            } else {
                item.classList.remove('ringing');
                const icon = item.querySelector('.friend-ring-icon');
                if (icon) icon.remove();
            }
        }
    });
}

function clearAllRinging() {
    const items = friendsListEl.querySelectorAll('.friend-item.ringing');
    items.forEach(item => {
        item.classList.remove('ringing');
        const icon = item.querySelector('.friend-ring-icon');
        if (icon) icon.remove();
    });
}

// ── Call hint helpers (sidebar collapsed notification) ───────────────────────────
function showCallHint(name) {
    callHintName.textContent = name;
    sidebarCallHint.classList.remove('hidden');
}

function hideCallHint() {
    sidebarCallHint.classList.add('hidden');
    callHintName.textContent = '';
}

function updateCallUI() {
    if (!ringingPeerId) {
        hideCallHint();
        return;
    }
    const name = getFriendName(ringingPeerId) || ringingPeerId.substring(0, 12);
    if (friendsSidebar.classList.contains('collapsed')) {
        // Sidebar closed → show call-hint bar next to expand button
        showCallHint(name);
    } else {
        // Sidebar open → hide call-hint bar (sidebar item pulses instead)
        hideCallHint();
    }
}

function clearCallState() {
    ringingPeerId = null;
    stopRinging();
    clearAllRinging();
    hideCallHint();
    if (callTimeoutId) {
        clearTimeout(callTimeoutId);
        callTimeoutId = null;
    }
}

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

// ── Friends helpers ─────────────────────────────────────────────────────────────
async function loadFriends() {
    friendsData = await window.electronAPI.getFriends();
    renderFriendsList();
    // Restore sidebar state
    if (!friendsData.sidebarOpen) {
        friendsSidebar.classList.add('collapsed');
        sidebarExpandBtn.classList.add('visible');
    } else {
        friendsSidebar.classList.remove('collapsed');
        sidebarExpandBtn.classList.remove('visible');
    }
}

async function saveFriends() {
    await window.electronAPI.saveFriends(friendsData);
}

// Debounced version — for frequent state changes like sidebar toggling
function saveFriendsDebounced() {
    if (saveDebounceId) clearTimeout(saveDebounceId);
    saveDebounceId = setTimeout(() => {
        saveFriends();
        saveDebounceId = null;
    }, SAVE_DEBOUNCE_MS);
}

function getFriendName(peerId) {
    const friend = friendsData.friends.find(f => f.id === peerId);
    return friend ? friend.name : null;
}

function isFriend(peerId) {
    return friendsData.friends.some(f => f.id === peerId);
}

function renderFriendsList() {
    // Clear dynamic items (keep the empty message element)
    const items = friendsListEl.querySelectorAll('.friend-item');
    items.forEach(i => i.remove());

    if (friendsData.friends.length === 0) {
        friendsEmpty.style.display = 'block';
        return;
    }

    friendsEmpty.style.display = 'none';

    friendsData.friends.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.dataset.friendId = friend.id;

        const avatar = document.createElement('div');
        avatar.className = 'friend-item-avatar';
        avatar.textContent = friend.name[0].toUpperCase();

        const name = document.createElement('span');
        name.className = 'friend-item-name';
        name.textContent = friend.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'friend-item-delete';
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'Remove contact';

        // Click on item → connect or accept pending call
        item.addEventListener('click', (e) => {
            if (e.target === deleteBtn) return;
            // If this friend is ringing, accept the pending connection
            if (pendingConn && pendingConn.peer === friend.id) {
                acceptPendingConnection();
                return;
            }
            friendIdInput.value = friend.id;
            connectBtn.click();
        });

        // Delete friend
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            friendsData.friends = friendsData.friends.filter(f => f.id !== friend.id);
            saveFriends();
            renderFriendsList();
            rlog.info('Friend removed from contacts');
            showToast('Contact removed', 'success');
        });

        item.appendChild(avatar);
        item.appendChild(name);
        item.appendChild(deleteBtn);
        friendsListEl.appendChild(item);
    });
}

// ── View switching ──────────────────────────────────────────────────────────────
function showChat(friendId) {
    currentPeerId = friendId;
    const friendName = getFriendName(friendId);
    const displayName = friendName || friendId.substring(0, 8) + '…';

    peerAvatar.textContent = displayName[0].toUpperCase();
    peerNameEl.textContent = displayName;

    // Show/hide the [+] button based on whether this peer is already a friend
    if (isFriend(friendId)) {
        addFriendBtn.classList.add('hidden');
    } else {
        addFriendBtn.classList.remove('hidden');
    }

    loginView.style.display = 'none';
    chatView.style.display = 'flex';

    const connectMsg = friendName ? `Connected to ${friendName}` : `Connected to ${friendId}`;
    addSystemMessage(connectMsg);
    msgInput.focus();
}

function showLogin() {
    currentPeerId = null;
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
    // Clean up previous remote audio if any
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
    }
    remoteAudio = new Audio();
    remoteAudio.srcObject = stream;
    remoteAudio.play().catch(() => { });
}

async function initiateVoiceCall(friendId) {
    const stream = await getLocalAudio();
    if (!stream) return;

    activeCall = peer.call(friendId, stream);
    activeCall.on('stream', playRemoteStream);
    activeCall.on('close', () => { activeCall = null; });
    applyDefaultMute();
    addSystemMessage('🎤 Voice call active (muted by default)');
    rlog.info('Outgoing voice call started (muted by default)');
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
        applyDefaultMute();
        addSystemMessage('🎤 Voice call active (muted by default)');
        rlog.info('Incoming voice call answered (muted by default)');
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
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio = null;
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
            // Already connected to someone; reject silently
            incomingConn.close();
            return;
        }

        // Store pending connection
        pendingConn = incomingConn;
        const peerId = incomingConn.peer;
        const name = getFriendName(peerId);

        // Start ringing
        startRinging();
        ringingPeerId = peerId;

        if (isFriend(peerId)) {
            // Known friend → Sidebar pulse + call-hint, no modal
            highlightFriend(peerId, true);
            updateCallUI();
            rlog.info('Incoming connection from known friend, sidebar pulse active');
        }

        // Auto-dismiss after timeout
        callTimeoutId = setTimeout(() => {
            if (pendingConn) {
                rlog.info('Incoming call timed out after ' + (CALL_TIMEOUT_MS / 1000) + 's');
                clearCallState();
                pendingConn.close();
                pendingConn = null;
                requestOverlay.style.display = 'none';
                showToast('Missed call', 'error');
            }
        }, CALL_TIMEOUT_MS);
        if (!isFriend(peerId)) {
            // Unknown → Full modal
            requestModalName.textContent = peerId.substring(0, 12) + '…';
            requestModalId.textContent = peerId;
            requestOverlay.style.display = 'flex';
            rlog.info('Incoming connection from unknown peer, showing modal');
        }
    });

    // ── Incoming voice calls ──
    peer.on('call', (incomingCall) => {
        // Only answer if we are in an active chat
        if (conn && conn.open) {
            answerCall(incomingCall);
        } else {
            incomingCall.close();
        }
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
    showToast('Disconnected', 'success');
});

// ── Sidebar toggle ──────────────────────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
    friendsSidebar.classList.add('collapsed');
    sidebarExpandBtn.classList.add('visible');
    friendsData.sidebarOpen = false;
    saveFriendsDebounced();
    updateCallUI();
    rlog.info('Sidebar closed');
});

sidebarExpandBtn.addEventListener('click', () => {
    friendsSidebar.classList.remove('collapsed');
    sidebarExpandBtn.classList.remove('visible');
    friendsData.sidebarOpen = true;
    saveFriendsDebounced();
    updateCallUI();
    rlog.info('Sidebar opened');
});

// Click on call-hint to accept the pending call
sidebarCallHint.addEventListener('click', () => {
    if (pendingConn) {
        acceptPendingConnection();
    }
});

// ── Add Friend Modal ────────────────────────────────────────────────────────────
addFriendBtn.addEventListener('click', () => {
    if (!currentPeerId) return;
    friendModalId.textContent = currentPeerId;
    friendNameInput.value = '';
    friendOverlay.style.display = 'flex';
    friendNameInput.focus();
});

friendSaveBtn.addEventListener('click', () => {
    const name = friendNameInput.value.trim();
    if (!name) {
        friendNameInput.style.borderColor = '#ed4245';
        setTimeout(() => { friendNameInput.style.borderColor = 'transparent'; }, 1500);
        return;
    }
    if (!currentPeerId) return;

    // Add or update friend
    const existing = friendsData.friends.find(f => f.id === currentPeerId);
    if (existing) {
        existing.name = name;
    } else {
        friendsData.friends.push({ id: currentPeerId, name: name });
    }

    saveFriends();
    renderFriendsList();

    // Update chat header with the new name
    peerNameEl.textContent = name;
    peerAvatar.textContent = name[0].toUpperCase();
    addFriendBtn.classList.add('hidden');

    // Close modal
    friendOverlay.style.display = 'none';
    rlog.info('Friend added to contacts');
    showToast('Contact saved!', 'success');
});

friendCancelBtn.addEventListener('click', () => {
    friendOverlay.style.display = 'none';
});

friendOverlay.addEventListener('click', (e) => {
    if (e.target === friendOverlay) {
        friendOverlay.style.display = 'none';
    }
});

friendNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') friendSaveBtn.click();
});

// ── Connection Request Accept/Decline ───────────────────────────────────────────
async function acceptPendingConnection() {
    if (!pendingConn) return;

    // Save peer reference before nulling
    const accepted = pendingConn;
    const acceptedPeerId = accepted.peer;
    pendingConn = null;

    clearCallState();
    requestOverlay.style.display = 'none';

    wireConnection(accepted);

    // Initialize audio stream and apply default-mute
    const stream = await getLocalAudio();
    if (stream) {
        applyDefaultMute();
    }

    if (accepted.open) {
        showChat(acceptedPeerId);
        rlog.info('Incoming connection accepted');
    } else {
        accepted.on('open', () => {
            showChat(acceptedPeerId);
            rlog.info('Incoming connection accepted');
        });
    }
}

requestAcceptBtn.addEventListener('click', () => {
    acceptPendingConnection();
});

requestDeclineBtn.addEventListener('click', () => {
    clearCallState();
    if (pendingConn) {
        pendingConn.close();
        pendingConn = null;
    }
    requestOverlay.style.display = 'none';
    rlog.info('Incoming connection declined');
    showToast('Connection declined', 'success');
});

// ── Start ───────────────────────────────────────────────────────────────────────
init();
loadFriends();

// ── Update notification ─────────────────────────────────────────────────────────
const updateBanner = document.getElementById('update-banner');
const updateVersion = document.getElementById('update-version');
const updateOverlay = document.getElementById('update-overlay');
const updateReleasesEl = document.getElementById('update-releases');
const updateSkipBtn = document.getElementById('update-skip-btn');
const updateDownloadBtn = document.getElementById('update-download-btn');
const currentVersionEl = document.getElementById('current-version');

let updateDownloadUrl = '';

// ── Simple Markdown → HTML parser (for changelogs) ──────────────────────────────
function simpleMarkdown(text) {
    if (!text) return '';

    // 1) Escape HTML entities first (security)
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 2) Split into lines for block-level processing
    const lines = html.split('\n');
    const result = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Headers: ### → h4, ## → h3, # → h2
        if (line.match(/^#{3,}\s/)) {
            if (inList) { result.push('</ul>'); inList = false; }
            line = '<h4>' + line.replace(/^#{3,}\s*/, '') + '</h4>';
            result.push(line);
            continue;
        }
        if (line.match(/^##\s/)) {
            if (inList) { result.push('</ul>'); inList = false; }
            line = '<h3>' + line.replace(/^##\s*/, '') + '</h3>';
            result.push(line);
            continue;
        }
        if (line.match(/^#\s/)) {
            if (inList) { result.push('</ul>'); inList = false; }
            line = '<h2>' + line.replace(/^#\s*/, '') + '</h2>';
            result.push(line);
            continue;
        }

        // List items: - or * at start of line
        if (line.match(/^\s*[-*]\s+/)) {
            if (!inList) { result.push('<ul>'); inList = true; }
            line = '<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>';
            result.push(line);
            continue;
        }

        // Close list if we hit a non-list line
        if (inList) { result.push('</ul>'); inList = false; }

        // Empty line → skip (spacing handled by CSS)
        if (line.trim() === '') {
            continue;
        }

        // Regular paragraph
        result.push('<p>' + line + '</p>');
    }

    if (inList) result.push('</ul>');

    html = result.join('\n');

    // 3) Inline formatting (applied after block processing)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    return html;
}

window.electronAPI.onUpdateAvailable(async (data) => {
    // Show banner
    const count = data.releases.length;
    const versionWord = count === 1 ? 'version' : 'versions';
    updateVersion.textContent = `${data.latestVersion} (${count} ${versionWord} behind)`;
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
        body.innerHTML = simpleMarkdown(r.body);

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
