# NullChat 🔒

[![Roadmap](https://img.shields.io/badge/Roadmap-View%20Plans-blue?style=for-the-badge)](ROADMAP.md)

A minimalistic, secure, peer-to-peer (P2P) chat and voice application built with Electron and PeerJS.

## Table of Contents
1. [Download & Install](#download--install-📥)
2. [User Guide](#user-guide)
3. [Features & Current Status](#features--current-status)
4. [How it Works](#how-it-works)
5. [The Story behind NullChat 🚀](#the-story-behind-nullchat-🚀)
6. [Why NullChat?](#why-nullchat)
7. [Security & Privacy](#security--privacy)
8. [Troubleshooting & Support](#troubleshooting--support)

---

## Download & Install 📥

**[Download the latest version here](https://github.com/xDerApfelx/NullChat/releases)**

NullChat comes as a standard Windows installer (`.exe`).
- **Standard Options:** The installer lets you choose the installation user (current user or all users).
- **No Admin Rights Needed:** By default, it installs to your local user folder, so you don't even need administrator privileges.

---

## User Guide
1. **Share ID:** When you start the program, you will see your personal ID.
2. **Send to Friend:** Share this ID with a friend securely.
3. **Connect:**
   - **Method A:** Enter the ID and click "Connect".
   - **Method B (New):** Save them as a friend! Click the `+` in the chat header to add them to your sidebar with a nickname. Next time, just click their name in the sidebar.
4. **Chat & Speak:** Once connected, text and voice are live.

---

## Features & Current Status
*   📞 **Smart Notifications:** Intelligent call handling. Known friends trigger a subtle, shaking sidebar hint; unknown callers activate a full-screen request modal.
*   🛡️ **Privacy First:** Incoming connections require your approval. Nobody can force-join a call.
*   🔇 **Mute Safety:** Calls start muted by default. A distinct pulsing visual warning ensures you never forget your microphone status.
*   🎵 **Ringtone:** Soft audio notification for incoming calls.
*   🫂 **Friends Sidebar:** Save your friends locally with custom nicknames for one-click connections.
*   🔔 **Update Notifications:** Stay informed! The app checks for new versions and shows you the changelog.
*   🛠️ **Debug Mode:** Developers can run multiple isolated instances using `npm run debug`.
*   🖌️ **Custom Icons:** Professional look with dedicated icons.
*   👥 **1-on-1 Chat:** Connect directly with one friend at a time.
*   🌐 **True P2P:** Direct connection via WebRTC.
*   🧹 **No Cloud Data:** Chat history exists only in memory. Friends list is stored locally on your device.
*   🔑 **Persistent ID:** Your ID is saved locally so you can restart the app without losing it.
*   📞 **Voice Chat:** A voice connection is automatically established once you accept.
*   🌙 **Dark Mode:** A simple, modern design.

---

## How it Works

NullChat uses **WebRTC technology**. Instead of your messages running through a central server from Discord or WhatsApp, your PC establishes a **direct connection** to your friend's PC.

<details>
<summary><strong>🤓 Technical Deep Dive (For Nerds)</strong></summary>

### Under the Hood
NullChat is an **Electron** application (Chromium + Node.js) that uses **PeerJS** for the networking layer.

1.  **Signaling (Handshake):**
    *   To find each other on the internet, both clients connect briefly to the public PeerJS Cloud signaling server.
    *   They exchange **ICE Candidates** (IP addresses and ports) to figure out inevitable NAT traversal issues.
    *   *Note:* No message content ever touches this signaling server. It only exchanges connection metadata.

2.  **WebRTC Data Channel:**
    *   Once the "handshake" is complete, a direct P2P data tunnel is established using `RTCPeerConnection`.
    *   Text messages are sent via `RTCDataChannel`. They are end-to-end encrypted by default (WebRTC standard).

3.  **Media Stream:**
    *   Voice data uses `navigator.mediaDevices.getUserMedia()` and is streamed directly to the peer.

4.  **Security Model:**
    *   The app uses a strict **Context Isolation** model.
    *   The renderer process (UI) has **no direct access** to Node.js APIs.
    *   All system operations (like copying to clipboard or checking updates) go through a secure internal IPC bridge (`preload.js`).

</details>

---

## The Story behind NullChat 🚀

This is a small passion project. Since companies like Discord are collecting more and more data (and recently even started requiring ID verification), a friend and I simply lost interest in those platforms. We wanted something that just works, without us having to reveal our identity or have our data sold to advertising networks.

**Honesty is important:** I have very little experience with programming and, to be honest, I'm not particularly good at it either. I had this idea and simply asked an AI (Gemini) "just for fun" if it even made sense technically. The entire program emerged from that conversation.

I created NullChat almost entirely with the help of AI. This means:
- **Expect bugs:** Since I'm not a pro, there might be glitches.
- **Transparency:** I don't care if it was made with AI or not – I wanted a solution to a problem, and it worked surprisingly well.
- **Sharing is caring:** I'm sharing this simply in case someone else is also tired of "data krakens."

---

## Why NullChat?
The name says it all. **Null** data permanently stored. **Null** tracking. **Null** account requirement.

It’s intended for people who need a fast, private connection to a friend without a big corporation sitting in the middle.

---

## Security & Privacy
- **Encryption:** All data is end-to-end encrypted by default via WebRTC (DTLS/SRTP).
- **Security-First:** The program is configured so that the chat part has no access to your hard drive or system (sandboxing).
- **No Cloud:** Your messages never touch a cloud database.

## Troubleshooting & Support

Encountering issues? We're here to help!

### How to Report a Bug
1.  **Check the logs:** NullChat creates an anonymous log file to help diagnose problems.
    *   Open File Explorer and paste this into the address bar: `%APPDATA%\nullchat\logs`
    *   You will see a file named `nullchat.log`.
2.  Open an issue on GitHub: [Click here to report a bug](https://github.com/xDerApfelx/NullChat/issues)
3.  **Attach the log file:** Drag and drop the `nullchat.log` file into your issue description.

**Privacy Note:** The log file is designed to be **100% anonymous**. It does NOT contain your messages, your friends' IDs, or any personal data. It only tracks technical events (e.g., 'Connection failed', 'App crashed').
