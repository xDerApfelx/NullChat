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
const connQualityBars = document.getElementById('conn-quality-bars');
const toastContainer = document.getElementById('toast-container');
const MAX_VISIBLE_TOASTS = 4;
const toastQueue = [];
let activeToasts = 0;

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

// Chat persistence elements
const recordMenuWrap = document.getElementById('record-menu-wrap');
const recordBtn = document.getElementById('record-btn');
const recordDropdown = document.getElementById('record-dropdown');
const recordStartBtn = document.getElementById('record-start-btn');
const recordDeleteBtn = document.getElementById('record-delete-btn');
const recordingQuill = document.getElementById('recording-quill');
const recordingSize = document.getElementById('recording-size');
const statusBarDisk = document.getElementById('status-bar-disk');
const statusBarRam = document.getElementById('status-bar-ram');
const ramSizeEl = document.getElementById('ram-size');
const ramClearBtn = document.getElementById('ram-clear-btn');
const recordingOverlay = document.getElementById('recording-overlay');
const recordingModalText = document.getElementById('recording-modal-text');
const recordingAcceptBtn = document.getElementById('recording-accept-btn');
const recordingDeclineBtn = document.getElementById('recording-decline-btn');
const deathOverlay = document.getElementById('death-overlay');
const deathConfirmBtn = document.getElementById('death-confirm-btn');
const deathCancelBtn = document.getElementById('death-cancel-btn');
const callingOverlay = document.getElementById('calling-overlay');
const callingAvatar = document.getElementById('calling-avatar');
const callingName = document.getElementById('calling-name');
const callingStatus = document.getElementById('calling-status');
const callingCountdown = document.getElementById('calling-countdown');
const callingCancelBtn = document.getElementById('calling-cancel-btn');
const requestCountdownEl = document.getElementById('request-countdown');
const peerMuteIndicator = document.getElementById('peer-mute-indicator');
const recordingPausedBadge = document.getElementById('recording-paused-badge');
// Chat search elements
const searchToggleBtn = document.getElementById('search-toggle-btn');
const chatSearchBar = document.getElementById('chat-search-bar');
const chatSearchInput = document.getElementById('chat-search-input');
const chatSearchCount = document.getElementById('chat-search-count');
const chatSearchPrev = document.getElementById('chat-search-prev');
const chatSearchNext = document.getElementById('chat-search-next');
const chatSearchClose = document.getElementById('chat-search-close');

// Welcome popup elements
const welcomeOverlay = document.getElementById('welcome-overlay');
const welcomeCloseBtn = document.getElementById('welcome-close-btn');
const welcomeDontShow = document.getElementById('welcome-dont-show');
const welcomeGithubLink = document.getElementById('welcome-github-link');
// historyLoader is re-queried dynamically since chatMessages.innerHTML resets it

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
const CALL_TIMEOUT_MS = 60000;
const OUTGOING_CALL_TIMEOUT_MS = 60000;
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

// Chat persistence state
let isRecording = false;             // Is chat recording active?
let isRecordingPaused = false;       // Paused because group chat is active?
let recordingPeerId = null;          // The friend we are recording with (1-on-1 only)
let oldestLoadedMsgId = 0;           // For lazy loading pagination
let isLoadingHistory = false;        // Prevent concurrent history loads
let historySeparatorAdded = false;    // Track if we added the "new messages" separator
let recordingSizeInterval = null;    // Periodic size update timer
let recordingRequestPending = false; // Prevent duplicate recording requests

// File transfer state
const activeOutgoingTransfers = new Map(); // transferId → { file, peerId, sentChunks, totalChunks, status }
const activeIncomingTransfers = new Map(); // transferId → { chunks[], metadata, receivedCount }
const fileCache = new Map();               // transferId → { blob, blobUrl, fileName, fileType, fileSize, timestamp }
const CHUNK_SIZE = 14336;                  // 14KB raw (≈19KB as base64+JSON, under SCTP limit)
const AUTO_ACCEPT_THRESHOLD = 10 * 1024 * 1024; // 10MB
const FILE_CACHE_TTL = 60 * 60 * 1000;    // 1 hour

// Keyboard shortcuts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const DEFAULT_SHORTCUTS = { mute: 'Ctrl+M', disconnect: 'Ctrl+D' };
const SHORTCUT_LABELS = { mute: 'Toggle Mute', disconnect: 'Disconnect' };
let recordingShortcutAction = null;
let fileCacheCleanupInterval = null;

// Outgoing call state
let isCallingOutgoing = false;       // Is an outgoing call in progress?
let callingPeerId = null;            // Peer ID of the outgoing call
let outgoingCallTimeoutId = null;    // 30s total timeout
let callingCountdownId = null;       // Countdown interval for calling overlay
let requestCountdownId = null;       // Countdown interval for request overlay
const remoteMuteStates = new Map();  // Map<PeerId, boolean> — remote peer mute states

// Online status check state
const friendOnlineStatus = new Map();  // Map<PeerId, boolean>
let onlineCheckInterval = null;
const pendingStatusChecks = new Set(); // Peer IDs being probed (suppress peer-unavailable errors)

// Chat search state
let searchResults = [];         // Array of { id, sender, text, timestamp }
let searchCurrentIndex = -1;    // Currently focused result index
let searchDebounceId = null;

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
let ringtoneTestActive = false;

function resetRingtoneTestBtn() {
    ringtoneTestActive = false;
    const btn = document.getElementById('ringtone-test-btn');
    if (btn) {
        btn.textContent = '▶ Test';
        btn.classList.remove('playing');
    }
}

function startRinging() {
    ringtoneLoops = 0;
    ringtone.currentTime = 0;
    ringtone.play().catch(() => { });
}

ringtone.addEventListener('ended', () => {
    ringtoneLoops++;
    // IMPORTANT: Ringtone plays exactly 2 times. Do NOT change this value. Confirmed by project owner.
    if (ringtoneLoops < 2) {
        ringtone.currentTime = 0;
        ringtone.play().catch(() => { });
    } else if (ringtoneTestActive) {
        resetRingtoneTestBtn();
    }
});

function stopRinging() {
    ringtone.pause();
    ringtone.currentTime = 0;
    ringtoneLoops = 0;
}

// ── Desktop notification helper ─────────────────────────────────────────────────
function notifyDesktop(title, body) {
    if (!appSettings.notificationsEnabled) return;
    if (document.hasFocus()) return;
    window.electronAPI.showNotification(title, body);
}

// ── Notification sound helper (Web Audio API beeps) ─────────────────────────────
let notifAudioCtx = null;

function playNotifSound(name) {
    if (!appSettings.notificationSounds) return;
    try {
        if (!notifAudioCtx) notifAudioCtx = new AudioContext();
        const osc = notifAudioCtx.createOscillator();
        const gain = notifAudioCtx.createGain();
        osc.connect(gain);
        gain.connect(notifAudioCtx.destination);
        gain.gain.value = 0.15;

        const now = notifAudioCtx.currentTime;
        switch (name) {
            case 'message':
                osc.frequency.value = 800;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            case 'file':
                osc.frequency.value = 600;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
                break;
            case 'connected':
                osc.frequency.value = 520;
                osc.type = 'sine';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.setValueAtTime(700, now + 0.1);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'disconnected':
                osc.frequency.value = 500;
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, now);
                osc.frequency.setValueAtTime(350, now + 0.1);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
                break;
            default:
                osc.frequency.value = 660;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
        }
    } catch (_) { }
}

// ── Default-mute helper ─────────────────────────────────────────────────────────
function applyDefaultMute() {
    if (localStream) {
        localStream.getAudioTracks().forEach(t => t.enabled = false);
    }
    isMuted = true;
    muteBtn.textContent = '🔇 Unmute';
    muteBtn.classList.add('muted');
    // Broadcast mute state so the remote side sees we're muted
    const muteMsg = JSON.stringify({ type: 'mute-state', muted: true });
    connections.forEach(c => { try { if (c.open) c.send(muteMsg); } catch {} });
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

// ── Online status check ────────────────────────────────────────────────────────
function startOnlineChecks() {
    if (onlineCheckInterval) return;
    checkFriendsOnlineStatus();
    onlineCheckInterval = setInterval(checkFriendsOnlineStatus, 60000);
}

function stopOnlineChecks() {
    if (onlineCheckInterval) {
        clearInterval(onlineCheckInterval);
        onlineCheckInterval = null;
    }
}

function checkFriendsOnlineStatus() {
    if (!peer || peer.disconnected || peer.destroyed) return;
    if (!document.hasFocus()) return;
    if (friendsData.friends.length === 0) return;

    friendsData.friends.forEach(friend => {
        // Already connected — definitely online
        if (connectedPeers.has(friend.id)) {
            if (!friendOnlineStatus.get(friend.id)) {
                friendOnlineStatus.set(friend.id, true);
                renderFriendsList();
            }
            return;
        }

        // Already checking this peer
        if (pendingStatusChecks.has(friend.id)) return;

        pendingStatusChecks.add(friend.id);
        try {
            const testConn = peer.connect(friend.id, { metadata: { type: 'status-check' } });
            const timeout = setTimeout(() => {
                pendingStatusChecks.delete(friend.id);
                if (friendOnlineStatus.get(friend.id) !== false) {
                    friendOnlineStatus.set(friend.id, false);
                    renderFriendsList();
                }
                try { testConn.close(); } catch {}
            }, 5000);

            testConn.on('open', () => {
                clearTimeout(timeout);
                pendingStatusChecks.delete(friend.id);
                if (!friendOnlineStatus.get(friend.id)) {
                    friendOnlineStatus.set(friend.id, true);
                    renderFriendsList();
                }
                try { testConn.close(); } catch {}
            });

            testConn.on('error', () => {
                clearTimeout(timeout);
                pendingStatusChecks.delete(friend.id);
                if (friendOnlineStatus.get(friend.id) !== false) {
                    friendOnlineStatus.set(friend.id, false);
                    renderFriendsList();
                }
            });
        } catch {
            pendingStatusChecks.delete(friend.id);
            friendOnlineStatus.set(friend.id, false);
        }
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

function updatePeerMuteIndicator() {
    // In 1-on-1: show if the single remote peer is muted
    if (connectedPeers.size === 1) {
        const [peerId] = connectedPeers;
        peerMuteIndicator.classList.toggle('hidden', !remoteMuteStates.get(peerId));
    } else {
        peerMuteIndicator.classList.add('hidden');
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
function showToast(message, type = '', duration) {
    // Default duration by type
    if (!duration) {
        if (type === 'error') duration = 6000;
        else if (type === 'warning') duration = 5000;
        else duration = 3500;
    }
    // Queue if max visible reached
    if (activeToasts >= MAX_VISIBLE_TOASTS) {
        toastQueue.push({ message, type, duration });
        return;
    }
    _spawnToast(message, type, duration);
}

function _spawnToast(message, type, duration) {
    activeToasts++;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    toastContainer.appendChild(el);
    // Trigger show animation on next frame
    requestAnimationFrame(() => { el.classList.add('show'); });
    // Auto-dismiss
    setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('hide');
        setTimeout(() => {
            el.remove();
            activeToasts--;
            // Load next from queue
            if (toastQueue.length > 0) {
                const next = toastQueue.shift();
                _spawnToast(next.message, next.type, next.duration);
            }
        }, 300); // match CSS transition duration
    }, duration);
}

// ── Time helper ─────────────────────────────────────────────────────────────────
function timestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Link detection helper ───────────────────────────────────────────────────────
const URL_REGEX = /(?:https?:\/\/|www\.)\S+/gi;

function linkifyText(text) {
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    URL_REGEX.lastIndex = 0;
    while ((match = URL_REGEX.exec(text)) !== null) {
        // Add plain text before the URL
        if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const url = match[0];
        const href = url.startsWith('www.') ? 'https://' + url : url;
        const a = document.createElement('a');
        a.className = 'chat-link';
        a.textContent = url;
        a.title = href;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(href);
        });
        frag.appendChild(a);
        lastIndex = URL_REGEX.lastIndex;
    }
    // Add remaining text
    if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    return frag;
}

// ── DOM: add a chat message ─────────────────────────────────────────────────────
let lastMsgMeta = { sender: null, time: 0 };
let lastTimeSeparator = 0;

function maybeInsertTimeSeparator(now) {
    if (now - lastTimeSeparator >= 5 * 60 * 1000) {
        lastTimeSeparator = now;
        const sep = document.createElement('div');
        sep.className = 'time-separator';
        const label = document.createElement('span');
        label.textContent = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        sep.appendChild(label);
        chatMessages.appendChild(sep);
    }
}

function addMessage(text, sender, senderName) {
    const now = Date.now();
    maybeInsertTimeSeparator(now);

    const grouped = lastMsgMeta.sender === sender && (now - lastMsgMeta.time) < 2 * 60 * 1000;
    lastMsgMeta = { sender, time: now };

    const div = document.createElement('div');
    div.className = 'message ' + sender + (grouped ? ' msg-grouped' : '');

    // Show sender label for friend messages in group chat (not when grouped)
    if (!grouped && sender === 'friend' && senderName && connectedPeers.size > 1) {
        const label = document.createElement('span');
        label.className = 'message-sender';
        label.textContent = senderName;
        div.appendChild(label);
    }

    div.appendChild(linkifyText(text));

    if (!grouped) {
        const time = document.createElement('span');
        time.className = 'timestamp';
        time.textContent = timestamp();
        div.appendChild(time);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateRamDisplay();
}

function addSystemMessage(text, type = 'info') {
    const div = document.createElement('div');
    div.className = 'system-msg system-' + type;
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
    } else {
        friendsSidebar.classList.remove('collapsed');
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
        item.title = friend.name; // Tooltip for mini-sidebar (avatar-only) mode

        const avatar = document.createElement('div');
        avatar.className = 'friend-item-avatar';
        avatar.textContent = friend.name[0].toUpperCase();

        const statusDot = document.createElement('span');
        const isOnline = connectedPeers.has(friend.id) || friendOnlineStatus.get(friend.id);
        statusDot.className = 'friend-status-dot ' + (isOnline ? 'online' : 'offline');
        statusDot.title = connectedPeers.has(friend.id) ? 'Connected' : (isOnline ? 'Online' : 'Offline');
        avatar.appendChild(statusDot);

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

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${friend.name || friend.id}"? All chat history will also be deleted.`)) return;
            friendsData.friends = friendsData.friends.filter(f => f.id !== friend.id);
            saveFriends();
            await window.electronAPI.chatDelete(friend.id);
            renderFriendsList();
            rlog.info('Friend removed from contacts (chat history cleared)');
            showToast('Contact removed', 'success');
        });

        item.appendChild(avatar);
        item.appendChild(name);
        item.appendChild(deleteBtn);
        friendsListEl.appendChild(item);
    });
}

// ── View switching ──────────────────────────────────────────────────────────────
async function showChat(peerId) {
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

    document.querySelector('.login-actions').style.display = 'none';
    loginView.style.display = 'none';
    chatView.style.display = 'flex';
    hideNewsFeed();

    // Reset history tracking
    oldestLoadedMsgId = 0;
    historySeparatorAdded = false;
    lastMsgMeta = { sender: null, time: 0 };
    lastTimeSeparator = 0;

    // Check if recording was active for this peer & load history
    const wasRecording = await window.electronAPI.chatGetRecording(peerId);
    const hasHistory = await window.electronAPI.chatExists(peerId);

    if (wasRecording && hasHistory) {
        // Resume recording and load chat history
        isRecording = true;
        isRecordingPaused = false;
        recordingPeerId = peerId;
        await loadChatHistory(peerId, true);
        // Notify peer that recording is still active
        const conn = connections.get(peerId);
        if (conn && conn.open) {
            conn.send(JSON.stringify({ type: 'recording-status', recording: true }));
        }
    }

    updateRecordingUI();

    const connectMsg = friendName ? `Connected to ${friendName}` : `Connected to ${peerId}`;
    addSystemMessage(connectMsg);
    playNotifSound('connected');
    msgInput.focus();
    updateParticipantList();
}

function showLogin() {
    currentPeerId = null;
    inSession = false;
    chatView.style.display = 'none';
    // Show login-actions first (fixed position), then login-view to avoid layout flash
    document.querySelector('.login-actions').style.display = 'flex';
    loginView.style.display = 'flex';
    chatMessages.innerHTML = '<div class="history-loader hidden" id="history-loader">Loading older messages...</div>';
    // Show current connection status
    if (peer && !peer.disconnected && !peer.destroyed) {
        statusText.textContent = 'Ready to connect';
        statusText.className = 'status-text success';
    } else {
        statusText.textContent = 'Disconnected from server. Click Reconnect.';
        statusText.className = 'status-text error';
    }
    connectBtn.disabled = false;
    friendIdInput.value = '';
    isMuted = false;
    muteBtn.textContent = '🎤 Mute';
    muteBtn.classList.remove('muted');
    if (participantBar) participantBar.style.display = 'none';
    if (participantList) participantList.innerHTML = '';
    if (connQualityBars) connQualityBars.classList.add('hidden');

    // Close search if open
    closeSearch();

    // Reset local recording state (DB state persists for resume on reconnect)
    isRecording = false;
    isRecordingPaused = false;
    recordingPeerId = null;
    recordingRequestPending = false;
    if (recordingSizeInterval) {
        clearInterval(recordingSizeInterval);
        recordingSizeInterval = null;
    }
    updateRecordingUI();
    showNewsFeed();

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
        startQualityMonitor();
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
            startQualityMonitor();
        }
        rlog.info('Incoming voice call answered');
    });
}

// ── Parse and handle a single protocol message ─────────────────────────────────
async function handleProtocolMessage(peerId, raw) {
    let msg;
    try {
        msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        msg = { type: 'chat', text: String(raw) };
    }

    // Heartbeat: update last-seen timestamp for any message from this peer
    lastHeartbeat.set(peerId, Date.now());

    switch (msg.type) {
        case 'ping': {
            const conn = connections.get(peerId);
            if (conn && conn.open) conn.send(JSON.stringify({ type: 'pong' }));
            return; // Don't log pings
        }
        case 'pong':
            return; // Silent, timestamp already updated above
        case 'chat': {
            const senderName = getFriendName(peerId) || peerId.substring(0, 8) + '…';
            addMessage(msg.text, 'friend', senderName);
            persistMessage('friend', msg.text);
            notifyDesktop(senderName, msg.text);
            playNotifSound('message');
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
        case 'conn-accepted': {
            if (isCallingOutgoing && callingPeerId === peerId) {
                hideCallingScreen();
                if (!inSession) showChat(peerId);
                rlog.info('Outgoing call accepted by peer');
            }
            break;
        }
        case 'conn-declined': {
            if (isCallingOutgoing && callingPeerId === peerId) {
                hideCallingScreen();
                cleanup();
                showLogin();
                const reason = msg.reason === 'busy' ? 'User is in another call' : 'Call declined';
                showToast(reason, 'error');
                rlog.info('Call declined by peer: ' + (msg.reason || 'declined'));
            }
            break;
        }
        case 'mute-state': {
            remoteMuteStates.set(peerId, !!msg.muted);
            updatePeerMuteIndicator();
            rlog.info('Peer ' + peerId.substring(0, 8) + ' mute state: ' + (msg.muted ? 'muted' : 'unmuted'));
            break;
        }
        case 'recording-request': {
            // Friend wants to start recording
            const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
            recordingModalText.textContent = `${name} wants to record this chat. Do you agree?`;
            recordingOverlay.style.display = 'flex';
            recordingOverlay.dataset.requestFrom = peerId;
            rlog.info('Recording request received from peer');
            break;
        }
        case 'recording-response': {
            recordingRequestPending = false;
            if (msg.accepted) {
                startRecording(peerId);
                showToast('Recording started', 'success');
            } else {
                showToast('Recording declined', '');
                rlog.info('Recording request declined by peer');
            }
            break;
        }
        case 'recording-status': {
            // Sync recording state from peer
            if (msg.recording && !isRecording) {
                isRecording = true;
                recordingPeerId = peerId;
                isRecordingPaused = false;
                updateRecordingUI();
                updateRecordingSize();
            }
            break;
        }
        case 'death-button': {
            // Peer triggered death button — delete our chat too
            // Stop recording first (skipDbWrite=true), then delete DB
            await stopRecording(true);
            await window.electronAPI.chatDelete(peerId);
            addSystemMessage('Chat history has been deleted.', 'warning');
            showToast('Chat history deleted', '');
            rlog.info('Chat deleted by remote peer via death button');
            break;
        }
        case 'file-offer':
            handleFileOffer(peerId, msg);
            break;
        case 'file-accept':
            handleFileAccept(peerId, msg);
            break;
        case 'file-decline':
            handleFileDecline(peerId, msg);
            break;
        case 'file-chunk':
            handleFileChunk(peerId, msg);
            break;
        case 'file-complete':
            await handleFileComplete(peerId, msg);
            break;
        case 'file-cancel':
            handleFileCancel(peerId, msg);
            break;
        default:
            rlog.warn('Unknown message type: ' + (msg.type || 'undefined'));
    }
}

// ── Data connection wiring ──────────────────────────────────────────────────────
function wireConnection(dataConn) {
    const peerId = dataConn.peer;
    connections.set(peerId, dataConn);
    connectedPeers.add(peerId);

    // Immediately mark friend as online in sidebar
    if (isFriend(peerId) && !friendOnlineStatus.get(peerId)) {
        friendOnlineStatus.set(peerId, true);
        renderFriendsList();
    }
    updateAttachBtnState();

    // Remove early handler if one was attached (pending connections)
    if (dataConn._earlyHandler) {
        dataConn.off('data', dataConn._earlyHandler);
        delete dataConn._earlyHandler;
    }

    // Attach the real data handler
    dataConn.on('data', (raw) => handleProtocolMessage(peerId, raw));

    // Initialize heartbeat tracking for this peer
    lastHeartbeat.set(peerId, Date.now());
    startHeartbeat();

    dataConn.on('close', () => {
        removePeer(peerId, 'disconnected');
    });

    dataConn.on('error', (err) => {
        rlog.error('Connection error with peer: ' + err.type);
        showToast('Connection error: ' + err.message, 'error');
    });

    // Always send current mute state to the new peer (so both sides are in sync)
    try { dataConn.send(JSON.stringify({ type: 'mute-state', muted: isMuted })); } catch {}

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
    friendOnlineStatus.set(peerId, false);
    updateAttachBtnState();
    expectedMeshPeers.delete(peerId);
    lastHeartbeat.delete(peerId);
    heartbeatStrikes.delete(peerId);
    remoteMuteStates.delete(peerId);
    updatePeerMuteIndicator();

    // Cancel active file transfers with this peer
    cancelTransfersForPeer(peerId);

    const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
    addSystemMessage(`${name} ${reason}.`, 'warning');
    rlog.info('Peer removed: ' + reason);

    updateParticipantList();

    // If no peers left, stop heartbeat/quality and return to login
    if (connectedPeers.size === 0) {
        stopHeartbeat();
        stopQualityMonitor();
        if (isCallingOutgoing) hideCallingScreen();
        cleanupLocal();
        showLogin();
        showToast('All peers disconnected', 'error');
        playNotifSound('disconnected');
    }
}

// ── Outgoing call screen helpers ─────────────────────────────────────────────
function showCallingScreen(peerId) {
    isCallingOutgoing = true;
    callingPeerId = peerId;
    const friendName = getFriendName(peerId);
    const displayName = friendName || peerId.substring(0, 8) + '…';
    callingAvatar.textContent = displayName[0].toUpperCase();
    callingName.textContent = displayName;
    callingStatus.textContent = 'Calling...';
    callingOverlay.style.display = 'flex';

    // Visual countdown (matches OUTGOING_CALL_TIMEOUT_MS)
    let remaining = Math.floor(OUTGOING_CALL_TIMEOUT_MS / 1000);
    callingCountdown.textContent = remaining + 's';
    if (callingCountdownId) clearInterval(callingCountdownId);
    callingCountdownId = setInterval(() => {
        remaining--;
        callingCountdown.textContent = remaining > 0 ? remaining + 's' : '';
        if (remaining <= 0) clearInterval(callingCountdownId);
    }, 1000);
}

function hideCallingScreen() {
    isCallingOutgoing = false;
    callingPeerId = null;
    callingOverlay.style.display = 'none';
    if (outgoingCallTimeoutId) {
        clearTimeout(outgoingCallTimeoutId);
        outgoingCallTimeoutId = null;
    }
    if (callingCountdownId) {
        clearInterval(callingCountdownId);
        callingCountdownId = null;
    }
}

function showRequestOverlay(peerId) {
    const name = getFriendName(peerId) || peerId.substring(0, 12) + '…';
    requestModalName.textContent = name;
    requestModalId.textContent = peerId;
    requestOverlay.style.display = 'flex';

    // Visual countdown (matches CALL_TIMEOUT_MS)
    let remaining = Math.floor(CALL_TIMEOUT_MS / 1000);
    requestCountdownEl.textContent = remaining + 's';
    if (requestCountdownId) clearInterval(requestCountdownId);
    requestCountdownId = setInterval(() => {
        remaining--;
        requestCountdownEl.textContent = remaining > 0 ? remaining + 's' : '';
        if (remaining <= 0) clearInterval(requestCountdownId);
    }, 1000);
}

function hideRequestOverlay() {
    requestOverlay.style.display = 'none';
    requestAcceptBtn.disabled = false;
    requestDeclineBtn.disabled = false;
    if (requestCountdownId) {
        clearInterval(requestCountdownId);
        requestCountdownId = null;
    }
}

// ── Connect to a peer (outgoing) ────────────────────────────────────────────────
function connectToPeer(peerId, isMeshTriggered) {
    if (connectedPeers.has(peerId) || peerId === myId) return;

    const outgoing = peer.connect(peerId, { reliable: true });

    outgoing.on('open', () => {
        wireConnection(outgoing);

        if (!inSession && !isMeshTriggered) {
            // Show calling screen instead of jumping straight to chat
            showCallingScreen(peerId);

            // Total timeout: abort call after 30s if peer never accepts
            outgoingCallTimeoutId = setTimeout(() => {
                if (isCallingOutgoing && callingPeerId === peerId) {
                    rlog.info('Outgoing call timed out');
                    hideCallingScreen();
                    cleanup();
                    showLogin();
                    showToast('Call not answered', 'error');
                }
            }, OUTGOING_CALL_TIMEOUT_MS);

        } else if (inSession) {
            const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
            addSystemMessage(`${name} joined the call.`);
            showToast(`${name} joined`, 'success');
        }

        rlog.info('Outgoing connection established' + (isMeshTriggered ? ' (mesh)' : ''));
        initiateVoiceCall(peerId);
    });

    outgoing.on('error', (err) => {
        rlog.error('Outgoing connection failed: ' + err.type);
        hideCallingScreen();
        if (!isMeshTriggered) {
            if (err.type === 'peer-unavailable') {
                const name = getFriendName(peerId);
                if (name) {
                    statusText.textContent = `${name} is currently offline`;
                } else {
                    statusText.textContent = 'Peer not found — check the ID and try again';
                }
            } else {
                statusText.textContent = 'Connection failed: ' + err.message;
            }
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
// ── Chat Persistence Helpers ──────────────────────────────────────────────────

/**
 * Format bytes to human-readable size string.
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format ISO timestamp to readable time.
 */
function formatTimestamp(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Same day: just show time
    if (d.toDateString() === now.toDateString()) return time;

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday ' + time;

    // Older: show date + time
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + time;
}

/**
 * Trigger the quill wiggle animation.
 */
function wiggleQuill() {
    if (!recordingQuill) return;
    recordingQuill.classList.remove('wiggle');
    // Force reflow to restart animation
    void recordingQuill.offsetWidth;
    recordingQuill.classList.add('wiggle');
}

/**
 * Update the recording size display.
 */
async function updateRecordingSize() {
    if (!recordingPeerId) return;
    const size = await window.electronAPI.chatGetSize(recordingPeerId);
    if (recordingSize) recordingSize.textContent = formatSize(size);
}

/**
 * Show/hide recording UI elements based on state.
 */
function updateRecordingUI() {
    const is1on1 = connectedPeers.size === 1;

    // Record menu: show in 1-on-1 chats (dropdown items adapt to state)
    if (recordMenuWrap) {
        recordMenuWrap.classList.toggle('hidden', !is1on1);
    }
    // Close dropdown when state changes
    if (recordDropdown) {
        recordDropdown.classList.add('hidden');
    }

    // Search toggle: show when recording is active (has searchable history)
    if (searchToggleBtn) {
        searchToggleBtn.classList.toggle('hidden', !isRecording);
    }

    // Update disk side of status bar
    if (statusBarDisk) {
        statusBarDisk.classList.toggle('recording', isRecording && !isRecordingPaused);
        if (!isRecording) {
            recordingSize.textContent = '—';
        }
    }

    // Periodic size updates
    if (isRecording && !recordingSizeInterval) {
        recordingSizeInterval = setInterval(updateRecordingSize, 30000);
    } else if (!isRecording && recordingSizeInterval) {
        clearInterval(recordingSizeInterval);
        recordingSizeInterval = null;
    }

    updateRecordingPausedBadge();
}

function updateRecordingPausedBadge() {
    if (recordingPausedBadge) {
        recordingPausedBadge.classList.toggle('hidden', !isRecordingPaused);
    }
}

// ── Chat Search ─────────────────────────────────────────────────────────────────

function openSearch() {
    if (!isRecording || !recordingPeerId) {
        showToast('Search is only available when chat recording is active', 'warning');
        return;
    }
    chatSearchBar.classList.remove('hidden');
    chatSearchInput.value = '';
    chatSearchCount.textContent = '';
    searchResults = [];
    searchCurrentIndex = -1;
    updateSearchNavButtons();
    chatSearchInput.focus();
}

function closeSearch() {
    if (chatSearchBar) chatSearchBar.classList.add('hidden');
    if (chatSearchInput) chatSearchInput.value = '';
    if (chatSearchCount) chatSearchCount.textContent = '';
    searchResults = [];
    searchCurrentIndex = -1;
    clearSearchHighlights();
    if (searchDebounceId) {
        clearTimeout(searchDebounceId);
        searchDebounceId = null;
    }
}

function clearSearchHighlights() {
    chatMessages.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight');
    });
    // Remove injected <mark> highlights
    chatMessages.querySelectorAll('mark.search-term').forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
    });
}

function updateSearchNavButtons() {
    const hasResults = searchResults.length > 0;
    if (chatSearchPrev) chatSearchPrev.disabled = !hasResults;
    if (chatSearchNext) chatSearchNext.disabled = !hasResults;
}

async function performSearch(query) {
    clearSearchHighlights();
    searchResults = [];
    searchCurrentIndex = -1;

    if (!query || query.trim().length === 0 || !recordingPeerId) {
        chatSearchCount.textContent = '';
        updateSearchNavButtons();
        return;
    }

    const results = await window.electronAPI.chatSearch(recordingPeerId, query.trim(), 100);
    searchResults = results;

    if (results.length === 0) {
        chatSearchCount.textContent = 'No results';
        updateSearchNavButtons();
        return;
    }

    chatSearchCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    updateSearchNavButtons();

    // Highlight all matching messages that are currently in the DOM
    highlightSearchResults();

    // Navigate to the most recent result (first in array, since results are newest-first)
    searchCurrentIndex = 0;
    navigateToSearchResult();
}

function highlightSearchResults() {
    clearSearchHighlights();
    const query = chatSearchInput.value.trim().toLowerCase();
    for (const result of searchResults) {
        const msgEl = chatMessages.querySelector(`[data-msg-id="${result.id}"]`);
        if (msgEl) {
            msgEl.classList.add('search-highlight');
            if (query) highlightTextInElement(msgEl, query);
        }
    }
}

function highlightTextInElement(el, query) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
        // Skip timestamp, sender label etc.
        if (node.parentElement.closest('.timestamp, .message-sender')) continue;
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        const idx = lowerText.indexOf(query);
        if (idx === -1) continue;

        const before = text.substring(0, idx);
        const match = text.substring(idx, idx + query.length);
        const after = text.substring(idx + query.length);

        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        const mark = document.createElement('mark');
        mark.className = 'search-term';
        mark.textContent = match;
        frag.appendChild(mark);
        if (after) frag.appendChild(document.createTextNode(after));
        node.parentNode.replaceChild(frag, node);
    }
}

function navigateToSearchResult() {
    if (searchResults.length === 0 || searchCurrentIndex < 0) return;

    const result = searchResults[searchCurrentIndex];
    chatSearchCount.textContent = `${searchCurrentIndex + 1} / ${searchResults.length}`;

    // Try to find the message in DOM
    const msgEl = chatMessages.querySelector(`[data-msg-id="${result.id}"]`);
    if (msgEl) {
        // Remove highlight from previously focused result
        chatMessages.querySelectorAll('.search-highlight').forEach(el => {
            el.style.outlineColor = '';
        });
        msgEl.classList.add('search-highlight');
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Message not in DOM — show toast with info
        const date = new Date(result.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        showToast(`Result found at ${dateStr} — scroll up to load older messages`, 'info');
    }
}

function searchPrev() {
    if (searchResults.length === 0) return;
    searchCurrentIndex = (searchCurrentIndex + 1) % searchResults.length;
    navigateToSearchResult();
}

function searchNext() {
    if (searchResults.length === 0) return;
    searchCurrentIndex = (searchCurrentIndex - 1 + searchResults.length) % searchResults.length;
    navigateToSearchResult();
}

/**
 * Check if recording should be paused/resumed based on group size.
 */
function checkRecordingGroupState() {
    if (!isRecording || !recordingPeerId) return;

    const peerCount = connectedPeers.size;

    if (peerCount > 1 && !isRecordingPaused) {
        // Group chat started — pause recording
        isRecordingPaused = true;
        addSystemMessage('Recording paused — group chat active', 'warning');
        showToast('Recording paused — group chat active', 'warning');
        rlog.info('Recording paused: group chat detected');
    } else if (peerCount === 1 && isRecordingPaused && connectedPeers.has(recordingPeerId)) {
        // Back to 1-on-1 with original peer — resume
        isRecordingPaused = false;
        addSystemMessage('Recording resumed');
        showToast('Recording resumed', 'success');
        rlog.info('Recording resumed: back to 1-on-1');
    }

    updateRecordingUI();
    updateRecordingPausedBadge();
}

/**
 * Start recording: called after both sides agree.
 */
async function startRecording(friendPeerId) {
    isRecording = true;
    isRecordingPaused = false;
    recordingPeerId = friendPeerId;
    await window.electronAPI.chatSetRecording(friendPeerId, true);
    updateRecordingUI();
    updateRecordingSize();
    addSystemMessage('Chat recording started');
    rlog.info('Chat recording started');
}

/**
 * Stop recording.
 * @param {boolean} skipDbWrite - true when DB was already deleted (death button)
 */
async function stopRecording(skipDbWrite = false) {
    if (recordingPeerId && !skipDbWrite) {
        await window.electronAPI.chatSetRecording(recordingPeerId, false);
    }
    isRecording = false;
    isRecordingPaused = false;
    recordingPeerId = null;
    if (recordingSize) recordingSize.textContent = '0 KB';
    updateRecordingUI();
}

/**
 * Save a message to persistent storage (if recording and not paused).
 */
async function persistMessage(sender, text, msgType = 'text') {
    if (!isRecording || isRecordingPaused || !recordingPeerId) return;
    const result = await window.electronAPI.chatSaveMessage(recordingPeerId, sender, text, msgType);
    // Tag the most recently added message element with its DB id for search navigation
    if (result && result.id) {
        const msgs = chatMessages.querySelectorAll('.message:not([data-msg-id])');
        const last = msgs[msgs.length - 1];
        if (last) last.dataset.msgId = result.id;
    }
    wiggleQuill();
    updateRecordingSize();
}

/**
 * Load chat history for a peer (lazy loading).
 */
async function loadChatHistory(friendPeerId, initial = true) {
    if (isLoadingHistory) return;
    isLoadingHistory = true;

    const historyLoader = document.getElementById('history-loader');
    if (historyLoader) historyLoader.classList.remove('hidden');

    const messages = await window.electronAPI.chatLoadMessages(
        friendPeerId,
        50,
        initial ? 0 : oldestLoadedMsgId
    );

    if (historyLoader) historyLoader.classList.add('hidden');

    if (messages.length === 0) {
        // Show "no older messages" when scrolling back and nothing more to load
        if (!initial && oldestLoadedMsgId > 0) {
            const notice = document.createElement('div');
            notice.className = 'history-end-notice';
            notice.textContent = 'No older messages';
            const loader = document.getElementById('history-loader');
            chatMessages.insertBefore(notice, loader ? loader.nextSibling : chatMessages.firstChild);
            oldestLoadedMsgId = 0; // Prevent further load attempts
        }
        isLoadingHistory = false;
        return;
    }

    // Track oldest message ID for pagination
    oldestLoadedMsgId = messages[0].id;

    // Remember scroll position to maintain after prepending
    const prevScrollHeight = chatMessages.scrollHeight;
    const prevScrollTop = chatMessages.scrollTop;

    // Insert messages at the top (after the history-loader)
    const loader = document.getElementById('history-loader');
    const insertBefore = loader ? loader.nextSibling : chatMessages.firstChild;

    let prevHistMsg = null;
    let prevHistTimeSep = 0;

    for (const msg of messages) {
        const msgTime = new Date(msg.timestamp).getTime();
        const sender = msg.sender === 'self' ? 'self' : 'friend';

        // Insert time separator if >= 5min gap
        if (msgTime - prevHistTimeSep >= 5 * 60 * 1000) {
            prevHistTimeSep = msgTime;
            const sep = document.createElement('div');
            sep.className = 'time-separator';
            const label = document.createElement('span');
            label.textContent = formatTimestamp(msg.timestamp);
            sep.appendChild(label);
            chatMessages.insertBefore(sep, insertBefore);
        }

        const grouped = prevHistMsg && prevHistMsg.sender === sender
            && (msgTime - prevHistMsg.time) < 2 * 60 * 1000;
        prevHistMsg = { sender, time: msgTime };

        const div = document.createElement('div');
        div.className = 'message ' + sender + ' history-msg' + (grouped ? ' msg-grouped' : '');
        div.dataset.msgId = msg.id;

        if (msg.msgType === 'file-ref') {
            // Render file reference from recording history
            try {
                const ref = JSON.parse(msg.text);
                const fileWrap = document.createElement('div');
                fileWrap.className = 'file-msg file-msg-history';
                const iconWrap = document.createElement('div');
                iconWrap.className = 'file-icon-wrap';
                const ext = (ref.fileName || '').split('.').pop().toUpperCase();
                iconWrap.textContent = ext.length <= 4 ? ext : '📄';
                fileWrap.appendChild(iconWrap);
                const info = document.createElement('div');
                info.className = 'file-info';
                const nameEl = document.createElement('div');
                nameEl.className = 'file-name';
                nameEl.textContent = ref.fileName || 'Unknown file';
                info.appendChild(nameEl);
                const sizeEl = document.createElement('div');
                sizeEl.className = 'file-size';
                sizeEl.textContent = formatFileSize(ref.fileSize || 0) + ' — file no longer available';
                info.appendChild(sizeEl);
                fileWrap.appendChild(info);
                div.appendChild(fileWrap);
            } catch {
                div.appendChild(linkifyText(msg.text));
            }
        } else {
            div.appendChild(linkifyText(msg.text));
        }

        if (!grouped) {
            const time = document.createElement('span');
            time.className = 'msg-timestamp';
            time.textContent = formatTimestamp(msg.timestamp);
            div.appendChild(time);
        }

        chatMessages.insertBefore(div, insertBefore);
    }

    // Add separator between history and new messages (only on initial load)
    if (initial && messages.length > 0 && !historySeparatorAdded) {
        const sep = document.createElement('div');
        sep.className = 'history-separator';
        sep.textContent = 'New Messages';
        chatMessages.insertBefore(sep, insertBefore);
        historySeparatorAdded = true;
    }

    if (initial) {
        // Scroll to bottom on initial load
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
        // Maintain scroll position after prepending
        chatMessages.scrollTop = chatMessages.scrollHeight - prevScrollHeight + prevScrollTop;
    }

    isLoadingHistory = false;
}

/**
 * Set up scroll listener for lazy loading older messages.
 */
function setupHistoryScrollListener() {
    chatMessages.addEventListener('scroll', () => {
        if (chatMessages.scrollTop < 100 && !isLoadingHistory && oldestLoadedMsgId > 0 && recordingPeerId) {
            loadChatHistory(recordingPeerId, false);
        }
    });
}

/**
 * Handle auto-cleanup warnings and deletions on startup.
 */
async function checkChatCleanup() {
    const result = await window.electronAPI.chatCheckCleanup();

    if (result.deleted.length > 0) {
        for (const friendId of result.deleted) {
            const name = getFriendName(friendId) || friendId.substring(0, 8) + '…';
            rlog.info('Auto-deleted inactive chat for: ' + name);
        }
    }

    if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
            const name = getFriendName(warning.friendId) || warning.friendId.substring(0, 8) + '…';
            showToast(`Chat with ${name} will be deleted in ${warning.daysUntilDeletion} days (inactive)`, '');
        }
    }
}

// ── File Transfer Functions ──────────────────────────────────────────────────

function generateTransferId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function isImageFile(fileType) {
    return fileType && fileType.startsWith('image/');
}

async function generateThumbnail(file, maxW, maxH) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxW || h > maxH) {
                const ratio = Math.min(maxW / w, maxH / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

async function computeSHA256(blob) {
    const buffer = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function readAsBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function evictFileFromCache(transferId) {
    const entry = fileCache.get(transferId);
    if (!entry) return;
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
    fileCache.delete(transferId);
    // Update UI to show expired
    const countdownWrap = document.getElementById('file-countdown-' + transferId);
    if (countdownWrap) countdownWrap.remove();
    const actions = document.getElementById('file-actions-' + transferId);
    if (actions) {
        actions.innerHTML = '';
        const label = document.createElement('span');
        label.className = 'file-status-label file-status-cancelled';
        label.textContent = 'Removed';
        actions.appendChild(label);
    }
    updateFileCacheBar();
}

function cleanupFileCache() {
    const now = Date.now();
    for (const [transferId, entry] of fileCache) {
        if (now - entry.timestamp > FILE_CACHE_TTL) {
            evictFileFromCache(transferId);
        }
    }
    // Update all countdown timers
    updateAllCountdowns();
    updateFileCacheBar();
}

function startFileCacheCleanup() {
    if (!fileCacheCleanupInterval) {
        // Run every 1s for smooth countdown updates
        fileCacheCleanupInterval = setInterval(cleanupFileCache, 1000);
    }
}

function clearFileCache() {
    const ids = [...fileCache.keys()];
    for (const transferId of ids) {
        evictFileFromCache(transferId);
    }
    updateFileCacheBar();
}

function updateAllCountdowns() {
    const now = Date.now();
    for (const [transferId, entry] of fileCache) {
        const remaining = Math.max(0, FILE_CACHE_TTL - (now - entry.timestamp));
        const fraction = remaining / FILE_CACHE_TTL;
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        const ring = document.querySelector(`#file-countdown-${transferId} .countdown-ring-progress`);
        const text = document.getElementById('file-countdown-text-' + transferId);
        if (ring) {
            const circumference = 2 * Math.PI * 16;
            ring.style.strokeDashoffset = circumference * (1 - fraction);
        }
        if (text) {
            text.textContent = minutes > 0 ? `${minutes}m` : `${seconds}s`;
        }
    }
}

function getFileCacheTotalSize() {
    let total = 0;
    for (const [, entry] of fileCache) {
        total += entry.fileSize;
    }
    return total;
}

function updateFileCacheBar() {
    updateRamDisplay();
}

function getMessageRamSize() {
    // Estimate RAM from DOM messages: count message elements and estimate ~500 bytes each
    // Plus image elements which are heavier
    const msgs = chatMessages.querySelectorAll('.message');
    let estimate = msgs.length * 500;
    const images = chatMessages.querySelectorAll('img');
    images.forEach(img => {
        // Each displayed image blob can be several hundred KB
        estimate += 200 * 1024;
    });
    return estimate;
}

function updateRamDisplay() {
    if (!ramSizeEl) return;
    const fileCacheTotal = getFileCacheTotalSize();
    const messageRam = getMessageRamSize();
    const total = fileCacheTotal + messageRam;
    ramSizeEl.textContent = formatFileSize(total);
}

function createCountdownElement(transferId) {
    const wrap = document.createElement('div');
    wrap.className = 'file-countdown-wrap';
    wrap.id = 'file-countdown-' + transferId;

    // SVG ring
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'countdown-ring');
    svg.setAttribute('viewBox', '0 0 36 36');
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('class', 'countdown-ring-bg');
    bgCircle.setAttribute('cx', '18');
    bgCircle.setAttribute('cy', '18');
    bgCircle.setAttribute('r', '16');
    svg.appendChild(bgCircle);
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('class', 'countdown-ring-progress');
    progressCircle.setAttribute('cx', '18');
    progressCircle.setAttribute('cy', '18');
    progressCircle.setAttribute('r', '16');
    const circumference = 2 * Math.PI * 16;
    progressCircle.style.strokeDasharray = circumference;
    progressCircle.style.strokeDashoffset = '0';
    svg.appendChild(progressCircle);
    wrap.appendChild(svg);

    // Time text inside ring
    const timeText = document.createElement('span');
    timeText.className = 'countdown-text';
    timeText.id = 'file-countdown-text-' + transferId;
    timeText.textContent = '60m';
    wrap.appendChild(timeText);

    return wrap;
}

function cancelTransfersForPeer(peerId) {
    for (const [transferId, transfer] of activeOutgoingTransfers) {
        if (transfer.peerId === peerId) {
            transfer.status = 'failed';
            activeOutgoingTransfers.delete(transferId);
            updateFileMessage(transferId, 'failed');
        }
    }
    for (const [transferId, transfer] of activeIncomingTransfers) {
        if (transfer.metadata.peerId === peerId) {
            activeIncomingTransfers.delete(transferId);
            updateFileMessage(transferId, 'failed');
        }
    }
}

// ── File message UI ─────────────────────────────────────────────────────────

function addFileMessage(transferId, sender, fileName, fileSize, fileType, thumbnail, status) {
    const div = document.createElement('div');
    div.className = 'message ' + sender;
    div.id = 'file-msg-' + transferId;

    const fileWrap = document.createElement('div');
    fileWrap.className = 'file-msg';

    if (thumbnail && isImageFile(fileType)) {
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        const img = document.createElement('img');
        img.className = 'file-thumbnail';
        img.src = thumbnail;
        img.alt = fileName;
        img.addEventListener('click', () => {
            const cached = fileCache.get(transferId);
            if (cached && cached.blobUrl) {
                window.open(cached.blobUrl, '_blank');
            }
        });
        preview.appendChild(img);

        // Progress overlay on thumbnail
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'file-progress-overlay';
        progressOverlay.id = 'file-progress-' + transferId;
        const progressBar = document.createElement('div');
        progressBar.className = 'file-progress-bar';
        progressOverlay.appendChild(progressBar);
        preview.appendChild(progressOverlay);

        fileWrap.appendChild(preview);
    } else {
        const iconWrap = document.createElement('div');
        iconWrap.className = 'file-icon-wrap';
        const ext = fileName.split('.').pop().toUpperCase();
        iconWrap.textContent = ext.length <= 4 ? ext : '📄';

        // Progress overlay on icon
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'file-progress-overlay';
        progressOverlay.id = 'file-progress-' + transferId;
        const progressBar = document.createElement('div');
        progressBar.className = 'file-progress-bar';
        progressOverlay.appendChild(progressBar);
        iconWrap.appendChild(progressOverlay);

        fileWrap.appendChild(iconWrap);
    }

    const info = document.createElement('div');
    info.className = 'file-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'file-name';
    nameEl.textContent = fileName;
    info.appendChild(nameEl);

    const sizeEl = document.createElement('div');
    sizeEl.className = 'file-size';
    sizeEl.textContent = formatFileSize(fileSize);
    info.appendChild(sizeEl);

    const progressText = document.createElement('div');
    progressText.className = 'file-progress-text';
    progressText.id = 'file-progress-text-' + transferId;
    info.appendChild(progressText);

    const actions = document.createElement('div');
    actions.className = 'file-actions';
    actions.id = 'file-actions-' + transferId;

    if (status === 'pending-accept') {
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'file-accept-btn';
        acceptBtn.textContent = 'Accept';
        acceptBtn.addEventListener('click', () => {
            acceptBtn.disabled = true;
            declineBtn.disabled = true;
            acceptFileTransfer(transferId);
        });
        actions.appendChild(acceptBtn);

        const declineBtn = document.createElement('button');
        declineBtn.className = 'file-decline-btn';
        declineBtn.textContent = 'Decline';
        declineBtn.addEventListener('click', () => {
            acceptBtn.disabled = true;
            declineBtn.disabled = true;
            declineFileTransfer(transferId);
        });
        actions.appendChild(declineBtn);
    } else if (status === 'transferring') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'file-decline-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            cancelFileTransfer(transferId);
        });
        actions.appendChild(cancelBtn);
    }

    info.appendChild(actions);
    fileWrap.appendChild(info);

    const time = document.createElement('span');
    time.className = 'timestamp';
    time.textContent = timestamp();
    fileWrap.appendChild(time);

    div.appendChild(fileWrap);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateFileProgress(transferId, progress, transferredBytes, totalBytes) {
    const overlay = document.getElementById('file-progress-' + transferId);
    if (!overlay) return;
    const bar = overlay.querySelector('.file-progress-bar');
    if (bar) {
        bar.style.width = Math.round(progress * 100) + '%';
    }
    if (progress >= 1) {
        overlay.style.display = 'none';
    }
    // Update progress text (percent + bytes)
    const progressText = document.getElementById('file-progress-text-' + transferId);
    if (progressText) {
        if (progress >= 1) {
            progressText.textContent = '';
        } else {
            const pct = Math.round(progress * 100);
            if (totalBytes != null) {
                progressText.textContent = pct + '% — ' + formatFileSize(transferredBytes || 0) + ' / ' + formatFileSize(totalBytes);
            } else {
                progressText.textContent = pct + '%';
            }
        }
    }
}

function updateFileMessage(transferId, status) {
    const actions = document.getElementById('file-actions-' + transferId);
    if (!actions) return;
    actions.innerHTML = '';

    // Remove any existing countdown for this transfer
    const existingCountdown = document.getElementById('file-countdown-' + transferId);
    if (existingCountdown) existingCountdown.remove();

    if (status === 'complete') {
        const cached = fileCache.get(transferId);
        if (cached && isImageFile(cached.fileType)) {
            // Update thumbnail to full blob URL
            const msgEl = document.getElementById('file-msg-' + transferId);
            if (msgEl) {
                const thumb = msgEl.querySelector('.file-thumbnail');
                if (thumb && cached.blobUrl) {
                    thumb.src = cached.blobUrl;
                }
            }
        }

        const saveBtn = document.createElement('button');
        saveBtn.className = 'file-save-btn';
        saveBtn.dataset.transferId = transferId;
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async () => {
            const entry = fileCache.get(transferId);
            if (!entry) {
                showToast('File expired', 'error');
                return;
            }
            const arrayBuf = await entry.blob.arrayBuffer();
            const result = await window.electronAPI.fileSaveAs(entry.fileName, new Uint8Array(arrayBuf));
            if (result) showToast('File saved', 'success');
        });
        actions.appendChild(saveBtn);

        if (cached && isImageFile(cached.fileType)) {
            const openBtn = document.createElement('button');
            openBtn.className = 'file-open-btn';
            openBtn.dataset.transferId = transferId;
            openBtn.textContent = 'Open';
            openBtn.addEventListener('click', () => {
                const entry = fileCache.get(transferId);
                if (entry && entry.blobUrl) window.open(entry.blobUrl, '_blank');
            });
            actions.appendChild(openBtn);
        }

        // Delete from RAM button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'file-delete-btn';
        deleteBtn.title = 'Remove from memory';
        deleteBtn.textContent = '\u2715';
        deleteBtn.addEventListener('click', () => {
            evictFileFromCache(transferId);
            showToast('File removed from memory', 'success');
        });
        actions.appendChild(deleteBtn);

        // Add countdown ring to the file message
        const fileMsg = document.getElementById('file-msg-' + transferId);
        if (fileMsg) {
            const fileMsgWrap = fileMsg.querySelector('.file-msg');
            if (fileMsgWrap) {
                fileMsgWrap.appendChild(createCountdownElement(transferId));
            }
        }

        // Hide progress
        updateFileProgress(transferId, 1);
        updateFileCacheBar();
    } else if (status === 'failed') {
        const label = document.createElement('span');
        label.className = 'file-status-label file-status-failed';
        label.textContent = 'Failed';
        actions.appendChild(label);

        // Retry button — only for outgoing transfers where we still have the file
        const transfer = activeOutgoingTransfers.get(transferId);
        if (transfer && transfer.file) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'file-accept-btn';
            retryBtn.textContent = 'Retry';
            retryBtn.addEventListener('click', () => {
                retryBtn.disabled = true;
                retryFileTransfer(transferId);
            });
            actions.appendChild(retryBtn);
        }

        updateFileProgress(transferId, 1);
    } else if (status === 'cancelled') {
        const label = document.createElement('span');
        label.className = 'file-status-label file-status-cancelled';
        label.textContent = 'Cancelled';
        actions.appendChild(label);
        updateFileProgress(transferId, 1);
    } else if (status === 'declined') {
        const label = document.createElement('span');
        label.className = 'file-status-label file-status-cancelled';
        label.textContent = 'Declined';
        actions.appendChild(label);
    } else if (status === 'retrying') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'file-decline-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => cancelFileTransfer(transferId));
        actions.appendChild(cancelBtn);
        // Reset progress bar
        const overlay = document.getElementById('file-progress-' + transferId);
        if (overlay) {
            overlay.style.display = '';
            const bar = overlay.querySelector('.file-progress-bar');
            if (bar) bar.style.width = '0%';
        }
    }
}

// ── File transfer core ──────────────────────────────────────────────────────

async function initiateFileTransfer(file) {
    if (connections.size === 0) {
        showToast('Not connected', 'error');
        return;
    }
    if (connectedPeers.size > 1) {
        showToast('File sharing is only available in 1-on-1 chats', 'error');
        return;
    }

    const peerId = [...connectedPeers][0];
    const transferId = generateTransferId();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    let thumbnail = null;
    if (isImageFile(file.type)) {
        thumbnail = await generateThumbnail(file, 200, 200);
    }

    // Store transfer state
    activeOutgoingTransfers.set(transferId, {
        file,
        peerId,
        sentChunks: 0,
        totalChunks,
        status: 'pending'
    });

    // Send offer
    const offer = {
        type: 'file-offer',
        transferId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks,
        thumbnail
    };
    const conn = connections.get(peerId);
    if (conn && conn.open) conn.send(JSON.stringify(offer));

    // Add to our own chat
    addFileMessage(transferId, 'self', file.name, file.size, file.type, thumbnail, 'transferring');

    // Also cache the file immediately on sender side
    const blob = file.slice();
    const blobUrl = isImageFile(file.type) ? URL.createObjectURL(blob) : null;
    fileCache.set(transferId, {
        blob, blobUrl, fileName: file.name, fileType: file.type, fileSize: file.size, timestamp: Date.now()
    });
    startFileCacheCleanup();

    rlog.info('File transfer initiated: ' + file.name + ' (' + formatFileSize(file.size) + ')');
}

async function startChunkTransfer(transferId) {
    const transfer = activeOutgoingTransfers.get(transferId);
    if (!transfer) return;

    transfer.status = 'transferring';
    const { file, peerId, totalChunks } = transfer;
    const conn = connections.get(peerId);
    if (!conn || !conn.open) {
        transfer.status = 'failed';
        updateFileMessage(transferId, 'failed');
        // Keep transfer in map so Retry can re-use the file
        return;
    }

    for (let i = 0; i < totalChunks; i++) {
        // Check if transfer was cancelled
        if (!activeOutgoingTransfers.has(transferId)) return;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const base64 = await readAsBase64(chunk);

        const msg = JSON.stringify({
            type: 'file-chunk',
            transferId,
            chunkIndex: i,
            data: base64
        });

        if (!conn.open) {
            transfer.status = 'failed';
            updateFileMessage(transferId, 'failed');
            // Keep transfer in map so Retry can re-use the file
            return;
        }

        conn.send(msg);
        transfer.sentChunks = i + 1;
        const sentBytes = Math.min((i + 1) * CHUNK_SIZE, file.size);
        updateFileProgress(transferId, (i + 1) / totalChunks, sentBytes, file.size);

        // Throttle: pause every 5 chunks
        if ((i + 1) % 5 === 0) {
            await new Promise(r => setTimeout(r, 10));
        }
    }

    // Send completion with checksum
    const checksum = await computeSHA256(file);
    conn.send(JSON.stringify({
        type: 'file-complete',
        transferId,
        checksum
    }));

    transfer.status = 'complete';
    updateFileMessage(transferId, 'complete');
    activeOutgoingTransfers.delete(transferId);

    // Persist file reference if recording
    if (isRecording && recordingPeerId) {
        const fileRef = JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
        });
        await window.electronAPI.chatSaveMessage(recordingPeerId, 'self', fileRef, 'file-ref');
    }

    rlog.info('File transfer complete: ' + file.name);
}

function acceptFileTransfer(transferId) {
    const transfer = activeIncomingTransfers.get(transferId);
    if (!transfer) return;

    const conn = connections.get(transfer.metadata.peerId);
    if (conn && conn.open) {
        conn.send(JSON.stringify({ type: 'file-accept', transferId }));
    }

    // Update UI — replace accept/decline with cancel
    const actions = document.getElementById('file-actions-' + transferId);
    if (actions) {
        actions.innerHTML = '';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'file-decline-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => cancelFileTransfer(transferId));
        actions.appendChild(cancelBtn);
    }
}

function declineFileTransfer(transferId) {
    const transfer = activeIncomingTransfers.get(transferId);
    if (!transfer) return;

    const conn = connections.get(transfer.metadata.peerId);
    if (conn && conn.open) {
        conn.send(JSON.stringify({ type: 'file-decline', transferId }));
    }

    activeIncomingTransfers.delete(transferId);
    updateFileMessage(transferId, 'declined');
}

function cancelFileTransfer(transferId) {
    // Could be outgoing or incoming
    const outgoing = activeOutgoingTransfers.get(transferId);
    const incoming = activeIncomingTransfers.get(transferId);
    const peerId = outgoing?.peerId || incoming?.metadata.peerId;

    if (peerId) {
        const conn = connections.get(peerId);
        if (conn && conn.open) {
            conn.send(JSON.stringify({ type: 'file-cancel', transferId, reason: 'user' }));
        }
    }

    activeOutgoingTransfers.delete(transferId);
    activeIncomingTransfers.delete(transferId);
    updateFileMessage(transferId, 'cancelled');
}

function retryFileTransfer(transferId) {
    const transfer = activeOutgoingTransfers.get(transferId);
    if (!transfer || !transfer.file) {
        showToast('File no longer available', 'error');
        return;
    }

    if (connections.size === 0) {
        showToast('Not connected', 'error');
        return;
    }
    if (connectedPeers.size > 1) {
        showToast('File sharing is only available in 1-on-1 chats', 'error');
        return;
    }

    // Reset transfer state
    const peerId = [...connectedPeers][0];
    transfer.peerId = peerId;
    transfer.sentChunks = 0;
    transfer.status = 'pending';

    // Re-send offer to the (possibly new) peer
    const conn = connections.get(peerId);
    if (!conn || !conn.open) {
        showToast('Connection lost', 'error');
        return;
    }

    const offer = {
        type: 'file-offer',
        transferId,
        fileName: transfer.file.name,
        fileSize: transfer.file.size,
        fileType: transfer.file.type,
        totalChunks: transfer.totalChunks,
        thumbnail: null
    };

    // Re-generate thumbnail if image
    if (isImageFile(transfer.file.type)) {
        generateThumbnail(transfer.file, 200, 200).then(thumb => {
            offer.thumbnail = thumb;
            conn.send(JSON.stringify(offer));
        });
    } else {
        conn.send(JSON.stringify(offer));
    }

    // Update UI — show transferring state
    updateFileMessage(transferId, 'retrying');
    rlog.info('Retrying file transfer: ' + transfer.file.name);
}

// ── File transfer protocol handlers ─────────────────────────────────────────

function handleFileOffer(peerId, msg) {
    const { transferId, fileName, fileSize, fileType, totalChunks, thumbnail } = msg;

    activeIncomingTransfers.set(transferId, {
        chunks: new Array(totalChunks),
        metadata: { peerId, fileName, fileSize, fileType, totalChunks, thumbnail },
        receivedCount: 0
    });

    if (fileSize < AUTO_ACCEPT_THRESHOLD) {
        // Auto-accept small files
        addFileMessage(transferId, 'friend', fileName, fileSize, fileType, thumbnail, 'transferring');
        acceptFileTransfer(transferId);
    } else {
        // Show accept/decline
        addFileMessage(transferId, 'friend', fileName, fileSize, fileType, thumbnail, 'pending-accept');
    }
    startFileCacheCleanup();
    const senderName = getFriendName(peerId) || peerId.substring(0, 8) + '…';
    notifyDesktop('File received', senderName + ': ' + fileName + ' (' + formatFileSize(fileSize) + ')');
    playNotifSound('file');
    rlog.info('File offer received: ' + fileName + ' (' + formatFileSize(fileSize) + ')');
}

function handleFileAccept(peerId, msg) {
    const transfer = activeOutgoingTransfers.get(msg.transferId);
    if (!transfer || transfer.peerId !== peerId) return;
    rlog.info('File transfer accepted, starting chunk transfer');
    startChunkTransfer(msg.transferId);
}

function handleFileDecline(peerId, msg) {
    const transfer = activeOutgoingTransfers.get(msg.transferId);
    if (!transfer || transfer.peerId !== peerId) return;
    activeOutgoingTransfers.delete(msg.transferId);
    updateFileMessage(msg.transferId, 'declined');
    rlog.info('File transfer declined by peer');
}

function handleFileChunk(peerId, msg) {
    const transfer = activeIncomingTransfers.get(msg.transferId);
    if (!transfer || transfer.metadata.peerId !== peerId) return;

    // Decode base64 chunk to Uint8Array
    const binary = atob(msg.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    transfer.chunks[msg.chunkIndex] = bytes;
    transfer.receivedCount++;

    const receivedBytes = Math.min(transfer.receivedCount * CHUNK_SIZE, transfer.metadata.fileSize);
    updateFileProgress(msg.transferId, transfer.receivedCount / transfer.metadata.totalChunks, receivedBytes, transfer.metadata.fileSize);
}

async function handleFileComplete(peerId, msg) {
    const transfer = activeIncomingTransfers.get(msg.transferId);
    if (!transfer || transfer.metadata.peerId !== peerId) return;

    // Assemble blob from chunks
    const blob = new Blob(transfer.chunks, { type: transfer.metadata.fileType });

    // Verify checksum
    const checksum = await computeSHA256(blob);
    if (checksum !== msg.checksum) {
        rlog.error('File checksum mismatch! Expected: ' + msg.checksum + ', Got: ' + checksum);
        updateFileMessage(msg.transferId, 'failed');
        activeIncomingTransfers.delete(msg.transferId);
        showToast('File transfer failed — checksum mismatch', 'error');
        return;
    }

    // Store in RAM cache
    const blobUrl = isImageFile(transfer.metadata.fileType) ? URL.createObjectURL(blob) : null;
    fileCache.set(msg.transferId, {
        blob,
        blobUrl,
        fileName: transfer.metadata.fileName,
        fileType: transfer.metadata.fileType,
        fileSize: transfer.metadata.fileSize,
        timestamp: Date.now()
    });

    activeIncomingTransfers.delete(msg.transferId);
    updateFileMessage(msg.transferId, 'complete');

    // Persist file reference if recording
    if (isRecording && recordingPeerId) {
        const fileRef = JSON.stringify({
            fileName: transfer.metadata.fileName,
            fileSize: transfer.metadata.fileSize,
            fileType: transfer.metadata.fileType
        });
        await window.electronAPI.chatSaveMessage(recordingPeerId, 'friend', fileRef, 'file-ref');
    }

    rlog.info('File received and verified: ' + transfer.metadata.fileName);
}

function handleFileCancel(peerId, msg) {
    const outgoing = activeOutgoingTransfers.get(msg.transferId);
    if (outgoing && outgoing.peerId === peerId) {
        activeOutgoingTransfers.delete(msg.transferId);
        updateFileMessage(msg.transferId, 'cancelled');
    }
    const incoming = activeIncomingTransfers.get(msg.transferId);
    if (incoming && incoming.metadata.peerId === peerId) {
        activeIncomingTransfers.delete(msg.transferId);
        updateFileMessage(msg.transferId, 'cancelled');
    }
}

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || connections.size === 0) return;

    const msg = JSON.stringify({ type: 'chat', text: text });
    connections.forEach(c => {
        if (c.open) c.send(msg);
    });

    addMessage(text, 'self');
    persistMessage('self', text);
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
    updateAttachBtnState();
    expectedMeshPeers.clear();
    pendingVoiceCalls.clear();
    remoteMuteStates.clear();
    updatePeerMuteIndicator();

    // Stop audio monitoring
    stopVAD();
    stopSpeakerHighlight();
    stopHeartbeat();
    stopQualityMonitor();
    stopOnlineChecks();

    // Clear file transfer state
    activeOutgoingTransfers.clear();
    activeIncomingTransfers.clear();
    clearFileCache();
    if (fileCacheCleanupInterval) {
        clearInterval(fileCacheCleanupInterval);
        fileCacheCleanupInterval = null;
    }

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

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'peer-avatar-wrap';

        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = name[0].toUpperCase();
        avatar.title = name + ' — click to adjust volume';

        const arrow = document.createElement('span');
        arrow.className = 'avatar-dropdown-arrow';
        arrow.innerHTML = '&#9660;';
        avatarWrap.appendChild(avatar);
        avatarWrap.appendChild(arrow);

        // Click on avatar to adjust per-peer volume
        avatarWrap.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close any existing popup; if it belonged to this peer, just toggle off
            if (activePeerVolumePopup) {
                const wasSamePeer = activePeerVolumePopup.dataset.peerId === peerId;
                activePeerVolumePopup.remove(); activePeerVolumePopup = null;
                if (wasSamePeer) return;
            }

            const audio = remoteAudios.get(peerId);
            if (!audio) return; // No audio stream for this peer yet

            const popup = document.createElement('div');
            popup.className = 'peer-volume-popup';
            popup.dataset.peerId = peerId;

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
                if (!popup.contains(ev.target) && !avatarWrap.contains(ev.target)) {
                    popup.remove();
                    activePeerVolumePopup = null;
                    document.removeEventListener('click', closePopup);
                }
            };
            setTimeout(() => document.addEventListener('click', closePopup), 10);
        });

        item.appendChild(avatarWrap);

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

    // Check if recording should pause/resume due to group state change
    checkRecordingGroupState();
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
        startOnlineChecks();
    });

    peer.on('error', (err) => {
        rlog.error('PeerJS error: ' + err.type);
        if (err.type === 'peer-unavailable') {
            // Suppress errors from online status check probes
            const match = err.message && err.message.match(/Could not connect to peer (\S+)/);
            if (match && pendingStatusChecks.has(match[1])) {
                pendingStatusChecks.delete(match[1]);
                friendOnlineStatus.set(match[1], false);
                renderFriendsList();
                return;
            }
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

        // Status check probe — respond silently and close
        if (incomingConn.metadata && incomingConn.metadata.type === 'status-check') {
            incomingConn.on('open', () => { try { incomingConn.close(); } catch {} });
            return;
        }

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

            // Respond to heartbeat pings immediately (don't buffer — caller's
            // heartbeat would otherwise 3-strike us while we're still ringing)
            if (msg.type === 'ping') {
                try { if (incomingConn.open) incomingConn.send(JSON.stringify({ type: 'pong' })); } catch {}
                return;
            }
            if (msg.type === 'pong') return;

            // Caller cancelled before we accepted — stop ringing immediately
            if (msg.type === 'call-cancel') {
                if (pendingConn && pendingConn.peer === peerId) {
                    rlog.info('Caller sent call-cancel');
                    clearCallState();
                    pendingConn.close();
                    pendingConn = null;
                    // Clean up any pending voice call from this peer
                    const pendingCall = pendingVoiceCalls.get(peerId);
                    if (pendingCall) { try { pendingCall.close(); } catch { } pendingVoiceCalls.delete(peerId); }
                    hideRequestOverlay();
                    showToast('Call cancelled by caller', 'error');
                }
                return;
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

        // Already handling a call — reject with "busy"
        if (pendingConn) {
            rlog.info('Already handling a call, rejecting connection from ' + peerId);
            const sendBusy = () => {
                try { incomingConn.send(JSON.stringify({ type: 'conn-declined', reason: 'busy' })); } catch {}
                setTimeout(() => { try { incomingConn.close(); } catch {} }, 200);
            };
            if (incomingConn.open) sendBusy();
            else incomingConn.on('open', sendBusy);
            return;
        }

        // Normal incoming connection — show notification
        pendingConn = incomingConn;

        startRinging();
        ringingPeerId = peerId;

        // If the caller cancels before we accept, stop ringing immediately
        incomingConn.on('close', () => {
            if (pendingConn && pendingConn.peer === peerId) {
                rlog.info('Caller cancelled before we accepted');
                clearCallState();
                pendingConn = null;
                // Clean up any pending voice call from this peer
                const pendingCall = pendingVoiceCalls.get(peerId);
                if (pendingCall) { try { pendingCall.close(); } catch { } pendingVoiceCalls.delete(peerId); }
                hideRequestOverlay();
                showToast('Call cancelled by caller', 'error');
            }
        });

        if (isFriend(peerId)) {
            highlightFriend(peerId, true);
            updateCallUI();
        }

        // Auto-dismiss after timeout (clear any existing timeout from a previous caller)
        if (callTimeoutId) clearTimeout(callTimeoutId);
        callTimeoutId = setTimeout(() => {
            if (pendingConn && pendingConn.peer === peerId) {
                rlog.info('Incoming call timed out after ' + (CALL_TIMEOUT_MS / 1000) + 's');
                clearCallState();
                pendingConn.close();
                pendingConn = null;
                hideRequestOverlay();
                showToast('Missed call', 'error');
            }
        }, CALL_TIMEOUT_MS);

        // Show accept/decline overlay for all incoming calls
        showRequestOverlay(peerId);
        const callerName = getFriendName(peerId) || peerId.substring(0, 12) + '…';
        notifyDesktop('Incoming call', callerName + ' is calling you');
        rlog.info('Incoming connection from ' + (isFriend(peerId) ? 'friend' : 'unknown peer') + ', showing modal');
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

// Scroll-to-bottom button
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
chatMessages.addEventListener('scroll', () => {
    const distFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    scrollBottomBtn.classList.toggle('hidden', distFromBottom < 100);
});
scrollBottomBtn.addEventListener('click', () => {
    const start = chatMessages.scrollTop;
    const end = chatMessages.scrollHeight - chatMessages.clientHeight;
    const distance = end - start;
    if (distance <= 0) return;
    const duration = 1000;
    const startTime = performance.now();
    function step(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        chatMessages.scrollTop = start + distance * ease;
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
});

// Send message
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// RAM clear button
ramClearBtn.addEventListener('click', () => {
    if (!confirm('Clear all messages and files from memory?')) return;
    // Always clear file cache
    clearFileCache();
    // Clear chat messages from DOM (but keep recorded messages in DB if recording)
    if (isRecording) {
        // Only clear file blobs, keep text messages intact
        showToast('Files cleared from memory', 'success');
    } else {
        // Clear all messages from DOM
        chatMessages.innerHTML = '<div class="history-loader hidden" id="history-loader">Loading older messages...</div>';
        showToast('Messages and files cleared from memory', 'success');
    }
    updateRamDisplay();
});

// Attach file button
const attachBtn = document.getElementById('attach-btn');

function updateAttachBtnState() {
    if (connectedPeers.size > 1) {
        attachBtn.disabled = true;
        attachBtn.title = 'File sharing is only available in 1-on-1 chats';
    } else {
        attachBtn.disabled = false;
        attachBtn.title = 'Send file';
    }
}
attachBtn.addEventListener('click', async () => {
    if (connections.size === 0) {
        showToast('Not connected', 'error');
        return;
    }
    if (connectedPeers.size > 1) {
        showToast('File sharing is only available in 1-on-1 chats', 'error');
        return;
    }
    const result = await window.electronAPI.fileOpenDialog();
    if (!result) return;

    // Check size BEFORE reading into memory
    if (result.fileSize > 100 * 1024 * 1024) {
        if (!confirm(`This file is ${formatFileSize(result.fileSize)} and will be held in memory. Continue?`)) return;
    }

    // Show loading indicator while reading file
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'system-msg file-loading-msg';
    loadingMsg.textContent = `Reading ${result.fileName}…`;
    chatMessages.appendChild(loadingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const buffer = await window.electronAPI.fileRead(result.filePath);
    loadingMsg.remove();

    if (!buffer) {
        showToast('Failed to read file', 'error');
        return;
    }
    const blob = new Blob([buffer]);
    const file = new File([blob], result.fileName, { type: getMimeType(result.fileName) });
    initiateFileTransfer(file);
});

function getMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const types = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
        'webp': 'image/webp', 'svg': 'image/svg+xml', 'bmp': 'image/bmp', 'ico': 'image/x-icon',
        'pdf': 'application/pdf', 'zip': 'application/zip', 'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed', 'tar': 'application/x-tar', 'gz': 'application/gzip',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
        'txt': 'text/plain', 'html': 'text/html', 'css': 'text/css', 'js': 'text/javascript',
        'json': 'application/json', 'xml': 'application/xml', 'csv': 'text/csv',
        'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    return types[ext] || 'application/octet-stream';
}

// ── Drag & Drop file transfer ──────────────────────────────────────────────
const dropZoneOverlay = document.getElementById('drop-zone-overlay');
let dragCounter = 0; // Track nested drag enter/leave events

chatMessages.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (connections.size === 0 || connectedPeers.size > 1) return;
    dropZoneOverlay.classList.remove('hidden');
});

chatMessages.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = (connections.size === 0 || connectedPeers.size > 1) ? 'none' : 'copy';
});

chatMessages.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
        dragCounter = 0;
        dropZoneOverlay.classList.add('hidden');
    }
});

chatMessages.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropZoneOverlay.classList.add('hidden');

    if (connections.size === 0) {
        showToast('Not connected', 'error');
        return;
    }
    if (connectedPeers.size > 1) {
        showToast('File sharing is only available in 1-on-1 chats', 'error');
        return;
    }

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    // Only send the first file (consistent with file picker behavior)
    const droppedFile = droppedFiles[0];

    if (droppedFile.size > 100 * 1024 * 1024) {
        if (!confirm(`This file is ${formatFileSize(droppedFile.size)} and will be held in memory. Continue?`)) return;
    }

    const file = new File([droppedFile], droppedFile.name, { type: droppedFile.type || getMimeType(droppedFile.name) });
    initiateFileTransfer(file);
});

// ── Clipboard paste for images ─────────────────────────────────────────────
msgInput.addEventListener('paste', async (e) => {
    if (connections.size === 0 || connectedPeers.size > 1) return;

    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    let imageItem = null;
    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            imageItem = item;
            break;
        }
    }
    if (!imageItem) return; // Let normal text paste through

    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;

    // Generate a filename from timestamp
    const ext = blob.type.split('/')[1] || 'png';
    const fileName = 'clipboard-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.' + ext;

    if (blob.size > 100 * 1024 * 1024) {
        if (!confirm(`This image is ${formatFileSize(blob.size)} and will be held in memory. Continue?`)) return;
    }

    const file = new File([blob], fileName, { type: blob.type });
    initiateFileTransfer(file);
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
    // Broadcast mute state to all connected peers
    const muteMsg = JSON.stringify({ type: 'mute-state', muted: isMuted });
    connections.forEach(c => { try { if (c.open) c.send(muteMsg); } catch {} });
    rlog.info(isMuted ? 'Microphone muted' : 'Microphone unmuted');
});

// Disconnect
disconnectBtn.addEventListener('click', () => {
    rlog.info('User disconnected manually');
    cleanup();
    showLogin();
    startOnlineChecks();
    showToast('Disconnected', 'success');
});

// Cancel outgoing call
callingCancelBtn.addEventListener('click', () => {
    rlog.info('Outgoing call cancelled by user');
    // Notify the remote peer that we cancelled before closing
    connections.forEach(c => {
        try { if (c.open) c.send(JSON.stringify({ type: 'call-cancel' })); } catch { }
    });
    hideCallingScreen();
    cleanup();
    showLogin();
    showToast('Call cancelled', 'success');
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
    const isCollapsed = friendsSidebar.classList.contains('collapsed');
    if (isCollapsed) {
        friendsSidebar.classList.remove('collapsed');
        friendsData.sidebarOpen = true;
    } else {
        friendsSidebar.classList.add('collapsed');
        friendsData.sidebarOpen = false;
    }
    // Mini sidebar is always visible — no expand/burger buttons needed
    sidebarExpandBtn.classList.remove('visible');
    chatBurgerBtn.classList.add('hidden');
    saveFriendsDebounced();
    updateCallUI();
    rlog.info(isCollapsed ? 'Sidebar opened' : 'Sidebar closed');
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
    hideRequestOverlay();

    // Initialize audio stream if not already acquired
    if (!localStream) {
        const stream = await getLocalAudio();
        if (stream) applyDefaultMute();
    }

    const finalize = () => {
        wireConnection(accepted);
        handleAcceptedPeer(acceptedPeerId);
        // Notify the caller that we accepted (for calling-screen dismissal)
        const conn = connections.get(acceptedPeerId);
        if (conn && conn.open) {
            conn.send(JSON.stringify({ type: 'conn-accepted' }));
        }
    };

    if (accepted.open) {
        finalize();
    } else {
        accepted.on('open', finalize);
    }
}

requestAcceptBtn.addEventListener('click', () => {
    requestAcceptBtn.disabled = true;
    requestDeclineBtn.disabled = true;
    acceptPendingConnection();
});

requestDeclineBtn.addEventListener('click', () => {
    requestAcceptBtn.disabled = true;
    requestDeclineBtn.disabled = true;
    clearCallState();
    if (pendingConn) {
        // Notify caller that we declined before closing
        try { if (pendingConn.open) pendingConn.send(JSON.stringify({ type: 'conn-declined' })); } catch {}
        setTimeout(() => {
            if (pendingConn) { pendingConn.close(); pendingConn = null; }
        }, 200);
    }
    hideRequestOverlay();
    rlog.info('Incoming connection declined');
    showToast('Connection declined', 'success');
});

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────
function displayShortcut(s) {
    if (!s) return 'None';
    return isMac ? s.replace('Ctrl', '⌘') : s;
}

function matchesShortcut(e, shortcutStr) {
    if (!shortcutStr) return false;
    const parts = shortcutStr.toUpperCase().split('+');
    const key = parts[parts.length - 1];
    const needsCtrl = parts.includes('CTRL');
    const needsShift = parts.includes('SHIFT');
    const needsAlt = parts.includes('ALT');
    const hasCtrl = isMac ? e.metaKey : e.ctrlKey;
    if (needsCtrl !== hasCtrl) return false;
    if (needsShift !== e.shiftKey) return false;
    if (needsAlt !== e.altKey) return false;
    return e.key.toUpperCase() === key;
}

function formatShortcutFromEvent(e) {
    const parts = [];
    if (isMac ? e.metaKey : e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    const key = e.key.toUpperCase();
    if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return null;
    if (parts.length === 0) return null; // require at least one modifier
    parts.push(key);
    return parts.join('+');
}

function updateShortcutDisplays() {
    for (const [action, combo] of Object.entries(appSettings.shortcuts)) {
        const btn = document.getElementById('shortcut-' + action);
        if (btn) btn.textContent = displayShortcut(combo);
    }
}

function startShortcutRecording(action) {
    cancelShortcutRecording();
    recordingShortcutAction = action;
    const btn = document.getElementById('shortcut-' + action);
    if (btn) {
        btn.textContent = 'Press keys…';
        btn.classList.add('recording');
    }
}

function cancelShortcutRecording() {
    if (!recordingShortcutAction) return;
    const btn = document.getElementById('shortcut-' + recordingShortcutAction);
    if (btn) {
        btn.classList.remove('recording');
        btn.textContent = displayShortcut(appSettings.shortcuts[recordingShortcutAction]);
    }
    recordingShortcutAction = null;
}

// ── Global keyboard handler (Escape + Shortcuts) ────────────────────────────
document.addEventListener('keydown', (e) => {
    // Shortcut recording mode
    if (recordingShortcutAction) {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelShortcutRecording();
            return;
        }
        const combo = formatShortcutFromEvent(e);
        if (combo) {
            e.preventDefault();
            // Check for conflicts
            for (const [otherAction, otherCombo] of Object.entries(appSettings.shortcuts)) {
                if (otherAction !== recordingShortcutAction && otherCombo === combo) {
                    showToast(`"${displayShortcut(combo)}" is already used for ${SHORTCUT_LABELS[otherAction] || otherAction}`, 'warning');
                    cancelShortcutRecording();
                    return;
                }
            }
            appSettings.shortcuts[recordingShortcutAction] = combo;
            window.electronAPI.saveSettings({ shortcuts: appSettings.shortcuts });
            const btn = document.getElementById('shortcut-' + recordingShortcutAction);
            if (btn) {
                btn.classList.remove('recording');
                btn.textContent = displayShortcut(combo);
            }
            recordingShortcutAction = null;
        }
        return;
    }

    // Ctrl+F — open chat search (only in session with recording)
    if (e.key === 'f' && (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (inSession && isRecording) {
            e.preventDefault();
            if (chatSearchBar.classList.contains('hidden')) {
                openSearch();
            } else {
                chatSearchInput.focus();
                chatSearchInput.select();
            }
            return;
        }
    }

    // Escape key — close modals in priority order
    if (e.key === 'Escape') {
        // Search bar takes priority if focused
        if (!chatSearchBar.classList.contains('hidden')) {
            closeSearch();
        } else if (deathOverlay.style.display === 'flex') {
            deathCancelBtn.click();
        } else if (recordingOverlay.style.display === 'flex') {
            recordingDeclineBtn.click();
        } else if (requestOverlay.style.display === 'flex') {
            requestDeclineBtn.click();
        } else if (callingOverlay.style.display === 'flex') {
            callingCancelBtn.click();
        } else if (friendOverlay.style.display === 'flex') {
            friendCancelBtn.click();
        } else if (!inviteOverlay.classList.contains('hidden')) {
            inviteCloseBtn.click();
        } else if (settingsOverlay.style.display === 'flex') {
            stopMicTest();
            cancelShortcutRecording();
            settingsOverlay.style.display = 'none';
        } else if (versionOverlay.style.display === 'flex') {
            versionOverlay.style.display = 'none';
        } else if (helpOverlay.style.display === 'flex') {
            helpOverlay.style.display = 'none';
        } else if (welcomeOverlay.style.display === 'flex') {
            welcomeCloseBtn.click();
        }
        return;
    }

    // Keyboard shortcuts (only in chat session)
    if (inSession && appSettings.shortcuts) {
        if (matchesShortcut(e, appSettings.shortcuts.mute)) {
            e.preventDefault();
            muteBtn.click();
        } else if (matchesShortcut(e, appSettings.shortcuts.disconnect)) {
            e.preventDefault();
            disconnectBtn.click();
        }
    }
});

// ── Graceful cleanup when window is closed (X button) ───────────────────────
window.addEventListener('beforeunload', () => {
    // Send mesh-leave to all peers so they detect disconnect immediately
    const leaveMsg = JSON.stringify({ type: 'mesh-leave' });
    connections.forEach(c => {
        try { if (c.open) c.send(leaveMsg); } catch { }
    });
    if (peer && !peer.destroyed) {
        try { peer.destroy(); } catch { }
    }
});

// ── Heartbeat: 3-strike system for peer timeout detection ────────────────────
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 15000; // per-check timeout (3 checks = ~45s total)
const HEARTBEAT_MAX_STRIKES = 3;
const lastHeartbeat = new Map();    // Map<PeerId, timestamp>
const heartbeatStrikes = new Map(); // Map<PeerId, number>
let heartbeatIntervalId = null;

function startHeartbeat() {
    if (heartbeatIntervalId) return;
    heartbeatIntervalId = setInterval(() => {
        const now = Date.now();
        const pingMsg = JSON.stringify({ type: 'ping' });

        connections.forEach((conn, peerId) => {
            // Send ping
            try { if (conn.open) conn.send(pingMsg); } catch { }

            // Check if peer responded recently
            const last = lastHeartbeat.get(peerId);
            if (last && now - last > HEARTBEAT_TIMEOUT_MS) {
                const strikes = (heartbeatStrikes.get(peerId) || 0) + 1;
                heartbeatStrikes.set(peerId, strikes);

                if (strikes === 1) {
                    const name = getFriendName(peerId) || peerId.substring(0, 8) + '…';
                    addSystemMessage(`Connection to ${name} unstable...`, 'warning');
                    rlog.warn('Heartbeat strike 1 for peer');
                }

                if (strikes >= HEARTBEAT_MAX_STRIKES) {
                    rlog.warn('Heartbeat 3 strikes for peer, removing');
                    removePeer(peerId, 'disconnected (timed out)');
                }
            } else {
                // Peer responded — reset strikes
                if (heartbeatStrikes.has(peerId)) heartbeatStrikes.delete(peerId);
            }
        });
    }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
    }
    lastHeartbeat.clear();
    heartbeatStrikes.clear();
}

// ── Connection quality monitoring (WebRTC stats) ─────────────────────────────
const QUALITY_POLL_MS = 5000;
let qualityIntervalId = null;
let lastBytesSent = new Map();     // Map<PeerId, number>
let lastBytesReceived = new Map(); // Map<PeerId, number>

function startQualityMonitor() {
    if (qualityIntervalId) return;
    // Show bars immediately in neutral state while waiting for first stats
    if (connQualityBars) {
        connQualityBars.classList.remove('hidden', 'quality-good', 'quality-fair', 'quality-poor');
        connQualityBars.title = 'Connection quality: measuring...';
    }
    // First poll after 1.5s (WebRTC needs time to establish), then every 5s
    setTimeout(pollConnectionQuality, 1500);
    qualityIntervalId = setInterval(pollConnectionQuality, QUALITY_POLL_MS);
}

function stopQualityMonitor() {
    if (qualityIntervalId) {
        clearInterval(qualityIntervalId);
        qualityIntervalId = null;
    }
    lastBytesSent.clear();
    lastBytesReceived.clear();
    if (connQualityBars) {
        connQualityBars.classList.add('hidden');
        connQualityBars.className = 'conn-quality-bars hidden';
    }
}

async function pollConnectionQuality() {
    if (connectedPeers.size === 0) return;

    let totalRtt = 0;
    let totalPacketLoss = 0;
    let peerCount = 0;

    for (const peerId of connectedPeers) {
        const call = activeCalls.get(peerId);
        const pc = call?.peerConnection;
        if (!pc) continue;

        try {
            const stats = await pc.getStats();
            let rtt = null;
            let packetsLost = 0;
            let packetsReceived = 0;

            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime != null) {
                        rtt = report.currentRoundTripTime * 1000; // seconds → ms
                    }
                }
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    packetsLost = report.packetsLost || 0;
                    packetsReceived = report.packetsReceived || 0;
                }
            });

            if (rtt !== null) {
                totalRtt += rtt;
                const totalPackets = packetsReceived + packetsLost;
                const lossPercent = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;
                totalPacketLoss += lossPercent;
                peerCount++;
            }
        } catch { }
    }

    if (peerCount === 0) {
        // No voice calls active — hide quality dot
        if (connQualityBars) connQualityBars.classList.add('hidden');
        return;
    }

    const avgRtt = totalRtt / peerCount;
    const avgLoss = totalPacketLoss / peerCount;

    // Determine quality level
    let quality, label;
    if (avgRtt < 150 && avgLoss < 2) {
        quality = 'good';
        label = 'Good';
    } else if (avgRtt < 400 && avgLoss < 10) {
        quality = 'fair';
        label = 'Fair';
    } else {
        quality = 'poor';
        label = 'Poor';
    }

    if (connQualityBars) {
        connQualityBars.classList.remove('hidden', 'quality-good', 'quality-fair', 'quality-poor');
        connQualityBars.classList.add('quality-' + quality);
        connQualityBars.title = `Connection: ${label} | RTT: ${Math.round(avgRtt)}ms | Loss: ${avgLoss.toFixed(1)}%`;
    }
}

// ── Start ───────────────────────────────────────────────────────────────────────
init();
loadFriends();

// ── Update notification ─────────────────────────────────────────────────────────
const updateBanner = document.getElementById('update-banner');
const updateBannerFill = document.getElementById('update-banner-fill');
const updateBannerText = document.getElementById('update-banner-text');
const updateHint = document.getElementById('update-hint');
const revokeBanner = document.getElementById('revoke-banner');
const revokeBannerText = document.getElementById('revoke-banner-text');

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

// Help elements
const helpBtn = document.getElementById('help-btn');
const helpOverlay = document.getElementById('help-overlay');
const helpCloseBtn = document.getElementById('help-close-btn');
const helpSectionsEl = document.getElementById('help-sections');

let updateState = 'idle'; // idle | available | downloading | ready | error
let cachedReleases = null;
let cachedCurrentVersion = '';
let appSettings = {
    autoUpdate: true, micDeviceId: '', speakerDeviceId: '',
    micGain: 1.0, noiseSuppression: true, vadEnabled: true,
    vadThreshold: 0.025, ringtoneVolume: 0.25, showWelcome: true,
    reduceMotion: false,
    notificationsEnabled: true,
    notificationSounds: true,
    shortcuts: { mute: 'Ctrl+M', disconnect: 'Ctrl+D' },
    minimizeToTray: false
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
        if (vadIndicator) vadIndicator.style.left = (Math.round(appSettings.vadThreshold * 1000) / 50 * 100) + '%';
        // Show welcome popup if enabled (before device enumeration which can be slow)
        if (appSettings.showWelcome !== false) {
            welcomeOverlay.style.display = 'flex';
            // Position arrow dynamically to point at the help button
            // Arrow position is handled by CSS (fixed top-right, aligned with help button)
        }
        // Apply welcome setting toggle
        const welcomeToggle = document.getElementById('setting-show-welcome');
        if (welcomeToggle) welcomeToggle.checked = appSettings.showWelcome !== false;
        // Apply reduce-motion setting
        const reduceMotionToggle = document.getElementById('setting-reduce-motion');
        if (reduceMotionToggle) reduceMotionToggle.checked = !!appSettings.reduceMotion;
        document.body.classList.toggle('reduce-motion', !!appSettings.reduceMotion);
        // Apply notification settings
        const notifToggle = document.getElementById('setting-notifications');
        if (notifToggle) notifToggle.checked = appSettings.notificationsEnabled !== false;
        const notifSoundsToggle = document.getElementById('setting-notif-sounds');
        if (notifSoundsToggle) notifSoundsToggle.checked = appSettings.notificationSounds !== false;
        // Apply minimize-to-tray setting
        const trayToggle = document.getElementById('setting-minimize-to-tray');
        if (trayToggle) trayToggle.checked = !!appSettings.minimizeToTray;
        if (appSettings.minimizeToTray) window.electronAPI.trayToggle(true);
        // Apply keyboard shortcuts (deep merge with defaults)
        appSettings.shortcuts = { ...DEFAULT_SHORTCUTS, ...(appSettings.shortcuts || {}) };
        updateShortcutDisplays();
        // Enumerate audio devices last (getUserMedia can take seconds on Windows)
        populateDeviceSelectors();
    } catch (_) { }
})();

// ── Welcome Popup ──────────────────────────────────────────────────────────────
welcomeGithubLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://github.com/xDerApfelx/NullChat/issues');
});

welcomeCloseBtn.addEventListener('click', async () => {
    if (welcomeDontShow.checked) {
        appSettings.showWelcome = false;
        await window.electronAPI.saveSettings({ showWelcome: false });
        const welcomeToggle = document.getElementById('setting-show-welcome');
        if (welcomeToggle) welcomeToggle.checked = false;
    }
    welcomeOverlay.style.display = 'none';
});

welcomeOverlay.addEventListener('click', (e) => {
    if (e.target === welcomeOverlay) {
        welcomeCloseBtn.click();
    }
});

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

// ── Chat Persistence Event Listeners ─────────────────────────────────────────

// Record button: toggle dropdown menu
recordBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!recordDropdown.classList.contains('hidden')) {
        recordDropdown.classList.add('hidden');
        return;
    }
    // Show/hide items based on state
    recordStartBtn.classList.toggle('hidden', isRecording || recordingRequestPending);
    const peerId = currentPeerId || Array.from(connectedPeers)[0];
    const hasHistory = peerId ? await window.electronAPI.chatExists(peerId) : false;
    recordDeleteBtn.classList.toggle('hidden', !hasHistory);
    recordDropdown.classList.remove('hidden');
});

// Prevent dropdown item clicks from bubbling to the record button
recordDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Close dropdown when clicking elsewhere
document.addEventListener('click', () => {
    if (recordDropdown && !recordDropdown.classList.contains('hidden')) {
        recordDropdown.classList.add('hidden');
    }
});

// Dropdown: Start Recording
recordStartBtn.addEventListener('click', () => {
    recordDropdown.classList.add('hidden');
    if (isRecording || recordingRequestPending) return;
    if (connectedPeers.size !== 1) {
        showToast('Recording only works in 1-on-1 chats', '');
        return;
    }
    const peerId = Array.from(connectedPeers)[0];
    const conn = connections.get(peerId);
    if (conn && conn.open) {
        recordingRequestPending = true;
        conn.send(JSON.stringify({ type: 'recording-request' }));
        showToast('Recording request sent...', '');
        rlog.info('Recording consent request sent');
        setTimeout(() => { recordingRequestPending = false; }, 30000);
    }
});

// Dropdown: Delete Chat History
recordDeleteBtn.addEventListener('click', () => {
    recordDropdown.classList.add('hidden');
    deathOverlay.style.display = 'flex';
});

// Recording consent: Accept
recordingAcceptBtn.addEventListener('click', () => {
    recordingAcceptBtn.disabled = true;
    recordingDeclineBtn.disabled = true;
    const requestFrom = recordingOverlay.dataset.requestFrom;
    recordingOverlay.style.display = 'none';
    recordingAcceptBtn.disabled = false;
    recordingDeclineBtn.disabled = false;
    if (requestFrom) {
        const conn = connections.get(requestFrom);
        if (conn && conn.open) {
            conn.send(JSON.stringify({ type: 'recording-response', accepted: true }));
        }
        startRecording(requestFrom);
        showToast('Recording started', 'success');
    }
});

// Recording consent: Decline
recordingDeclineBtn.addEventListener('click', () => {
    recordingAcceptBtn.disabled = true;
    recordingDeclineBtn.disabled = true;
    const requestFrom = recordingOverlay.dataset.requestFrom;
    recordingOverlay.style.display = 'none';
    recordingAcceptBtn.disabled = false;
    recordingDeclineBtn.disabled = false;
    if (requestFrom) {
        const conn = connections.get(requestFrom);
        if (conn && conn.open) {
            conn.send(JSON.stringify({ type: 'recording-response', accepted: false }));
        }
        rlog.info('Recording request declined');
    }
});

// Death confirm: delete everything
deathConfirmBtn.addEventListener('click', async () => {
    deathOverlay.style.display = 'none';
    // Works whether recording is active or just history exists
    const peerId = recordingPeerId || currentPeerId;
    if (!peerId) return;

    const conn = connections.get(peerId);
    if (conn && conn.open) {
        conn.send(JSON.stringify({ type: 'death-button' }));
    }
    await stopRecording(true);
    await window.electronAPI.chatDelete(peerId);
    addSystemMessage('Chat history has been deleted.', 'warning');
    showToast('Chat history deleted', '');
    rlog.info('Chat deleted via death button');
});

// Death cancel
deathCancelBtn.addEventListener('click', () => {
    deathOverlay.style.display = 'none';
});

// Set up lazy loading scroll listener
setupHistoryScrollListener();

// Run auto-cleanup check on startup (after a short delay)
setTimeout(checkChatCleanup, 3000);

// ── Settings Modal ──────────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
    settingsOverlay.style.display = 'flex';
    populateDeviceSelectors(); // Run in background, don't block modal opening
});

settingsCloseBtn.addEventListener('click', () => {
    stopMicTest();
    cancelShortcutRecording();
    settingsOverlay.style.display = 'none';
});

settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) { stopMicTest(); cancelShortcutRecording(); settingsOverlay.style.display = 'none'; }
});

settingAutoUpdate.addEventListener('change', async () => {
    appSettings.autoUpdate = settingAutoUpdate.checked;
    await window.electronAPI.saveSettings({ autoUpdate: appSettings.autoUpdate });
    rlog.info(`Auto-update set to: ${appSettings.autoUpdate}`);
});

document.getElementById('setting-show-welcome').addEventListener('change', async () => {
    const checked = document.getElementById('setting-show-welcome').checked;
    appSettings.showWelcome = checked;
    await window.electronAPI.saveSettings({ showWelcome: checked });
    rlog.info(`Show welcome screen set to: ${checked}`);
});

document.getElementById('setting-reduce-motion').addEventListener('change', async () => {
    const checked = document.getElementById('setting-reduce-motion').checked;
    appSettings.reduceMotion = checked;
    document.body.classList.toggle('reduce-motion', checked);
    await window.electronAPI.saveSettings({ reduceMotion: checked });
});

document.getElementById('setting-notifications').addEventListener('change', async () => {
    const checked = document.getElementById('setting-notifications').checked;
    appSettings.notificationsEnabled = checked;
    await window.electronAPI.saveSettings({ notificationsEnabled: checked });
});

document.getElementById('setting-notif-sounds').addEventListener('change', async () => {
    const checked = document.getElementById('setting-notif-sounds').checked;
    appSettings.notificationSounds = checked;
    await window.electronAPI.saveSettings({ notificationSounds: checked });
});

document.getElementById('setting-minimize-to-tray').addEventListener('change', async () => {
    const checked = document.getElementById('setting-minimize-to-tray').checked;
    appSettings.minimizeToTray = checked;
    await window.electronAPI.saveSettings({ minimizeToTray: checked });
    window.electronAPI.trayToggle(checked);
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
    if (vadIndicator) vadIndicator.style.left = (parseInt(settingVadThreshold.value) / 50 * 100) + '%';
    await window.electronAPI.saveSettings({ vadThreshold: appSettings.vadThreshold });
});

settingRingtoneVolume.addEventListener('input', async () => {
    const val = parseInt(settingRingtoneVolume.value);
    ringtoneVolumeValue.textContent = val + '%';
    appSettings.ringtoneVolume = val / 100;
    ringtone.volume = appSettings.ringtoneVolume;
    await window.electronAPI.saveSettings({ ringtoneVolume: appSettings.ringtoneVolume });
});

// Ringtone test/preview button
const ringtoneTestBtn = document.getElementById('ringtone-test-btn');
ringtoneTestBtn.addEventListener('click', () => {
    if (ringtoneTestActive) {
        stopRinging();
        resetRingtoneTestBtn();
        return;
    }
    ringtone.volume = appSettings.ringtoneVolume;
    ringtoneTestActive = true;
    ringtoneTestBtn.textContent = '⏹ Stop';
    ringtoneTestBtn.classList.add('playing');
    startRinging();
});

// ── Keyboard Shortcut Recording ─────────────────────────────────────────────
document.getElementById('shortcut-mute').addEventListener('click', () => startShortcutRecording('mute'));
document.getElementById('shortcut-disconnect').addEventListener('click', () => startShortcutRecording('disconnect'));

// Cancel shortcut recording when clicking outside the active button
document.addEventListener('click', (e) => {
    if (!recordingShortcutAction) return;
    const btn = document.getElementById('shortcut-' + recordingShortcutAction);
    if (btn && !btn.contains(e.target)) cancelShortcutRecording();
});

// ── Reset to Defaults ───────────────────────────────────────────────────────
document.getElementById('settings-reset-btn').addEventListener('click', async () => {
    if (!confirm('Reset all settings to their default values?')) return;
    appSettings = {
        autoUpdate: true, micDeviceId: '', speakerDeviceId: '',
        micGain: 1.0, noiseSuppression: true, vadEnabled: true,
        vadThreshold: 0.025, ringtoneVolume: 0.25, showWelcome: true,
        reduceMotion: false,
        notificationsEnabled: true,
        notificationSounds: true,
        shortcuts: { ...DEFAULT_SHORTCUTS },
        minimizeToTray: false
    };
    await window.electronAPI.saveSettings(appSettings);
    window.electronAPI.trayToggle(false);
    // Update all UI toggles
    settingAutoUpdate.checked = true;
    document.getElementById('setting-show-welcome').checked = true;
    document.getElementById('setting-reduce-motion').checked = false;
    document.body.classList.remove('reduce-motion');
    document.getElementById('setting-notifications').checked = true;
    document.getElementById('setting-notif-sounds').checked = true;
    document.getElementById('setting-minimize-to-tray').checked = false;
    settingNoiseSuppression.checked = true;
    settingVad.checked = true;
    settingVadThreshold.value = 15;
    vadThresholdValue.textContent = '25';
    vadSensitivityRow.style.display = '';
    settingMicGain.value = 100;
    micGainValue.textContent = '100%';
    settingRingtoneVolume.value = 25;
    ringtoneVolumeValue.textContent = '25%';
    ringtone.volume = 0.25;
    if (micGainNode) micGainNode.gain.value = 1.0;
    if (micTestGainNode) micTestGainNode.gain.value = 1.0;
    const vadIndicator = document.getElementById('vad-indicator');
    if (vadIndicator) vadIndicator.style.left = (25 / 50 * 100) + '%';
    if (settingMicDevice.options.length > 0) settingMicDevice.selectedIndex = 0;
    if (settingSpeakerDevice.options.length > 0) settingSpeakerDevice.selectedIndex = 0;
    updateShortcutDisplays();
    showToast('Settings reset to defaults', 'success');
});

// ── Chat Search Event Handlers ──────────────────────────────────────────────
searchToggleBtn.addEventListener('click', () => openSearch());
chatSearchClose.addEventListener('click', () => closeSearch());
chatSearchPrev.addEventListener('click', () => searchPrev());
chatSearchNext.addEventListener('click', () => searchNext());

chatSearchInput.addEventListener('input', () => {
    if (searchDebounceId) clearTimeout(searchDebounceId);
    searchDebounceId = setTimeout(() => {
        performSearch(chatSearchInput.value);
    }, 300);
});

chatSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            searchPrev();
        } else {
            searchNext();
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
    }
});

// ── 1-on-1 Peer Volume (chat header avatar) ─────────────────────────────────
const peerAvatarWrap = peerAvatar.closest('.peer-avatar-wrap') || peerAvatar;
peerAvatarWrap.style.cursor = 'pointer';
peerAvatar.title = 'Click to adjust volume';
peerAvatarWrap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activePeerVolumePopup) { activePeerVolumePopup.remove(); activePeerVolumePopup = null; return; }

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

    const avatarWrap = peerAvatar.closest('.peer-avatar-wrap') || peerAvatar;
    const closePopup = (ev) => {
        if (!popup.contains(ev.target) && !avatarWrap.contains(ev.target)) {
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

// ── Help Modal ──────────────────────────────────────────────────────────────────
const helpTopics = [
    {
        icon: '\u{1F680}',
        title: 'Getting Started',
        body: '<p>NullChat is <strong>not like Discord or WhatsApp</strong>. There are no accounts, no servers storing your data, and no message history by default. Everything happens directly between you and the person you\'re talking to.</p>' +
            '<p><strong>How to connect:</strong></p>' +
            '<ol><li>When you open the app, you get a <strong>Peer ID</strong> — this is your address for this session.</li>' +
            '<li>Send your Peer ID to a friend (via any other app).</li>' +
            '<li>They paste it into their NullChat and click <strong>Connect</strong> — or you paste theirs.</li>' +
            '<li>Once connected, voice and text chat start immediately.</li></ol>' +
            '<p><strong>Important:</strong> Both people need to have NullChat open at the same time. There is no way to send messages to someone who is offline.</p>'
    },
    {
        icon: '\u{1F465}',
        title: 'Friends & Contacts',
        body: '<p>You don\'t want to share Peer IDs every time? Save someone as a friend:</p>' +
            '<ol><li>Connect to someone first.</li>' +
            '<li>Click the <strong>+ button</strong> in the chat header.</li>' +
            '<li>Give them a nickname — their Peer ID is saved automatically.</li></ol>' +
            '<p>Your friends appear in the <strong>sidebar on the left</strong>. Click a name to connect instantly.</p>' +
            '<p><strong>Online status:</strong> A green dot means the friend is currently online. A gray dot means they\'re offline or unreachable. The status updates automatically every 60 seconds.</p>' +
            '<p><strong>Tip:</strong> You can collapse the sidebar by clicking the arrow at the top to get more chat space.</p>'
    },
    {
        icon: '\u{1F4AC}',
        title: 'Text & Voice Chat',
        body: '<p>Voice and text work <strong>at the same time</strong>. As soon as you connect, your microphone is live and you can type messages below.</p>' +
            '<p><strong>Controls:</strong></p>' +
            '<ul><li><strong>Mute button</strong> (or <strong>Ctrl+M</strong>) — Turns your microphone on/off. The other person can see when you\'re muted.</li>' +
            '<li><strong>Disconnect button</strong> (or <strong>Ctrl+D</strong>) — Ends the call.</li>' +
            '<li><strong>Volume sliders</strong> — During a call, you can adjust each person\'s volume individually.</li></ul>' +
            '<p><strong>Connection quality:</strong> A colored dot in the chat header shows your connection quality — green is good, yellow means some lag, red means the connection is unstable.</p>' +
            '<p><strong>Good to know:</strong> Messages you type are only visible while the app is open. Once you close NullChat, the chat is gone — unless you use <strong>Chat Recording</strong> (see below).</p>'
    },
    {
        icon: '\u{1F4DE}',
        title: 'Group Calls',
        body: '<p>You can add more people to a call:</p>' +
            '<ol><li>Click <strong>Invite</strong> in the chat header.</li>' +
            '<li>Share the invite link or group ID with others.</li>' +
            '<li>They join by pasting the group ID and connecting.</li></ol>' +
            '<p><strong>How it works:</strong> Everyone connects directly to everyone else (full mesh). This keeps things private but works best with <strong>small groups</strong> (2-5 people). With more people, voice quality may drop depending on your internet.</p>' +
            '<p><strong>Limitations in groups:</strong></p>' +
            '<ul><li>File sharing is <strong>not available</strong> in group calls — only in 1-on-1 chats.</li>' +
            '<li>Chat recording is <strong>not available</strong> in group calls.</li>' +
            '<li>If recording was active in a 1-on-1 chat and a third person joins, recording is <strong>automatically paused</strong>.</li></ul>'
    },
    {
        icon: '\u270E',
        title: 'Chat Recording & Search',
        body: '<p>By default, NullChat saves nothing. But if you want to keep a conversation, you can enable <strong>Chat Recording</strong>:</p>' +
            '<ol><li>In a 1-on-1 chat, click the <strong>pencil icon</strong> in the header.</li>' +
            '<li>Select <strong>Start Recording</strong> — this sends a request to the other person.</li>' +
            '<li><strong>Both sides must agree</strong> before recording starts.</li></ol>' +
            '<p>While recording is active, a small indicator with the storage size appears above the text input.</p>' +
            '<p><strong>Where are messages stored?</strong> Locally on your device, encrypted with AES-256. Nobody else can read them — not even if they copy the file.</p>' +
            '<p><strong>Search:</strong> When recording is active, a search icon appears in the chat header. Use it (or press <strong>Ctrl+F</strong>) to search through your saved messages.</p>' +
            '<p><strong>Delete history:</strong> Click the pencil icon and select <strong>Delete Chat History</strong> to permanently erase the recorded chat from <strong>both devices</strong>. This cannot be undone.</p>' +
            '<p>Chats that haven\'t been accessed for 12 months are automatically deleted.</p>'
    },
    {
        icon: '\u{1F4CE}',
        title: 'File Sharing',
        body: '<p>You can send files directly to the other person — no cloud, no upload limit worries. There are <strong>three ways</strong> to send a file:</p>' +
            '<ul><li><strong>Paperclip button</strong> — Click it next to the text input to pick a file.</li>' +
            '<li><strong>Drag & Drop</strong> — Drag a file from your desktop into the chat window.</li>' +
            '<li><strong>Paste from clipboard</strong> — Copy a screenshot or image and press <strong>Ctrl+V</strong> in the chat. A preview dialog lets you confirm before sending.</li></ul>' +
            '<p><strong>How transfers work:</strong></p>' +
            '<ul><li>Files under <strong>10 MB</strong> are accepted automatically. Larger files need to be accepted by the receiver.</li>' +
            '<li>You can see the <strong>transfer progress in percent</strong> and file size during transfer.</li>' +
            '<li>Received files are held <strong>in memory only</strong> — they\'re not saved to your disk automatically. Click <strong>Save</strong> on a received file to choose where to save it.</li>' +
            '<li>Files expire after <strong>60 minutes</strong> and are freed from memory. A RAM indicator above the input shows total memory used.</li>' +
            '<li>Images show a <strong>thumbnail preview</strong> in the chat.</li>' +
            '<li>If a transfer fails, a <strong>Retry</strong> button appears.</li></ul>' +
            '<p>File sharing only works in <strong>1-on-1 chats</strong>, not in groups.</p>'
    },
    {
        icon: '\u{1F3A4}',
        title: 'Audio & Settings',
        body: '<p>Click the <strong>gear icon</strong> to open Settings. Here you can configure:</p>' +
            '<ul><li><strong>Microphone & Speaker</strong> — Pick which audio devices to use.</li>' +
            '<li><strong>Mic Test</strong> — A live level meter shows if your mic is working.</li>' +
            '<li><strong>Noise Suppression</strong> — Filters out background noise (keyboard, fan, etc.).</li>' +
            '<li><strong>Voice Activity Detection (VAD)</strong> — Only transmits audio when you\'re actually speaking. Adjust the sensitivity slider — left is more sensitive, right is less sensitive.</li>' +
            '<li><strong>Keyboard Shortcuts</strong> — Customize shortcuts for Mute and Disconnect.</li>' +
            '<li><strong>Minimize to Tray</strong> — When enabled, closing the window keeps NullChat running in the system tray instead of quitting.</li>' +
            '<li><strong>Reduce Motion</strong> — Disables animations if you prefer a calmer interface.</li></ul>' +
            '<p><strong>Tip:</strong> There\'s a <strong>Reset to Defaults</strong> button at the bottom of Settings if you want to undo all changes.</p>'
    },
    {
        icon: '\u{1F514}',
        title: 'Notifications & Calls',
        body: '<p><strong>Incoming calls:</strong> When someone connects to you, NullChat plays a ringtone and shows a popup. If the caller is a saved friend, you see their nickname. Unknown callers trigger a full request screen where you can accept or decline.</p>' +
            '<p><strong>Desktop notifications:</strong> If NullChat is in the background, you\'ll get a system notification for incoming calls and messages so you don\'t miss anything.</p>' +
            '<p><strong>Call timeout:</strong> If nobody answers, the call automatically ends after 30 seconds (or 90 seconds for friends). A countdown timer is shown while waiting.</p>' +
            '<p><strong>Updates:</strong> NullChat checks for updates automatically. When a new version is available, a banner appears at the top. You can also click the <strong>clipboard icon</strong> to see the full version history with changelogs.</p>'
    },
    {
        icon: '\u{1F6E1}',
        title: 'Security & Privacy',
        body: '<p>NullChat is built around one principle: <strong>your data belongs to you</strong>.</p>' +
            '<ul><li><strong>End-to-End Encrypted</strong> — Voice and data are encrypted via WebRTC (DTLS/SRTP). Recorded chats are encrypted with AES-256-GCM.</li>' +
            '<li><strong>No Servers</strong> — Messages and voice travel directly between peers. Nothing passes through a middleman.</li>' +
            '<li><strong>No Accounts</strong> — No registration, no email, no phone number.</li>' +
            '<li><strong>No Cloud Storage</strong> — Nothing is stored on any server, ever.</li>' +
            '<li><strong>Sandboxed</strong> — The chat interface runs in a sandboxed environment with no direct access to your file system.</li>' +
            '<li><strong>Open Source</strong> — The entire source code is public and can be audited by anyone.</li></ul>'
    },
    {
        icon: '\u2753',
        title: 'FAQ: Is it really serverless?',
        body: '<p>Almost. NullChat uses a public <strong>signaling server</strong> (PeerJS Cloud) for one thing only: to help two peers find each other — like a phone book that connects the call but doesn\'t listen in.</p>' +
            '<p>Once connected, <strong>all communication is direct</strong>. The signaling server never sees your messages, voice, files, or any content.</p>' +
            '<p><strong>Can people see my IP?</strong> The person you\'re connected to <em>can</em> technically see your IP address — this is how all peer-to-peer technology works (torrents, online gaming, etc.). If that concerns you, use a <strong>VPN</strong>.</p>'
    },
    {
        icon: '\u{1F4A1}',
        title: 'Tips & Troubleshooting',
        body: '<p><strong>Can\'t connect?</strong></p>' +
            '<ul><li>Make sure both people have NullChat open and are online.</li>' +
            '<li>Check that the Peer ID is copied correctly — no extra spaces.</li>' +
            '<li>Some strict firewalls or corporate networks may block P2P connections.</li>' +
            '<li>If connection keeps dropping, check the connection quality dot in the header. A yellow or red dot means your network is unstable.</li></ul>' +
            '<p><strong>No audio?</strong></p>' +
            '<ul><li>Go to Settings and check that the correct microphone and speaker are selected.</li>' +
            '<li>Use the <strong>Mic Test</strong> to verify your microphone works.</li>' +
            '<li>Make sure you haven\'t muted yourself (check the mute button).</li>' +
            '<li>Your browser/OS may need to grant microphone permission to NullChat.</li></ul>' +
            '<p><strong>Useful shortcuts:</strong></p>' +
            '<ul><li><strong>Ctrl+M</strong> — Toggle mute</li>' +
            '<li><strong>Ctrl+D</strong> — Disconnect</li>' +
            '<li><strong>Ctrl+F</strong> — Search messages (when recording is active)</li>' +
            '<li><strong>Escape</strong> — Close any open popup</li></ul>'
    }
];

helpBtn.addEventListener('click', () => {
    renderHelp();
    helpOverlay.style.display = 'flex';
});

helpCloseBtn.addEventListener('click', () => {
    helpOverlay.style.display = 'none';
});

helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) helpOverlay.style.display = 'none';
});

function renderHelp() {
    helpSectionsEl.innerHTML = '';
    helpTopics.forEach(topic => {
        const item = document.createElement('div');
        item.className = 'help-item';

        const header = document.createElement('div');
        header.className = 'help-item-header';

        const icon = document.createElement('span');
        icon.className = 'help-item-icon';
        icon.textContent = topic.icon;

        const title = document.createElement('span');
        title.className = 'help-item-title';
        title.textContent = topic.title;

        const expand = document.createElement('span');
        expand.className = 'help-expand-icon';
        expand.innerHTML = '\u25BC';

        header.appendChild(icon);
        header.appendChild(title);
        header.appendChild(expand);

        const body = document.createElement('div');
        body.className = 'help-item-body';
        body.innerHTML = topic.body;

        header.addEventListener('click', () => {
            item.classList.toggle('expanded');
        });

        item.appendChild(header);
        item.appendChild(body);
        helpSectionsEl.appendChild(item);
    });
}

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
        // Show the release title, strip leading "NullChat " if present
        const displayName = (r.name || r.version).replace(/^nullchat\s*/i, '').trim();
        versionSpan.textContent = displayName || r.version;

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

        if (r.revoked) {
            const badge = document.createElement('span');
            badge.className = 'version-release-badge badge-revoked';
            badge.textContent = 'REVOKED';
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
        updateHint.style.display = 'none';
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

    // Show revoke warning if current version was revoked
    if (data.isRevoked && revokeBanner) {
        revokeBanner.style.display = 'block';
        const recVer = data.recommendedVersion || 'the latest version';
        revokeBannerText.innerHTML = `⚠️ Version ${data.revokedVersion} was revoked. It is recommended to switch to <b>${recVer}</b>. <u style="cursor:pointer">Download here</u>`;
        revokeBanner.style.cursor = 'pointer';
        revokeBanner.addEventListener('click', () => {
            if (data.recommendedUrl) window.electronAPI.openExternal(data.recommendedUrl);
        }, { once: true });
    }

    if (data.hasUpdate) {
        updateBanner.style.display = 'block';
        updateHint.style.display = 'block';

        if (data.autoUpdate && data.hasInstallerAsset) {
            // Auto-download: immediately start
            updateState = 'available';
            startDownload();
        } else if (data.hasInstallerAsset) {
            // Manual: show blue banner
            updateState = 'available';
            updateBannerText.textContent = `🔔 Update ${data.latestVersion} available — click to download`;
        } else {
            // No installer asset for this platform: fallback to external link
            updateState = 'external-only';
            updateBannerText.textContent = `🔔 Update ${data.latestVersion} available`;
            updateBanner.addEventListener('click', () => {
                const latest = data.releases.find(r => !r.prerelease);
                if (latest) window.electronAPI.openExternal(latest.url);
            }, { once: true });
        }
    }
});

// ── News Feed ──────────────────────────────────────────────────────────────────
const NEWS_COLORS = { red: '#ed4245', yellow: '#faa61a', green: '#3ba55d', blue: '#7289da' };
const NEWS_ROTATION_INTERVAL = 8000;
const NEWS_TRANSITION_DURATION = 300;

let newsItems = [];
let newsCurrentIndex = 0;
let newsRotationTimer = null;
let newsExpanded = false;

const newsFeed = document.getElementById('news-feed');
const newsFeedDot = document.getElementById('news-feed-dot');
const newsFeedPips = document.getElementById('news-feed-pips');
const newsFeedTitle = document.getElementById('news-feed-title');
const newsFeedDate = document.getElementById('news-feed-date');
const newsFeedSummary = document.getElementById('news-feed-summary');
const newsFeedMore = document.getElementById('news-feed-more');
const newsFeedDetail = document.getElementById('news-feed-detail');

function formatNewsDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((todayStart - dateStart) / 86400000);

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return '1 week ago';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 60) return '1 month ago';
    return `${Math.floor(diffDays / 30)} months ago`;
}

function displayNewsItem(index) {
    if (!newsItems.length) return;
    const item = newsItems[index];
    const color = NEWS_COLORS[item.color] || NEWS_COLORS.blue;

    newsFeed.style.borderLeftColor = color;
    newsFeedDot.style.background = color;
    newsFeedTitle.textContent = item.title;
    newsFeed.classList.toggle('news-blink', !!item.blink);
    newsFeedDate.textContent = formatNewsDate(item.date);
    newsFeedSummary.textContent = item.summary;

    if (item.detail) {
        newsFeedMore.style.display = '';
        newsFeedDetail.textContent = item.detail;
    } else {
        newsFeedMore.style.display = 'none';
        newsFeedDetail.style.display = 'none';
    }

    newsExpanded = false;
    newsFeedDetail.style.display = 'none';
    newsFeedMore.textContent = 'Click to read more';

    // Update pips
    const pips = newsFeedPips.querySelectorAll('.news-feed-pip');
    pips.forEach((p, i) => p.classList.toggle('active', i === index));
}

function startNewsRotation() {
    stopNewsRotation();
    if (newsItems.length <= 1) return;
    newsRotationTimer = setInterval(() => {
        if (newsExpanded) return;
        newsFeed.classList.add('news-fade');
        setTimeout(() => {
            newsCurrentIndex = (newsCurrentIndex + 1) % newsItems.length;
            displayNewsItem(newsCurrentIndex);
            newsFeed.classList.remove('news-fade');
        }, NEWS_TRANSITION_DURATION);
    }, NEWS_ROTATION_INTERVAL);
}

function stopNewsRotation() {
    if (newsRotationTimer) {
        clearInterval(newsRotationTimer);
        newsRotationTimer = null;
    }
}

function showNewsFeed() {
    if (newsItems.length > 0 && newsFeed) {
        newsFeed.style.display = '';
        startNewsRotation();
    }
}

function hideNewsFeed() {
    if (newsFeed) {
        newsFeed.style.display = 'none';
        stopNewsRotation();
    }
}

function initNewsFeed(items) {
    newsItems = items.filter(i => !!i.id);

    if (!newsItems.length) return;

    // Build pips
    newsFeedPips.innerHTML = '';
    newsItems.forEach((_, i) => {
        const pip = document.createElement('span');
        pip.className = 'news-feed-pip' + (i === 0 ? ' active' : '');
        pip.addEventListener('click', () => {
            newsCurrentIndex = i;
            displayNewsItem(i);
            stopNewsRotation();
            startNewsRotation();
        });
        newsFeedPips.appendChild(pip);
    });

    newsCurrentIndex = 0;
    displayNewsItem(0);
    newsFeed.style.display = '';
    startNewsRotation();
}

// "Click to read more" toggle
newsFeedMore.addEventListener('click', () => {
    if (!newsExpanded) {
        newsFeedDetail.style.display = '';
        newsFeedMore.textContent = 'Click to collapse';
        newsExpanded = true;
    } else {
        newsFeedDetail.style.display = 'none';
        newsFeedMore.textContent = 'Click to read more';
        newsExpanded = false;
    }
});

// IPC: receive news from main process
window.electronAPI.onNewsData((data) => {
    if (data.items && data.items.length > 0) initNewsFeed(data.items);
});
