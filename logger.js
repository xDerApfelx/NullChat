// ── Anonymous Logger ────────────────────────────────────────────────────────────
// Buffered, crash-resilient, zero-PII logging for NullChat.
// Logs are flushed to disk every FLUSH_INTERVAL_MS and synchronously on crash.
// ─────────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

// ── Configuration ───────────────────────────────────────────────────────────────
const FLUSH_INTERVAL_MS = 5000; // flush buffer to disk every 5 seconds
const MAX_BUFFER_SIZE = 200;    // flush early if buffer exceeds this many lines

let logDir = null;
let logFile = null;
let buffer = [];
let flushTimer = null;
let initialised = false;

// ── Initialise ──────────────────────────────────────────────────────────────────
function init(userDataPath) {
    if (initialised) return;

    logDir = path.join(userDataPath, 'logs');
    logFile = path.join(logDir, 'nullchat.log');

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    // ── Rotation & Cleanup ───────────────────────────────────────────────────────
    try {
        // 1. Rename last session's log if it exists
        if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            const ts = new Date(stats.mtime).toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const rotatedName = path.join(logDir, `nullchat-${ts}.log`);
            fs.renameSync(logFile, rotatedName);
        }

        // 2. Cleanup old logs (older than 7 days OR more than 10 files)
        const files = fs.readdirSync(logDir)
            .filter(f => f.startsWith('nullchat-') && f.endsWith('.log'))
            .map(f => ({ name: f, path: path.join(logDir, f), time: fs.statSync(path.join(logDir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time); // Newest first

        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        files.forEach((file, index) => {
            const isTooOld = file.time < oneWeekAgo;
            const isTooMany = index >= 10; // Keep only last 10 historical logs

            if (isTooOld || isTooMany) {
                fs.unlinkSync(file.path);
            }
        });
    } catch (err) {
        // rotation/cleanup failed — not critical, continue
    }

    // Start periodic flush
    flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS);

    initialised = true;
    info('Logger initialised');
}

// ── Core write ──────────────────────────────────────────────────────────────────
function write(level, message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}`;
    buffer.push(line);

    // Flush early if buffer is large
    if (buffer.length >= MAX_BUFFER_SIZE) {
        flush();
    }
}

// ── Flush buffer to disk ────────────────────────────────────────────────────────
function flush() {
    if (buffer.length === 0 || !logFile) return;

    const data = buffer.join('\n') + '\n';
    buffer = [];

    try {
        fs.appendFileSync(logFile, data, 'utf-8');
    } catch (_) {
        // disk write failed — silently drop (don't crash the app for logging)
    }
}

// ── Public API ──────────────────────────────────────────────────────────────────
function info(msg) { write('INFO', msg); }
function warn(msg) { write('WARN', msg); }
function error(msg) { write('ERROR', msg); }

// ── Crash handler — call this to wire up uncaught exception handling ─────────
function installCrashHandlers() {
    process.on('uncaughtException', (err) => {
        error(`UNCAUGHT EXCEPTION: ${err.message}`);
        error(err.stack || 'No stack trace');
        flush(); // synchronous flush before exit
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        const msg = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : '';
        error(`UNHANDLED REJECTION: ${msg}`);
        if (stack) error(stack);
        flush(); // synchronous flush before exit
    });
}

// ── Shutdown — clean up timer ───────────────────────────────────────────────────
function shutdown() {
    info('App shutting down');
    flush();
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
}

module.exports = { init, info, warn, error, flush, shutdown, installCrashHandlers };
