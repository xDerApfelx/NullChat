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

    // Rotate: rename current log → prev log
    const prevLog = path.join(logDir, 'nullchat.prev.log');
    try {
        if (fs.existsSync(logFile)) {
            if (fs.existsSync(prevLog)) fs.unlinkSync(prevLog);
            fs.renameSync(logFile, prevLog);
        }
    } catch (_) {
        // rotation failed — not critical, continue
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
