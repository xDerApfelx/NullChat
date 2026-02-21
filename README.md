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
9. [License](#license)

---

## Download & Install 📥

**[Download the latest version here](https://github.com/xDerApfelx/NullChat/releases)**

NullChat comes in two flavors right now:

*   🟢 **Stable (v2.0.0):** Recommended for everyone. Includes Group Chat (Mesh), Integrated Updates, and Settings.

NullChat comes as a standard Windows installer (`.exe`).
- **Optional Shortcuts:** The installer lets you choose whether to create desktop or start menu shortcuts during setup.
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

## Core Features
*   🌐 **100% Serverless & Private:** Direct P2P connection via WebRTC. Your messages and voice calls never touch a central server, and no cloud data is ever stored.
*   👥 **Group Voice & Text Chat:** Seamlessly connect with multiple friends in a single secure mesh call.
*   🛡️ **Privacy First:** You have full control. Incoming connections always require your approval, ensuring nobody can force-join your calls.
*   🫂 **Friends Sidebar:** Save your friends locally and assign custom nicknames for quick, one-click connections.
*   📞 **Smart Notifications:** Known friends trigger a subtle notification, while unknown callers activate a clear request screen.
*   📥 **Integrated Updates:** Get notified and install new versions directly within the app.
*   🌙 **Modern Dark Mode:** A sleek, minimalistic, and user-friendly interface.

---

## How it Works

NullChat uses **WebRTC technology**. Instead of your messages running through a central server from Discord or WhatsApp, your PC establishes a **direct connection** to your friend's PC.

<details>
<summary><strong>🤓 Technical Deep Dive (For Nerds)</strong></summary>

### Under the Hood
NullChat is an **Electron** application (Chromium + Node.js) that uses **PeerJS** for the networking layer.

1.  **Signaling (Handshake):**
    *   To find each other on the internet, clients connect briefly to the public PeerJS Cloud signaling server.
    *   They exchange **ICE Candidates** (IP addresses and ports) to figure out NAT traversal.
    *   *Note:* No message content ever touches this signaling server. It only exchanges connection metadata.

2.  **Mesh Networking:**
    *   In v2.0+, NullChat uses a **Full Mesh** topology.
    *   When you "invite" someone to a call, the app helps coordinate direct 1-on-1 connections between every single participant in the group.
    *   Voice data and messages are broadcast to every connected peer directly.

3.  **Media Stream:**
    *   Voice data uses `navigator.mediaDevices.getUserMedia()` and is streamed directly using SRTP (Secure Real-time Transport Protocol).

4.  **Security Model:**
    *   The app uses a strict **Context Isolation** model.
    *   The renderer process (UI) has **no direct access** to Node.js APIs.
    *   All system operations (like copying to clipboard or checking updates) go through a secure internal IPC bridge (`preload.js`).

</details>

---

## The Story behind NullChat 🚀

This is a small passion project. Since companies like Discord are collecting more and more data (and recently even started requiring ID verification), a friend and I simply lost interest in those platforms. We wanted something that just works, without us having to reveal our identity or have our data sold to advertising networks.

**Honesty is important:** I have a background in networking, so I knew the logic of how a private system should work, but I’m definitely not a pro programmer. I’ll be honest: I used a lot of AI to help me write the code. I know some people hate that, but it allowed me to turn this idea into a reality much faster and better than I ever expected.

I created NullChat almost entirely with the help of AI. This means:
- **Expect bugs:** Since I'm not a pro, there might be glitches.
- **Transparency:** I don't care if it was made with AI or not – I wanted a solution to a problem, and it worked surprisingly well.
- **Sharing is caring:** I'm sharing this simply in case someone else is also tired of "data krakens."

---

## Why NullChat?
The name says it all. **Null** data permanently stored. **Null** tracking. **Null** account requirement.

It’s intended for people who need a fast, private connection to friends without a big corporation sitting in the middle.

---

## Security & Privacy
- **Encryption:** All data is end-to-end encrypted by default via WebRTC (DTLS/SRTP).
- **Security-First:** The program is configured so that the chat part has no access to your hard drive or system (sandboxing).
- **No Cloud:** Your messages never touch a cloud database.

## Troubleshooting & Support

Encountering issues? We're here to help!

### 🐛 How to Report a Bug
    If you encounter bugs, please help us fix them by providing:
    
    1.  **A detailed description** of what you did and what happened.
    2.  **Screen recording** (optional but extremely helpful!) showing how to reproduce the bug.
    3.  **Log files** from all involved peers (if possible).
    
    **Where to find logs:**
    *   Press `Win + R`, type `%APPDATA%\nullchat\logs`, and press Enter.
    *   You will see a file named `nullchat.log`.
    
    **Report issues here:** [Open an issue on GitHub](https://github.com/xDerApfelx/NullChat/issues) and drag & drop the log file into the description.

**Privacy Note:** The log file is designed to be **100% anonymous**. It does NOT contain your messages, your friends' IDs, or any personal data. It only tracks technical events (e.g., 'Connection failed', 'App crashed').

---

## 📜 License

NullChat is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

**In short, you are free to:**
- **Share:** Copy and redistribute the material in any medium or format.
- **Adapt:** Remix, transform, and build upon the material.

**Under the following terms:**
- **Attribution:** You must give appropriate credit.
- **NonCommercial:** You may not use the material for commercial purposes.
- **ShareAlike:** If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

See the [LICENSE](LICENSE) file for details.
