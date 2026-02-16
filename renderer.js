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
const peerStatusEl = document.getElementById('peer-status');
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

// Invite Modal elements
const inviteBtn = document.getElementById('invite-btn');
const inviteOverlay = document.getElementById('invite-overlay');
const inviteList = document.getElementById('invite-list');
const inviteCloseBtn = document.getElementById('invite-close-btn');

// Participant bar
const participantBar = document.getElementById('participant-bar');
const participantList = document.getElementById('participant-list');

// ── Configuration ───────────────────────────────────────────────────────────────
const CALL_TIMEOUT_MS = 90000;
const SAVE_DEBOUNCE_MS = 5000;

// ── State ───────────────────────────────────────────────────────────────────────
let peer = null;
const connections = new Map();       // Map<PeerId, DataConnection>
const activeCalls = new Map();       // Map<PeerId, MediaConnection>
const remoteAudios = new Map();      // Map<PeerId, HTMLAudioElement>
const connectedPeers = new Set();    // Quick lookup of connected peer IDs
const expectedMeshPeers = new Set(); // Peers we expect from mesh-invite (auto-accept)
const pendingVoiceCalls = new Map(); // Map<PeerId, MediaConnection> — voice calls awaiting data conn

let localStream = null;
let myId = '';
let isMuted = false;
let inSession = false;               // Are we currently in a chat session?
let currentPeerId = null;            // First peer we connected to (for add-friend)
let friendsData = { sidebarOpen: true, friends: [] };
let pendingConn = null;
let ringingPeerId = null;
let callTimeoutId = null;
let saveDebounceId = null;

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
        showCallHint(name);
    } else {
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
function addMessage(text, sender, senderName) {
    const div = document.createElement('div');
    div.className = 'message ' + sender;

    // Show sender label for friend messages in group chat
    if (sender === 'friend' && senderName && connectedPeers.size > 1) {
        const label = document.createElement('span');
        label.className = 'message-sender';
        label.textContent = senderName;
        div.appendChild(label);
    }

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

        item.addEventListener('click', (e) => {
            if (e.target === deleteBtn) return;
            if (pendingConn && pendingConn.peer === friend.id) {
                acceptPendingConnection();
                return;
            }
            friendIdInput.value = friend.id;
            connectBtn.click();
        });

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
function showChat(peerId) {
    currentPeerId = peerId;
    inSession = true;

    const friendName = getFriendName(peerId);
    const displayName = friendName || peerId.substring(0, 8) + '…';

    peerAvatar.textContent = displayName[0].toUpperCase();
    peerNameEl.textContent = displayName;

    if (isFriend(peerId)) {
        addFriendBtn.classList.add('hidden');
    } else {
        addFriendBtn.classList.remove('hidden');
    }

    loginView.style.display = 'none';
    chatView.style.display = 'flex';

    const connectMsg = friendName ? `Connected to ${friendName}` : `Connected to ${peerId}`;
    addSystemMessage(connectMsg);
    msgInput.focus();
    updateParticipantList();
}

function showLogin() {
    currentPeerId = null;
    inSession = false;
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
    if (participantBar) participantBar.style.display = 'none';
    if (participantList) participantList.innerHTML = '';
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

function playRemoteStream(peerId, stream) {
    // Clean up existing audio for this peer if any
    if (remoteAudios.has(peerId)) {
        const old = remoteAudios.get(peerId);
        old.pause();
        old.srcObject = null;
    }
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play().catch(() => { });
    remoteAudios.set(peerId, audio);
}

async function initiateVoiceCall(peerId) {
    const stream = await getLocalAudio();
    if (!stream) return;

    const call = peer.call(peerId, stream);
    call.on('stream', (remoteStream) => playRemoteStream(peerId, remoteStream));
    call.on('close', () => { activeCalls.delete(peerId); });
    activeCalls.set(peerId, call);

    // Only apply default mute if this is the first call in the session
    if (activeCalls.size === 1) {
        applyDefaultMute();
        addSystemMessage('🎤 Voice call active (muted by default)');
    }
    rlog.info('Outgoing voice call started');
}

function answerCall(incomingCall) {
    const peerId = incomingCall.peer;
    getLocalAudio().then((stream) => {
        if (!stream) {
            incomingCall.answer();
        } else {
            incomingCall.answer(stream);
        }
        incomingCall.on('stream', (remoteStream) => playRemoteStream(peerId, remoteStream));
        incomingCall.on('close', () => { activeCalls.delete(peerId); });
        activeCalls.set(peerId, incomingCall);

        if (activeCalls.size === 1) {
            applyDefaultMute();
            addSystemMessage('🎤 Voice call active (muted by default)');
        }
        rlog.info('Incoming voice call answered');
    });
}

// ── Parse and handle a single protocol message ─────────────────────────────────
function handleProtocolMessage(peerId, raw) {
    let msg;
    try {
        msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        msg = { type: 'chat', text: String(raw) };
    }

    switch (msg.type) {
        case 'chat': {
            const senderName = getFriendName(peerId) || peerId.substring(0, 8) + '…';
            addMessage(msg.text, 'friend', senderName);
            rlog.info('Chat message received');
            break;
        }
        case 'mesh-invite': {
            const targetId = msg.peerId;
            if (!connectedPeers.has(targetId) && targetId !== myId) {
                rlog.info('Mesh invite received, connecting to peer');
                connectToPeer(targetId, true);
            }
            break;
        }
        case 'mesh-peer-list': {
            const peerIds = msg.peerIds || [];
            peerIds.forEach(id => {
                if (id !== myId && !connectedPeers.has(id)) {
                    expectedMeshPeers.add(id);
                }
            });
            rlog.info('Mesh peer list received: ' + peerIds.length + ' peer(s) to expect');
            break;
        }
        case 'mesh-leave': {
            removePeer(peerId, 'left the call');
            break;
        }
        default:
            rlog.warn('Unknown message type: ' + (msg.type || 'undefined'));
    }
}

// ── Data connection wiring ──────────────────────────────────────────────────────
function wireConnection(dataConn) {
    const peerId = dataConn.peer;
    connections.set(peerId, dataConn);
    connectedPeers.add(peerId);

    // Remove early handler if one was attached (pending connections)
    if (dataConn._earlyHandler) {
        dataConn.off('data', dataConn._earlyHandler);
        delete dataConn._earlyHandler;
    }

    // Attach the real data handler
    dataConn.on('data', (raw) => handleProtocolMessage(peerId, raw));

    dataConn.on('close', () => {
        removePeer(peerId, 'disconnected');
    });

    dataConn.on('error', (err) => {
        rlog.error('Connection error with peer: ' + err.type);
        showToast('Connection error: ' + err.message, 'error');
    });

    // Replay any buffered messages that arrived before wiring
    if (dataConn._bufferedMessages && dataConn._bufferedMessages.length > 0) {
        rlog.info('Replaying ' + dataConn._bufferedMessages.length + ' buffered message(s)');
        dataConn._bufferedMessages.forEach(raw => handleProtocolMessage(peerId, raw));
    }
    delete dataConn._bufferedMessages;

    // Answer any pending voice calls from this peer
    if (pendingVoiceCalls.has(peerId)) {
        answerCall(pendingVoiceCalls.get(peerId));
        pendingVoiceCalls.delete(peerId);
    }

    updateParticipantList();
}

// ── Remove a single peer from the mesh ──────────────────────────────────────────
function removePeer(peerId, reason) {
    // Guard against double-removal (mesh-leave + close can both fire)
    if (!connectedPeers.has(peerId)) return;

    const dataConn = connections.get(peerId);
    if (dataConn) {
        try { dataConn.close(); } catch { }
        connections.delete(peerId);
    }

    const call = activeCalls.get(peerId);
    if (call) {
        try { call.close(); } catch { }
        activeCalls.delete(peerId);
    }

    const audio = remoteAudios.get(peerId);
    if (audio) {
        audio.pause();
        audio.srcObject = null;
        remoteAudios.delete(peerId);
    }

    connectedPeers.delete(peerId);
    expectedMeshPeers.delete(peerId);

    const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
    addSystemMessage(`${name} ${reason}.`);
    rlog.info('Peer removed: ' + reason);

    updateParticipantList();

    // If no peers left, return to login
    if (connectedPeers.size === 0) {
        cleanupLocal();
        showLogin();
        showToast('All peers disconnected', 'error');
    }
}

// ── Connect to a peer (outgoing) ────────────────────────────────────────────────
function connectToPeer(peerId, isMeshTriggered) {
    if (connectedPeers.has(peerId) || peerId === myId) return;

    const outgoing = peer.connect(peerId, { reliable: true });

    outgoing.on('open', () => {
        wireConnection(outgoing);

        if (!inSession) {
            showChat(peerId);
        } else {
            const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
            addSystemMessage(`${name} joined the call.`);
            showToast(`${name} joined`, 'success');
        }

        rlog.info('Outgoing connection established' + (isMeshTriggered ? ' (mesh)' : ''));
        initiateVoiceCall(peerId);
    });

    outgoing.on('error', (err) => {
        rlog.error('Outgoing connection failed: ' + err.type);
        if (!isMeshTriggered) {
            statusText.textContent = 'Connection failed: ' + err.message;
            statusText.className = 'status-text error';
            connectBtn.disabled = false;
        } else {
            if (err.type === 'peer-unavailable') {
                showToast('Peer is not online', 'error');
            } else {
                showToast('Could not connect to peer', 'error');
            }
        }
    });
}

// ── Invite a peer to the mesh ───────────────────────────────────────────────────
function invitePeerToMesh(peerId) {
    if (connectedPeers.has(peerId) || peerId === myId) return;

    const outgoing = peer.connect(peerId, { reliable: true });

    outgoing.on('open', () => {
        wireConnection(outgoing);

        // 1. Tell the new peer about existing mesh members FIRST
        //    (so they know to auto-accept connections from those peers)
        const existingPeers = Array.from(connectedPeers).filter(id => id !== peerId);
        if (existingPeers.length > 0) {
            outgoing.send(JSON.stringify({ type: 'mesh-peer-list', peerIds: existingPeers }));
        }

        // 2. THEN tell existing peers to connect to the new peer
        const inviteMsg = JSON.stringify({ type: 'mesh-invite', peerId: peerId });
        connections.forEach((c, id) => {
            if (id !== peerId && c.open) c.send(inviteMsg);
        });

        const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
        addSystemMessage(`${name} joined the call.`);
        showToast(`${name} joined`, 'success');
        rlog.info('Peer invited to mesh');

        initiateVoiceCall(peerId);
    });

    outgoing.on('error', (err) => {
        rlog.error('Mesh invite failed: ' + err.type);
        if (err.type === 'peer-unavailable') {
            showToast('Peer is not online', 'error');
        } else {
            showToast('Could not invite peer: ' + err.message, 'error');
        }
    });
}

// ── Handle a peer that was accepted into the mesh ───────────────────────────────
function handleAcceptedPeer(peerId) {
    if (!inSession) {
        showChat(peerId);
        rlog.info('Incoming connection accepted');
    } else {
        // Already in a call — integrate this peer into the existing mesh
        const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
        addSystemMessage(`${name} joined the call.`);
        showToast(`${name} joined`, 'success');

        // Tell the new peer about existing mesh members
        const conn = connections.get(peerId);
        if (conn && conn.open) {
            const existingPeers = Array.from(connectedPeers).filter(id => id !== peerId);
            if (existingPeers.length > 0) {
                conn.send(JSON.stringify({ type: 'mesh-peer-list', peerIds: existingPeers }));
            }
        }

        // Tell existing peers to connect to the new peer
        const inviteMsg = JSON.stringify({ type: 'mesh-invite', peerId: peerId });
        connections.forEach((c, id) => {
            if (id !== peerId && c.open) c.send(inviteMsg);
        });

        rlog.info('Incoming peer integrated into mesh');
    }
}

// ── Send message (broadcast to all peers) ───────────────────────────────────────
function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || connections.size === 0) return;

    const msg = JSON.stringify({ type: 'chat', text: text });
    connections.forEach(c => {
        if (c.open) c.send(msg);
    });

    addMessage(text, 'self');
    rlog.info('Message broadcast to ' + connections.size + ' peer(s)');
    msgInput.value = '';
    msgInput.focus();
}

// ── Cleanup (leave mesh entirely) ───────────────────────────────────────────────
function cleanup() {
    // Announce departure to all peers
    const leaveMsg = JSON.stringify({ type: 'mesh-leave' });
    connections.forEach(c => {
        try { if (c.open) c.send(leaveMsg); } catch { }
    });

    // Close all data connections
    connections.forEach(c => { try { c.close(); } catch { } });
    connections.clear();

    // Close all voice calls
    activeCalls.forEach(c => { try { c.close(); } catch { } });
    activeCalls.clear();

    // Clean up all remote audio
    remoteAudios.forEach(a => { a.pause(); a.srcObject = null; });
    remoteAudios.clear();

    connectedPeers.clear();
    expectedMeshPeers.clear();
    pendingVoiceCalls.clear();

    cleanupLocal();
}

function cleanupLocal() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
}

// ── Participant list UI ─────────────────────────────────────────────────────────
function updateParticipantList() {
    if (!participantList || !participantBar) return;

    participantList.innerHTML = '';
    const count = connectedPeers.size;

    if (count <= 1) {
        participantBar.style.display = 'none';
        if (peerStatusEl) peerStatusEl.textContent = '● Connected';
        return;
    }

    // Group call mode
    participantBar.style.display = 'flex';
    if (peerStatusEl) peerStatusEl.textContent = `● Group Call · ${count + 1}`;

    connectedPeers.forEach(peerId => {
        const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = name[0].toUpperCase();
        avatar.title = name;
        participantList.appendChild(avatar);
    });
}

// ── Invite list UI ──────────────────────────────────────────────────────────────
function renderInviteList() {
    if (!inviteList) return;
    inviteList.innerHTML = '';

    if (friendsData.friends.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'invite-empty';
        empty.textContent = 'No contacts to invite';
        inviteList.appendChild(empty);
        return;
    }

    friendsData.friends.forEach(friend => {
        const item = document.createElement('div');
        const isConnected = connectedPeers.has(friend.id);
        const isSelf = friend.id === myId;
        item.className = 'invite-list-item' + (isConnected || isSelf ? ' disabled' : '');

        const avatar = document.createElement('div');
        avatar.className = 'invite-item-avatar';
        avatar.textContent = friend.name[0].toUpperCase();

        const name = document.createElement('span');
        name.className = 'invite-item-name';
        name.textContent = friend.name;

        const status = document.createElement('span');
        status.className = 'invite-item-status';
        status.textContent = isConnected ? 'In call' : (isSelf ? 'You' : '');

        item.appendChild(avatar);
        item.appendChild(name);
        item.appendChild(status);

        if (!isConnected && !isSelf) {
            item.addEventListener('click', () => {
                invitePeerToMesh(friend.id);
                inviteOverlay.classList.add('hidden');
            });
        }

        inviteList.appendChild(item);
    });
}

// ── Initialize PeerJS ───────────────────────────────────────────────────────────
function setupPeer() {
    peer = new Peer(myId, {
        // Uses default public PeerJS cloud server (0.peerjs.com)
    });

    peer.on('open', (id) => {
        myIdEl.textContent = id;
        statusText.textContent = 'Ready to connect';
        statusText.className = 'status-text success';
        connectBtn.disabled = false;
        rlog.info('PeerJS connected to signaling server');
    });

    peer.on('error', (err) => {
        rlog.error('PeerJS error: ' + err.type);
        if (err.type === 'peer-unavailable') {
            if (!inSession) {
                statusText.textContent = 'Peer not found. Check the ID and try again.';
                statusText.className = 'status-text error';
                connectBtn.disabled = false;
            } else {
                showToast('Peer is not online', 'error');
            }
        } else if (err.type === 'unavailable-id') {
            statusText.textContent = 'Your ID is busy. Click Reconnect below.';
            statusText.className = 'status-text error';
        } else {
            showToast('Error: ' + err.message, 'error');
        }
    });

    // ── Incoming data connections ──
    peer.on('connection', (incomingConn) => {
        const peerId = incomingConn.peer;

        // Already connected to this peer — reject duplicate
        if (connectedPeers.has(peerId)) {
            incomingConn.close();
            return;
        }

        // ── Attach EARLY data handler ──
        // PeerJS data channels open bilaterally — the remote side may send
        // mesh-peer-list before we've "accepted" and called wireConnection.
        // We must process mesh-peer-list immediately so we know which peers
        // to auto-accept, and buffer everything else for replay.
        const bufferedMessages = [];
        const earlyHandler = (raw) => {
            let msg;
            try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }

            // Process mesh-peer-list RIGHT NOW so expectedMeshPeers is populated
            if (msg.type === 'mesh-peer-list') {
                (msg.peerIds || []).forEach(id => {
                    if (id !== myId && !connectedPeers.has(id)) {
                        expectedMeshPeers.add(id);
                    }
                });
                rlog.info('Mesh peer list received (early): ' + (msg.peerIds || []).length + ' peer(s)');
            }
            // Buffer ALL messages (including mesh-peer-list) for proper replay
            bufferedMessages.push(raw);
        };
        incomingConn.on('data', earlyHandler);
        incomingConn._earlyHandler = earlyHandler;
        incomingConn._bufferedMessages = bufferedMessages;

        // Expected mesh peer — auto-accept without notification
        if (expectedMeshPeers.has(peerId)) {
            expectedMeshPeers.delete(peerId);
            rlog.info('Auto-accepting expected mesh peer');

            const doAutoAccept = () => {
                wireConnection(incomingConn);
                if (inSession) {
                    const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
                    addSystemMessage(`${name} joined the call.`);
                    showToast(`${name} joined`, 'success');
                }
            };

            if (incomingConn.open) {
                doAutoAccept();
            } else {
                incomingConn.on('open', doAutoAccept);
            }
            return;
        }

        // Normal incoming connection — show notification
        pendingConn = incomingConn;
        const name = getFriendName(peerId);

        startRinging();
        ringingPeerId = peerId;

        if (isFriend(peerId)) {
            highlightFriend(peerId, true);
            updateCallUI();
            rlog.info('Incoming connection from known friend, sidebar pulse active');
        }

        // Auto-dismiss after timeout
        callTimeoutId = setTimeout(() => {
            if (pendingConn && pendingConn.peer === peerId) {
                rlog.info('Incoming call timed out after ' + (CALL_TIMEOUT_MS / 1000) + 's');
                clearCallState();
                pendingConn.close();
                pendingConn = null;
                requestOverlay.style.display = 'none';
                showToast('Missed call', 'error');
            }
        }, CALL_TIMEOUT_MS);

        if (!isFriend(peerId)) {
            requestModalName.textContent = peerId.substring(0, 12) + '…';
            requestModalId.textContent = peerId;
            requestOverlay.style.display = 'flex';
            rlog.info('Incoming connection from unknown peer, showing modal');
        }
    });

    // ── Incoming voice calls ──
    peer.on('call', (incomingCall) => {
        const peerId = incomingCall.peer;

        // If we have a data connection to this peer, answer immediately
        if (connectedPeers.has(peerId)) {
            answerCall(incomingCall);
        } else {
            // Store the call — it will be answered when the data connection is wired
            pendingVoiceCalls.set(peerId, incomingCall);
        }
    });
}

async function init() {
    myId = await window.electronAPI.getUserId();
    myIdEl.textContent = myId;
    setupPeer();
}

// ── Reconnect (destroy + recreate PeerJS without restarting) ────────────────────
function reconnectPeer() {
    rlog.info('Manual reconnect requested');
    if (peer) {
        try { peer.destroy(); } catch { }
    }
    cleanup();
    showLogin();
    statusText.textContent = 'Reconnecting…';
    statusText.className = 'status-text';
    setupPeer();
}

// ── Event listeners ─────────────────────────────────────────────────────────────

// Reconnect
const reconnectBtn = document.getElementById('reconnect-btn');
reconnectBtn.addEventListener('click', () => {
    reconnectPeer();
});

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

    connectToPeer(friendId, false);
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

// ── Invite button ───────────────────────────────────────────────────────────────
inviteBtn.addEventListener('click', () => {
    renderInviteList();
    inviteOverlay.classList.remove('hidden');
});

inviteCloseBtn.addEventListener('click', () => {
    inviteOverlay.classList.add('hidden');
});

inviteOverlay.addEventListener('click', (e) => {
    if (e.target === inviteOverlay) {
        inviteOverlay.classList.add('hidden');
    }
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

    const existing = friendsData.friends.find(f => f.id === currentPeerId);
    if (existing) {
        existing.name = name;
    } else {
        friendsData.friends.push({ id: currentPeerId, name: name });
    }

    saveFriends();
    renderFriendsList();

    peerNameEl.textContent = name;
    peerAvatar.textContent = name[0].toUpperCase();
    addFriendBtn.classList.add('hidden');

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

    const accepted = pendingConn;
    const acceptedPeerId = accepted.peer;
    pendingConn = null;

    clearCallState();
    requestOverlay.style.display = 'none';

    // Initialize audio stream if not already acquired
    if (!localStream) {
        const stream = await getLocalAudio();
        if (stream) applyDefaultMute();
    }

    if (accepted.open) {
        wireConnection(accepted);
        handleAcceptedPeer(acceptedPeerId);
    } else {
        accepted.on('open', () => {
            wireConnection(accepted);
            handleAcceptedPeer(acceptedPeerId);
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

    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = html.split('\n');
    const result = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

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

        if (line.match(/^\s*[-*]\s+/)) {
            if (!inList) { result.push('<ul>'); inList = true; }
            line = '<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>';
            result.push(line);
            continue;
        }

        if (inList) { result.push('</ul>'); inList = false; }

        if (line.trim() === '') {
            continue;
        }

        result.push('<p>' + line + '</p>');
    }

    if (inList) result.push('</ul>');

    html = result.join('\n');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    return html;
}

window.electronAPI.onUpdateAvailable(async (data) => {
    const count = data.releases.length;
    const versionWord = count === 1 ? 'version' : 'versions';
    updateVersion.textContent = `${data.latestVersion} (${count} ${versionWord} behind)`;
    updateBanner.style.display = 'block';
    updateDownloadUrl = data.downloadUrl;

    const currentVer = await window.electronAPI.getAppVersion();
    currentVersionEl.textContent = 'v' + currentVer;

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

updateBanner.addEventListener('click', () => {
    updateOverlay.style.display = 'flex';
});

updateSkipBtn.addEventListener('click', () => {
    updateOverlay.style.display = 'none';
});

updateDownloadBtn.addEventListener('click', () => {
    if (updateDownloadUrl) {
        window.electronAPI.openExternal(updateDownloadUrl);
    }
    updateOverlay.style.display = 'none';
});

updateOverlay.addEventListener('click', (e) => {
    if (e.target === updateOverlay) {
        updateOverlay.style.display = 'none';
    }
});
