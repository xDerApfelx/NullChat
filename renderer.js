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
const chatBurgerBtn = document.getElementById('chat-burger-btn');
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

// Settings elements
const settingMicDevice = document.getElementById('setting-mic-device');
const settingSpeakerDevice = document.getElementById('setting-speaker-device');
const micTestBtn = document.getElementById('mic-test-btn');
const micTestStopBtn = document.getElementById('mic-test-stop-btn');
const micLevelFill = document.getElementById('mic-level-fill');
const settingMicGain = document.getElementById('setting-mic-gain');
const micGainValue = document.getElementById('mic-gain-value');
const settingNoiseSuppression = document.getElementById('setting-noise-suppression');
const settingVad = document.getElementById('setting-vad');
const settingVadThreshold = document.getElementById('setting-vad-threshold');
const vadThresholdValue = document.getElementById('vad-threshold-value');
const vadSensitivityRow = document.getElementById('vad-sensitivity-row');
const settingRingtoneVolume = document.getElementById('setting-ringtone-volume');
const ringtoneVolumeValue = document.getElementById('ringtone-volume-value');

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

// Audio processing state
let audioCtx = null;
let micGainNode = null;
let micAnalyser = null;
let micTestStream = null;
let micTestSource = null;
let micTestGainNode = null;
let micTestAnimId = null;
let vadAnimId = null;
const remoteAnalysers = new Map();   // Map<PeerId, AnalyserNode>
let speakerHighlightInterval = null;
let activePeerVolumePopup = null;    // Currently open peer volume popup

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
    document.querySelector('.login-actions').style.display = 'none';

    const connectMsg = friendName ? `Connected to ${friendName}` : `Connected to ${peerId}`;
    addSystemMessage(connectMsg);
    msgInput.focus();
    updateParticipantList();

    // Show inline burger in chat header if sidebar is collapsed
    if (friendsSidebar.classList.contains('collapsed')) {
        chatBurgerBtn.classList.remove('hidden');
        sidebarExpandBtn.classList.remove('visible');
    }
}

function showLogin() {
    currentPeerId = null;
    inSession = false;
    chatView.style.display = 'none';
    loginView.style.display = 'flex';
    document.querySelector('.login-actions').style.display = 'flex';
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

    // Hide chat burger, restore floating expand if sidebar is collapsed
    chatBurgerBtn.classList.add('hidden');
    if (friendsSidebar.classList.contains('collapsed')) {
        sidebarExpandBtn.classList.add('visible');
    }
}

// ── Voice call helpers ─────────────────────────────────────────────────────────
function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
}

async function getLocalAudio() {
    if (localStream) return localStream;
    try {
        const constraints = {
            audio: {
                deviceId: appSettings.micDeviceId ? { exact: appSettings.micDeviceId } : undefined,
                noiseSuppression: appSettings.noiseSuppression,
                echoCancellation: appSettings.noiseSuppression,
                autoGainControl: appSettings.noiseSuppression
            }
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Set up gain node for mic volume control
        const ctx = getAudioCtx();
        const source = ctx.createMediaStreamSource(localStream);
        micGainNode = ctx.createGain();
        micGainNode.gain.value = appSettings.micGain;
        micAnalyser = ctx.createAnalyser();
        micAnalyser.fftSize = 256;

        const dest = ctx.createMediaStreamDestination();
        source.connect(micGainNode);
        micGainNode.connect(micAnalyser);
        micGainNode.connect(dest);

        // Replace the tracks in localStream with the gained output
        localStream = dest.stream;

        // Start VAD monitoring if enabled
        if (appSettings.vadEnabled) startVAD();

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

    // Apply saved per-peer volume
    const friend = friendsData.friends.find(f => f.id === peerId);
    if (friend && friend.volume !== undefined) {
        audio.volume = friend.volume;
    }

    // Apply speaker device if selected
    if (appSettings.speakerDeviceId && audio.setSinkId) {
        audio.setSinkId(appSettings.speakerDeviceId).catch(() => { });
    }

    audio.play().catch(() => { });
    remoteAudios.set(peerId, audio);

    // Create analyser for speaker highlight
    try {
        const ctx = getAudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        remoteAnalysers.set(peerId, analyser);
        startSpeakerHighlight();
    } catch (e) {
        console.warn('Could not create analyser for peer:', e);
    }
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

    // Stop audio monitoring
    stopVAD();
    stopSpeakerHighlight();

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

        const item = document.createElement('div');
        item.className = 'participant-item';
        item.dataset.peerId = peerId;

        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = name[0].toUpperCase();
        avatar.title = name;

        // Click on avatar to adjust per-peer volume
        avatar.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close any existing popup
            if (activePeerVolumePopup) { activePeerVolumePopup.remove(); activePeerVolumePopup = null; }

            const audio = remoteAudios.get(peerId);
            if (!audio) return; // No audio stream for this peer yet

            const popup = document.createElement('div');
            popup.className = 'peer-volume-popup';

            const label = document.createElement('span');
            label.className = 'peer-volume-label';
            label.textContent = '🔊 ' + name;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'settings-range';
            slider.min = '0';
            slider.max = '100';
            slider.value = Math.round(audio.volume * 100);

            const valLabel = document.createElement('span');
            valLabel.className = 'peer-volume-label';
            valLabel.textContent = slider.value + '%';

            slider.addEventListener('input', () => {
                const vol = parseInt(slider.value) / 100;
                audio.volume = vol;
                valLabel.textContent = slider.value + '%';
                // Save per-peer volume
                const friend = friendsData.friends.find(f => f.id === peerId);
                if (friend) {
                    friend.volume = vol;
                    saveFriends();
                }
            });

            popup.appendChild(label);
            popup.appendChild(slider);
            popup.appendChild(valLabel);
            item.appendChild(popup);
            activePeerVolumePopup = popup;

            // Close popup when clicking outside
            const closePopup = (ev) => {
                if (!popup.contains(ev.target) && ev.target !== avatar) {
                    popup.remove();
                    activePeerVolumePopup = null;
                    document.removeEventListener('click', closePopup);
                }
            };
            setTimeout(() => document.addEventListener('click', closePopup), 10);
        });

        item.appendChild(avatar);

        // Show (+) badge on non-friend participants, otherwise show name
        if (!isFriend(peerId)) {
            const addBtn = document.createElement('button');
            addBtn.className = 'participant-add-btn';
            addBtn.textContent = '+ Add';
            addBtn.title = 'Add to contacts';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Open the add-friend modal for this peer
                currentPeerId = peerId;
                friendModalId.textContent = peerId;
                friendNameInput.value = '';
                friendOverlay.style.display = 'flex';
                friendNameInput.focus();
            });
            item.appendChild(addBtn);
        } else {
            const nameEl = document.createElement('div');
            nameEl.className = 'participant-name';
            nameEl.textContent = name;
            item.appendChild(nameEl);
        }

        participantList.appendChild(item);
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
    if (inSession) {
        setTimeout(() => chatBurgerBtn.classList.remove('hidden'), 300);
        sidebarExpandBtn.classList.remove('visible');
    } else {
        setTimeout(() => sidebarExpandBtn.classList.add('visible'), 300);
    }
    friendsData.sidebarOpen = false;
    saveFriendsDebounced();
    updateCallUI();
    rlog.info('Sidebar closed');
});

sidebarExpandBtn.addEventListener('click', () => {
    friendsSidebar.classList.remove('collapsed');
    sidebarExpandBtn.classList.remove('visible');
    chatBurgerBtn.classList.add('hidden');
    friendsData.sidebarOpen = true;
    saveFriendsDebounced();
    updateCallUI();
    rlog.info('Sidebar opened');
});

chatBurgerBtn.addEventListener('click', () => {
    friendsSidebar.classList.remove('collapsed');
    chatBurgerBtn.classList.add('hidden');
    sidebarExpandBtn.classList.remove('visible');
    friendsData.sidebarOpen = true;
    saveFriendsDebounced();
    updateCallUI();
    rlog.info('Sidebar opened (from chat header)');
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

    // Also refresh the group chat participant bar to remove the '+' and show the name
    updateParticipantList();

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
const updateBannerFill = document.getElementById('update-banner-fill');
const updateBannerText = document.getElementById('update-banner-text');

// Settings elements
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingAutoUpdate = document.getElementById('setting-auto-update');

// Version History elements
const versionHistoryBtn = document.getElementById('version-history-btn');
const versionOverlay = document.getElementById('version-overlay');
const versionCloseBtn = document.getElementById('version-close-btn');
const versionReleasesEl = document.getElementById('version-releases');
const versionBetaSection = document.getElementById('version-beta-section');
const currentVersionEl = document.getElementById('current-version');

let updateState = 'idle'; // idle | available | downloading | ready | error
let cachedReleases = null;
let cachedCurrentVersion = '';
let appSettings = {
    autoUpdate: true, micDeviceId: '', speakerDeviceId: '',
    micGain: 1.0, noiseSuppression: true, vadEnabled: true,
    vadThreshold: 0.015, ringtoneVolume: 0.25
};

// Load settings on startup
(async () => {
    try {
        appSettings = { ...appSettings, ...(await window.electronAPI.getSettings()) };
        settingAutoUpdate.checked = appSettings.autoUpdate;
        settingNoiseSuppression.checked = appSettings.noiseSuppression;
        settingVad.checked = appSettings.vadEnabled;
        settingVadThreshold.value = Math.round(appSettings.vadThreshold * 1000);
        vadThresholdValue.textContent = settingVadThreshold.value;
        vadSensitivityRow.style.display = appSettings.vadEnabled ? '' : 'none';
        settingMicGain.value = Math.round(appSettings.micGain * 100);
        micGainValue.textContent = settingMicGain.value + '%';
        settingRingtoneVolume.value = Math.round(appSettings.ringtoneVolume * 100);
        ringtoneVolumeValue.textContent = settingRingtoneVolume.value + '%';
        ringtone.volume = appSettings.ringtoneVolume;
        // Set initial VAD indicator position
        const vadIndicator = document.getElementById('vad-indicator');
        if (vadIndicator) vadIndicator.style.left = Math.min(appSettings.vadThreshold * 4000, 100) + '%';
        await populateDeviceSelectors();
    } catch (_) { }
})();

// ── Device Enumeration ───────────────────────────────────────────────────────
async function populateDeviceSelectors() {
    try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        const speakers = devices.filter(d => d.kind === 'audiooutput');

        settingMicDevice.innerHTML = '';
        mics.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || 'Microphone ' + (settingMicDevice.length + 1);
            settingMicDevice.appendChild(opt);
        });
        if (appSettings.micDeviceId) settingMicDevice.value = appSettings.micDeviceId;

        settingSpeakerDevice.innerHTML = '';
        speakers.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || 'Speaker ' + (settingSpeakerDevice.length + 1);
            settingSpeakerDevice.appendChild(opt);
        });
        if (appSettings.speakerDeviceId) settingSpeakerDevice.value = appSettings.speakerDeviceId;
    } catch (err) {
        rlog.warn('Could not enumerate audio devices');
    }
}

// ── Mic Test ────────────────────────────────────────────────────────────────
async function startMicTest() {
    try {
        const constraints = {
            audio: {
                deviceId: settingMicDevice.value ? { exact: settingMicDevice.value } : undefined,
                noiseSuppression: settingNoiseSuppression.checked,
                echoCancellation: false,
                autoGainControl: settingNoiseSuppression.checked
            }
        };
        micTestStream = await navigator.mediaDevices.getUserMedia(constraints);
        const ctx = getAudioCtx();
        micTestSource = ctx.createMediaStreamSource(micTestStream);

        micTestGainNode = ctx.createGain();
        micTestGainNode.gain.value = parseInt(settingMicGain.value) / 100;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        micTestSource.connect(micTestGainNode);
        micTestGainNode.connect(analyser);
        micTestGainNode.connect(ctx.destination);

        micTestBtn.classList.add('hidden');
        micTestStopBtn.classList.remove('hidden');

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        function updateLevel() {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const v = (dataArray[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            const pct = Math.min(rms * 400, 100);
            micLevelFill.style.width = pct + '%';
            micTestAnimId = requestAnimationFrame(updateLevel);
        }
        updateLevel();
    } catch (err) {
        showToast('Could not access microphone', 'error');
    }
}

function stopMicTest() {
    if (micTestAnimId) { cancelAnimationFrame(micTestAnimId); micTestAnimId = null; }
    if (micTestSource) { micTestSource.disconnect(); micTestSource = null; }
    if (micTestStream) { micTestStream.getTracks().forEach(t => t.stop()); micTestStream = null; }
    micTestGainNode = null;
    micLevelFill.style.width = '0%';
    micTestBtn.classList.remove('hidden');
    micTestStopBtn.classList.add('hidden');
}

// ── Voice Activity Detection ─────────────────────────────────────────────────
function startVAD() {
    if (!micAnalyser || !localStream) return;
    const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
    function vadLoop() {
        micAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (!isMuted && localStream) {
            localStream.getAudioTracks().forEach(t => { t.enabled = rms > appSettings.vadThreshold; });
        }
        vadAnimId = requestAnimationFrame(vadLoop);
    }
    vadLoop();
}

function stopVAD() {
    if (vadAnimId) { cancelAnimationFrame(vadAnimId); vadAnimId = null; }
}

// ── Speaker Highlight (Group Calls) ──────────────────────────────────────────
function startSpeakerHighlight() {
    if (speakerHighlightInterval) return;
    speakerHighlightInterval = setInterval(() => {
        remoteAnalysers.forEach((analyser, peerId) => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const v = (dataArray[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            // Check participant bar avatars (group calls)
            const avatars = participantList.querySelectorAll('.participant-item');
            avatars.forEach(item => {
                if (item.dataset.peerId === peerId) {
                    const avatar = item.querySelector('.participant-avatar');
                    if (avatar) {
                        if (rms > 0.01) avatar.classList.add('speaking');
                        else avatar.classList.remove('speaking');
                    }
                }
            });

            // Check 1-on-1 chat header avatar
            if (currentPeerId === peerId && peerAvatar) {
                if (rms > 0.01) peerAvatar.classList.add('speaking');
                else peerAvatar.classList.remove('speaking');
            }
        });
    }, 100);
}

function stopSpeakerHighlight() {
    if (speakerHighlightInterval) { clearInterval(speakerHighlightInterval); speakerHighlightInterval = null; }
    remoteAnalysers.forEach((a) => { try { a.disconnect(); } catch (_) { } });
    remoteAnalysers.clear();
}

// ── Settings Modal ──────────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', async () => {
    await populateDeviceSelectors();
    settingsOverlay.style.display = 'flex';
});

settingsCloseBtn.addEventListener('click', () => {
    stopMicTest();
    settingsOverlay.style.display = 'none';
});

settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) { stopMicTest(); settingsOverlay.style.display = 'none'; }
});

settingAutoUpdate.addEventListener('change', async () => {
    appSettings.autoUpdate = settingAutoUpdate.checked;
    await window.electronAPI.saveSettings({ autoUpdate: appSettings.autoUpdate });
    rlog.info(`Auto-update set to: ${appSettings.autoUpdate}`);
});

settingMicDevice.addEventListener('change', async () => {
    appSettings.micDeviceId = settingMicDevice.value;
    await window.electronAPI.saveSettings({ micDeviceId: appSettings.micDeviceId });
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
        const newStream = await getLocalAudio();
        if (newStream) {
            const newTrack = newStream.getAudioTracks()[0];
            activeCalls.forEach(call => {
                const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) sender.replaceTrack(newTrack).catch(() => { });
            });
        }
    }
    rlog.info('Microphone device changed');
});

settingSpeakerDevice.addEventListener('change', async () => {
    appSettings.speakerDeviceId = settingSpeakerDevice.value;
    await window.electronAPI.saveSettings({ speakerDeviceId: appSettings.speakerDeviceId });
    remoteAudios.forEach(audio => {
        if (audio.setSinkId) audio.setSinkId(appSettings.speakerDeviceId).catch(() => { });
    });
    if (ringtone.setSinkId) ringtone.setSinkId(appSettings.speakerDeviceId).catch(() => { });
    rlog.info('Speaker device changed');
});

settingMicGain.addEventListener('input', async () => {
    const val = parseInt(settingMicGain.value);
    micGainValue.textContent = val + '%';
    appSettings.micGain = val / 100;
    if (micGainNode) micGainNode.gain.value = appSettings.micGain;
    if (micTestGainNode) micTestGainNode.gain.value = appSettings.micGain;
    await window.electronAPI.saveSettings({ micGain: appSettings.micGain });
});

micTestBtn.addEventListener('click', () => startMicTest());
micTestStopBtn.addEventListener('click', () => stopMicTest());

settingNoiseSuppression.addEventListener('change', async () => {
    appSettings.noiseSuppression = settingNoiseSuppression.checked;
    await window.electronAPI.saveSettings({ noiseSuppression: appSettings.noiseSuppression });
    rlog.info(`Noise suppression set to: ${appSettings.noiseSuppression}`);
});

settingVad.addEventListener('change', async () => {
    appSettings.vadEnabled = settingVad.checked;
    vadSensitivityRow.style.display = appSettings.vadEnabled ? '' : 'none';
    await window.electronAPI.saveSettings({ vadEnabled: appSettings.vadEnabled });
    if (appSettings.vadEnabled && localStream) startVAD();
    else stopVAD();
    rlog.info(`VAD set to: ${appSettings.vadEnabled}`);
});

settingVadThreshold.addEventListener('input', async () => {
    vadThresholdValue.textContent = settingVadThreshold.value;
    appSettings.vadThreshold = parseInt(settingVadThreshold.value) / 1000;
    // Update the red VAD indicator line on the level bar
    const vadIndicator = document.getElementById('vad-indicator');
    if (vadIndicator) vadIndicator.style.left = Math.min(appSettings.vadThreshold * 4000, 100) + '%';
    await window.electronAPI.saveSettings({ vadThreshold: appSettings.vadThreshold });
});

settingRingtoneVolume.addEventListener('input', async () => {
    const val = parseInt(settingRingtoneVolume.value);
    ringtoneVolumeValue.textContent = val + '%';
    appSettings.ringtoneVolume = val / 100;
    ringtone.volume = appSettings.ringtoneVolume;
    await window.electronAPI.saveSettings({ ringtoneVolume: appSettings.ringtoneVolume });
});

// ── 1-on-1 Peer Volume (chat header avatar) ─────────────────────────────────
peerAvatar.style.cursor = 'pointer';
peerAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activePeerVolumePopup) { activePeerVolumePopup.remove(); activePeerVolumePopup = null; }

    const peerId = currentPeerId;
    if (!peerId) return;
    const audio = remoteAudios.get(peerId);
    if (!audio) return;

    const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';

    const popup = document.createElement('div');
    popup.className = 'peer-volume-popup';

    const label = document.createElement('span');
    label.className = 'peer-volume-label';
    label.textContent = '🔊 ' + name;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'settings-range';
    slider.min = '0';
    slider.max = '100';
    slider.value = Math.round(audio.volume * 100);

    const valLabel = document.createElement('span');
    valLabel.className = 'peer-volume-label';
    valLabel.textContent = slider.value + '%';

    slider.addEventListener('input', () => {
        const vol = parseInt(slider.value) / 100;
        audio.volume = vol;
        valLabel.textContent = slider.value + '%';
        const friend = friendsData.friends.find(f => f.id === peerId);
        if (friend) { friend.volume = vol; saveFriends(); }
    });

    popup.appendChild(label);
    popup.appendChild(slider);
    popup.appendChild(valLabel);

    // Position relative to the peer-info container
    const peerInfo = peerAvatar.closest('.peer-info');
    if (peerInfo) peerInfo.style.position = 'relative';
    (peerInfo || peerAvatar.parentElement).appendChild(popup);
    activePeerVolumePopup = popup;

    const closePopup = (ev) => {
        if (!popup.contains(ev.target) && ev.target !== peerAvatar) {
            popup.remove();
            activePeerVolumePopup = null;
            document.removeEventListener('click', closePopup);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopup), 10);
});

// ── Version History Modal ───────────────────────────────────────────────────────
versionHistoryBtn.addEventListener('click', () => {
    renderVersionHistory();
    versionOverlay.style.display = 'flex';
});

versionCloseBtn.addEventListener('click', () => {
    versionOverlay.style.display = 'none';
});

versionOverlay.addEventListener('click', (e) => {
    if (e.target === versionOverlay) versionOverlay.style.display = 'none';
});

function renderVersionHistory() {
    if (!cachedReleases || !cachedCurrentVersion) return;

    currentVersionEl.textContent = 'v' + cachedCurrentVersion;
    versionReleasesEl.innerHTML = '';

    // Separate betas and stable releases
    const stables = cachedReleases.filter(r => !r.prerelease);

    // Only show betas that are newer than the latest stable version 
    const latestStable = stables.length > 0 ? stables[0].version : '0.0.0';
    const betas = cachedReleases.filter(r => r.prerelease && compareVersions(r.version, latestStable) > 0);

    // Beta section
    if (betas.length > 0) {
        versionBetaSection.style.display = 'block';
        versionBetaSection.innerHTML = '<span class="beta-tag">⚡ Beta Versions</span><br>' +
            betas.map(b => `${b.version} — ${b.name}`).join('<br>');
    } else {
        versionBetaSection.style.display = 'none';
    }

    // Stable releases
    stables.forEach(r => {
        const cleanVersion = r.version.replace(/^v/, '').replace(/-.*$/, '');
        const cleanCurrent = cachedCurrentVersion.replace(/-.*$/, '');

        const isCurrent = cleanVersion === cleanCurrent;
        const isNewer = compareVersions(r.version, cachedCurrentVersion) > 0;

        const item = document.createElement('div');
        item.className = 'version-release-item';
        if (isCurrent) item.classList.add('current');
        else if (isNewer) item.classList.add('newer');

        const header = document.createElement('div');
        header.className = 'version-release-header';

        const versionSpan = document.createElement('span');
        versionSpan.className = 'version-release-version';
        versionSpan.textContent = r.version;

        const headerRight = document.createElement('div');
        headerRight.style.display = 'flex';
        headerRight.style.alignItems = 'center';
        headerRight.style.gap = '8px';

        if (isCurrent) {
            const badge = document.createElement('span');
            badge.className = 'version-release-badge badge-current';
            badge.textContent = 'Current';
            headerRight.appendChild(badge);
        } else if (isNewer) {
            const badge = document.createElement('span');
            badge.className = 'version-release-badge badge-new';
            badge.textContent = 'New';
            headerRight.appendChild(badge);
        }

        const dateSpan = document.createElement('span');
        dateSpan.className = 'version-release-date';
        dateSpan.textContent = r.date;
        headerRight.appendChild(dateSpan);

        const expandIcon = document.createElement('span');
        expandIcon.className = 'version-expand-icon';
        expandIcon.innerHTML = '▼'; // Simple down arrow
        headerRight.appendChild(expandIcon);

        header.appendChild(versionSpan);
        header.appendChild(headerRight);

        const body = document.createElement('div');
        body.className = 'version-release-body';
        body.innerHTML = simpleMarkdown(r.body);

        // Toggle expansion on click
        header.addEventListener('click', () => {
            item.classList.toggle('expanded');
        });

        item.appendChild(header);
        item.appendChild(body);
        versionReleasesEl.appendChild(item);
    });
}

// ── Simple version comparison for renderer ──────────────────────────────────────
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

// ── Update Banner Logic ─────────────────────────────────────────────────────────
async function startDownload() {
    if (updateState === 'downloading' || updateState === 'ready') return;

    updateState = 'downloading';
    updateBanner.className = 'update-banner downloading';
    updateBannerText.textContent = '📥 Downloading update... 0%';
    updateBannerFill.style.width = '0%';

    const result = await window.electronAPI.downloadUpdate();

    if (result.success) {
        updateState = 'ready';
        updateBanner.className = 'update-banner ready';
        updateBannerText.textContent = '✨ Restart to Install';
        updateBannerFill.style.width = '100%';
        rlog.info('Update download complete, ready to install');
    } else {
        updateState = 'error';
        updateBanner.className = 'update-banner';
        updateBannerText.textContent = '❌ Download failed — click to retry';
        updateBannerFill.style.width = '0%';
        rlog.error('Update download failed: ' + result.error);
    }
}

window.electronAPI.onDownloadProgress((data) => {
    if (updateState !== 'downloading') return;
    const p = data.percent;
    updateBannerFill.style.width = p + '%';
    updateBannerText.textContent = `📥 Downloading update... ${p}%`;
});

updateBanner.addEventListener('click', async () => {
    if (updateState === 'available' || updateState === 'error') {
        startDownload();
    } else if (updateState === 'ready') {
        await window.electronAPI.installUpdate();
    }
});

window.electronAPI.onUpdateAvailable((data) => {
    cachedReleases = data.releases;
    cachedCurrentVersion = data.currentVersion;

    if (data.hasUpdate) {
        updateBanner.style.display = 'block';

        if (data.autoUpdate && data.hasExeAsset) {
            // Auto-download: immediately start
            updateState = 'available';
            startDownload();
        } else if (data.hasExeAsset) {
            // Manual: show blue banner
            updateState = 'available';
            updateBannerText.textContent = `🔔 Update ${data.latestVersion} available — click to download`;
        } else {
            // No .exe asset: fallback to external link
            updateState = 'external-only';
            updateBannerText.textContent = `🔔 Update ${data.latestVersion} available`;
            updateBanner.addEventListener('click', () => {
                const latest = data.releases.find(r => !r.prerelease);
                if (latest) window.electronAPI.openExternal(latest.url);
            }, { once: true });
        }
    }
});
