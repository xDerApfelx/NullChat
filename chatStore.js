/**
 * chatStore.js — Encrypted Chat Persistence Module
 *
 * Handles: Master-Key (safeStorage), per-chat key derivation (HKDF),
 * AES-256-GCM encryption, SQLite storage, lazy loading, auto-cleanup.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');
const Database = require('better-sqlite3');

// ─── Master Key Management ───────────────────────────────────────────────────

const MASTER_KEY_FILE = 'master.key';
let masterKey = null;

/**
 * Initialize or load the master key using Electron's safeStorage.
 * The master key is a random 256-bit key, encrypted by the OS credential store.
 */
function initMasterKey(userDataPath) {
    const keyPath = path.join(userDataPath, MASTER_KEY_FILE);

    if (fs.existsSync(keyPath)) {
        // Load and decrypt existing master key
        const encryptedKey = fs.readFileSync(keyPath);
        if (safeStorage.isEncryptionAvailable()) {
            masterKey = safeStorage.decryptString(encryptedKey);
        } else {
            // Fallback: use raw key (less secure, but functional)
            masterKey = encryptedKey.toString('hex');
        }
    } else {
        // Generate new 256-bit master key
        const rawKey = crypto.randomBytes(32).toString('hex');
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(rawKey);
            fs.writeFileSync(keyPath, encrypted);
        } else {
            fs.writeFileSync(keyPath, rawKey);
        }
        masterKey = rawKey;
    }
}

// ─── Key Derivation ─────────────────────────────────────────────────────────

/**
 * Derive a per-chat encryption key from master key + both peer IDs.
 * Uses HKDF (SHA-256) with sorted peer IDs as salt for deterministic output.
 */
function deriveChatKey(myPeerId, friendPeerId) {
    const sortedIds = [myPeerId, friendPeerId].sort().join(':');
    const salt = Buffer.from(sortedIds, 'utf8');
    const ikm = Buffer.from(masterKey, 'hex');
    const info = Buffer.from('nullchat-persistence-v1', 'utf8');

    return crypto.hkdfSync('sha256', ikm, salt, info, 32);
}

// ─── Encryption / Decryption ─────────────────────────────────────────────────

/**
 * Encrypt a message string with AES-256-GCM.
 * Returns base64-encoded string: iv(12) + authTag(16) + ciphertext
 */
function encryptMessage(chatKey, plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', chatKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM message.
 */
function decryptMessage(chatKey, encryptedBase64) {
    const data = Buffer.from(encryptedBase64, 'base64');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', chatKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
}

// ─── Database Management ─────────────────────────────────────────────────────

const CHATS_DIR = 'chats';
const openDatabases = new Map(); // friendPeerId → { db, chatKey }

/**
 * Get the chats directory path, creating it if needed.
 */
function getChatsDir(userDataPath) {
    const dir = path.join(userDataPath, CHATS_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Get a sanitized filename for a peer's chat database.
 */
function getDbFileName(friendPeerId) {
    // PeerJS IDs are UUIDs, safe for filenames, but sanitize anyway
    const safe = friendPeerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `chat_${safe}.db`;
}

/**
 * Open (or get cached) database for a specific friend.
 */
function openChatDb(userDataPath, myPeerId, friendPeerId) {
    if (openDatabases.has(friendPeerId)) {
        return openDatabases.get(friendPeerId);
    }

    const chatsDir = getChatsDir(userDataPath);
    const dbPath = path.join(chatsDir, getDbFileName(friendPeerId));
    const chatKey = deriveChatKey(myPeerId, friendPeerId);

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            msg_type TEXT NOT NULL DEFAULT 'text'
        );
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    // Store last accessed time
    const upsertMeta = db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);
    upsertMeta.run('last_accessed', new Date().toISOString());

    const handle = { db, chatKey, dbPath };
    openDatabases.set(friendPeerId, handle);
    return handle;
}

/**
 * Close a specific chat database.
 */
function closeChatDb(friendPeerId) {
    const handle = openDatabases.get(friendPeerId);
    if (handle) {
        try { handle.db.close(); } catch (e) { /* ignore */ }
        openDatabases.delete(friendPeerId);
    }
}

/**
 * Close all open databases (on app quit).
 */
function closeAll() {
    for (const [peerId, handle] of openDatabases) {
        try { handle.db.close(); } catch (e) { /* ignore */ }
    }
    openDatabases.clear();
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Save a message to the chat database (encrypted).
 * @param {string} sender - 'self' or 'friend'
 * @param {string} text - Plain text content
 * @param {string} msgType - 'text', 'system', or 'file-ref'
 * @returns {object} The saved message with id and timestamp
 */
function saveMessage(userDataPath, myPeerId, friendPeerId, sender, text, msgType = 'text') {
    const { db, chatKey } = openChatDb(userDataPath, myPeerId, friendPeerId);
    const timestamp = new Date().toISOString();
    const encryptedContent = encryptMessage(chatKey, text);

    const stmt = db.prepare(
        `INSERT INTO messages (sender, content, timestamp, msg_type) VALUES (?, ?, ?, ?)`
    );
    const result = stmt.run(sender, encryptedContent, timestamp, msgType);

    // Update last accessed
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`).run('last_accessed', timestamp);

    return { id: result.lastInsertRowid, sender, text, timestamp, msgType };
}

/**
 * Load messages with pagination (for lazy loading).
 * @param {number} limit - Number of messages to load
 * @param {number} beforeId - Load messages with id < beforeId (0 = latest)
 * @returns {Array} Messages in chronological order (oldest first)
 */
function loadMessages(userDataPath, myPeerId, friendPeerId, limit = 50, beforeId = 0) {
    const { db, chatKey } = openChatDb(userDataPath, myPeerId, friendPeerId);

    let stmt;
    let rows;
    if (beforeId > 0) {
        stmt = db.prepare(
            `SELECT id, sender, content, timestamp, msg_type FROM messages
             WHERE id < ? ORDER BY id DESC LIMIT ?`
        );
        rows = stmt.all(beforeId, limit);
    } else {
        stmt = db.prepare(
            `SELECT id, sender, content, timestamp, msg_type FROM messages
             ORDER BY id DESC LIMIT ?`
        );
        rows = stmt.all(limit);
    }

    // Decrypt and reverse to chronological order
    return rows.reverse().map(row => ({
        id: row.id,
        sender: row.sender,
        text: decryptMessage(chatKey, row.content),
        timestamp: row.timestamp,
        msgType: row.msg_type
    }));
}

/**
 * Get total message count for a chat.
 */
function getMessageCount(userDataPath, myPeerId, friendPeerId) {
    const { db } = openChatDb(userDataPath, myPeerId, friendPeerId);
    return db.prepare(`SELECT COUNT(*) as count FROM messages`).get().count;
}

/**
 * Get the storage size of a chat database in bytes.
 * Includes WAL and SHM files which can hold significant data.
 */
function getChatSize(userDataPath, myPeerId, friendPeerId) {
    const chatsDir = getChatsDir(userDataPath);
    const dbPath = path.join(chatsDir, getDbFileName(friendPeerId));
    let total = 0;
    for (const suffix of ['', '-wal', '-shm']) {
        const p = dbPath + suffix;
        if (fs.existsSync(p)) {
            total += fs.statSync(p).size;
        }
    }
    return total;
}

/**
 * Delete an entire chat (database file + WAL + SHM).
 */
function deleteChat(userDataPath, myPeerId, friendPeerId) {
    // If DB is open, checkpoint WAL into main file, then close
    const handle = openDatabases.get(friendPeerId);
    if (handle) {
        try { handle.db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* ignore */ }
        try { handle.db.close(); } catch (e) { /* ignore */ }
        openDatabases.delete(friendPeerId);
    }

    const chatsDir = getChatsDir(userDataPath);
    const dbPath = path.join(chatsDir, getDbFileName(friendPeerId));

    // Delete all database files
    for (const suffix of ['', '-wal', '-shm']) {
        const p = dbPath + suffix;
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
        }
    }
}

/**
 * Check if a chat database exists for a friend.
 */
function chatExists(userDataPath, friendPeerId) {
    const chatsDir = getChatsDir(userDataPath);
    const dbPath = path.join(chatsDir, getDbFileName(friendPeerId));
    return fs.existsSync(dbPath);
}

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Search messages by decrypting and filtering (required because content is encrypted).
 * @param {string} query - Search term (case-insensitive)
 * @param {number} limit - Max results to return
 * @returns {Array} Matching messages with id, sender, text, timestamp, msgType
 */
function searchMessages(userDataPath, myPeerId, friendPeerId, query, limit = 50) {
    const { db, chatKey } = openChatDb(userDataPath, myPeerId, friendPeerId);
    const lowerQuery = query.toLowerCase();
    const results = [];

    // Only search text and system messages, skip file-ref
    const stmt = db.prepare(
        `SELECT id, sender, content, timestamp, msg_type FROM messages
         WHERE msg_type IN ('text', 'system') ORDER BY id DESC`
    );

    for (const row of stmt.iterate()) {
        if (results.length >= limit) break;
        try {
            const text = decryptMessage(chatKey, row.content);
            if (text.toLowerCase().includes(lowerQuery)) {
                results.push({
                    id: row.id,
                    sender: row.sender,
                    text,
                    timestamp: row.timestamp,
                    msgType: row.msg_type
                });
            }
        } catch {
            // Skip corrupted messages
        }
    }

    return results;
}

// ─── Recording State Persistence ─────────────────────────────────────────────

/**
 * Save recording state (whether recording is active for a chat).
 */
function setRecordingState(userDataPath, myPeerId, friendPeerId, isRecording) {
    const { db } = openChatDb(userDataPath, myPeerId, friendPeerId);
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
        .run('recording', isRecording ? 'true' : 'false');
}

/**
 * Get recording state for a chat.
 */
function getRecordingState(userDataPath, myPeerId, friendPeerId) {
    if (!chatExists(userDataPath, friendPeerId)) return false;
    const { db } = openChatDb(userDataPath, myPeerId, friendPeerId);
    const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get('recording');
    return row ? row.value === 'true' : false;
}

// ─── Auto-Cleanup ────────────────────────────────────────────────────────────

const INACTIVITY_MONTHS = 12;
const WARNING_DAYS = 30;

/**
 * Check all chats for inactivity and return warnings/deletions.
 * @returns {{ warnings: Array<{friendId, lastAccessed, daysUntilDeletion}>, deleted: string[] }}
 */
function checkAutoCleanup(userDataPath, myPeerId) {
    const chatsDir = getChatsDir(userDataPath);
    const result = { warnings: [], deleted: [] };

    if (!fs.existsSync(chatsDir)) return result;

    const files = fs.readdirSync(chatsDir).filter(f => f.startsWith('chat_') && f.endsWith('.db'));
    const now = new Date();
    const inactivityMs = INACTIVITY_MONTHS * 30 * 24 * 60 * 60 * 1000;
    const warningMs = (INACTIVITY_MONTHS * 30 - WARNING_DAYS) * 24 * 60 * 60 * 1000;

    for (const file of files) {
        const dbPath = path.join(chatsDir, file);
        // Extract friend ID from filename: chat_<friendId>.db
        const friendId = file.replace('chat_', '').replace('.db', '');

        try {
            const db = new Database(dbPath, { readonly: true });
            const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get('last_accessed');
            db.close();

            if (!row) continue;

            const lastAccessed = new Date(row.value);
            const elapsed = now - lastAccessed;

            if (elapsed >= inactivityMs) {
                // Delete this chat
                deleteChat(userDataPath, myPeerId, friendId);
                result.deleted.push(friendId);
            } else if (elapsed >= warningMs) {
                // Warning: will be deleted soon
                const daysLeft = Math.ceil((inactivityMs - elapsed) / (24 * 60 * 60 * 1000));
                result.warnings.push({
                    friendId,
                    lastAccessed: row.value,
                    daysUntilDeletion: daysLeft
                });
            }
        } catch (e) {
            // Corrupted DB, skip
        }
    }

    return result;
}

/**
 * Get a list of all chats with their metadata.
 */
function listChats(userDataPath) {
    const chatsDir = getChatsDir(userDataPath);
    const chats = [];

    if (!fs.existsSync(chatsDir)) return chats;

    const files = fs.readdirSync(chatsDir).filter(f => f.startsWith('chat_') && f.endsWith('.db'));
    for (const file of files) {
        const dbPath = path.join(chatsDir, file);
        const friendId = file.replace('chat_', '').replace('.db', '');

        try {
            const size = fs.statSync(dbPath).size;
            const db = new Database(dbPath, { readonly: true });
            const countRow = db.prepare(`SELECT COUNT(*) as count FROM messages`).get();
            const metaRow = db.prepare(`SELECT value FROM meta WHERE key = ?`).get('last_accessed');
            const recordingRow = db.prepare(`SELECT value FROM meta WHERE key = ?`).get('recording');
            db.close();

            chats.push({
                friendId,
                messageCount: countRow.count,
                size,
                lastAccessed: metaRow ? metaRow.value : null,
                recording: recordingRow ? recordingRow.value === 'true' : false
            });
        } catch (e) {
            // Skip corrupted
        }
    }

    return chats;
}

// ─── Module Exports ──────────────────────────────────────────────────────────

module.exports = {
    initMasterKey,
    saveMessage,
    loadMessages,
    searchMessages,
    getMessageCount,
    getChatSize,
    deleteChat,
    chatExists,
    setRecordingState,
    getRecordingState,
    checkAutoCleanup,
    listChats,
    closeChatDb,
    closeAll
};
