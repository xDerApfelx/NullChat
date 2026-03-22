# NullChat 🔒

[![Roadmap](https://img.shields.io/badge/Roadmap-View%20Plans-blue?style=for-the-badge)](ROADMAP.md)

A minimalistic, secure, peer-to-peer (P2P) chat and voice application built with Electron and PeerJS.

## Table of Contents
1. [Download & Install](#download--install-📥)
2. [User Guide](#user-guide)
3. [Core Features](#core-features)
4. [How it Works](#how-it-works)
5. [The Story behind NullChat](#the-story-behind-nullchat-🚀)
6. [Why NullChat?](#why-nullchat)
7. [Flaws & Limitations](#️-flaws--limitations)
8. [Security & Privacy](#security--privacy)
9. [FAQ](#-faq)
10. [Troubleshooting & Support](#troubleshooting--support)
11. [License](#license)

---

## Download & Install 📥

**[Download the latest version here](https://github.com/xDerApfelx/NullChat/releases)**

NullChat is available for **Windows**, **macOS**, and **Linux**:

*   🪟 **Windows:** Standard installer (`.exe`) — optional shortcuts, no admin rights needed.
*   🍎 **macOS:** DMG image (`.dmg`) — drag to Applications to install. *Note: The app is unsigned, so you may need to right-click → "Open" on first launch.*
*   🐧 **Linux:** AppImage (`.AppImage`) or `.deb` package.
    *   **AppImage:** Runs on virtually any Linux distro (Ubuntu, Fedora, Arch, openSUSE, Manjaro, Mint, etc.) — no installation needed, just make executable and run.
    *   **`.deb`:** For Debian-based distros (Ubuntu, Linux Mint, Pop!_OS, elementary OS, etc.).

---

## User Guide
1. **Share ID:** When you start the program, you will see your personal ID.
2. **Send to Friend:** Share this ID with a friend securely.
3. **Connect:**
   - **Method A:** Enter the ID and click "Connect".
   - **Method B:** Save them as a friend! Click the `+` in the chat header to add them to your sidebar with a nickname. Next time, just click their name in the sidebar.
4. **Chat & Speak:** Once connected, text and voice are live.

---

## Core Features
*   🌐 **Peer-to-Peer & Private:** Direct connection via WebRTC. Your messages and voice calls travel directly between devices — no central server stores or relays your data. A lightweight signaling server is only used for the initial handshake (see [How it Works](#how-it-works)).
*   👥 **Group Voice & Text Chat:** Seamlessly connect with multiple friends in a single secure mesh call.
*   🛡️ **Privacy First:** You have full control. Incoming connections always require your approval, ensuring nobody can force-join your calls.
*   🫂 **Friends Sidebar:** Save your friends locally and assign custom nicknames for quick, one-click connections.
*   📞 **Smart Notifications:** Known friends trigger a subtle notification, while unknown callers activate a clear request screen.
*   📥 **Integrated Updates:** Get notified and install new versions directly within the app.
*   🎚️ **Full Audio Control:** Choose your microphone and speaker, test your mic with a live level meter, set individual call volumes per person, and fine-tune noise suppression and voice activity detection — all from the Settings menu.
*   🌙 **Modern Dark Mode:** A sleek, minimalistic, and user-friendly interface.

---

## How it Works

NullChat uses **WebRTC technology**. Instead of your messages running through a central server like Discord or WhatsApp, your PC establishes a **direct connection** to your friend's PC.

**Important:** NullChat uses a public signaling server *only* for the initial connection handshake. This server helps two peers find each other on the internet — it never sees your messages, voice data, or any content. Once the connection is established, the signaling server is no longer involved and all communication flows directly between you and your friend.

<details>
<summary><strong>🤓 Technical Deep Dive (For Nerds)</strong></summary>

### Under the Hood
NullChat is an **Electron** application (Chromium + Node.js) that uses **PeerJS** for the networking layer.

1.  **Signaling (Handshake):**
    *   To find each other on the internet, clients connect briefly to the public PeerJS Cloud signaling server.
    *   They exchange **ICE Candidates** (IP addresses and ports) to figure out NAT traversal.
    *   *Note:* No message content ever touches this signaling server. It only exchanges connection metadata.

2.  **Mesh Networking:**
    *   NullChat uses a **Full Mesh** topology for group calls.
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

**Honesty is important:** I have a background in networking, so I knew the logic of how a private system should work, but I'm definitely not a pro programmer. I'll be honest: I used a lot of AI to help me write the code. I know some people hate that, but it allowed me to turn this idea into a reality much faster and better than I ever expected.

I created NullChat almost entirely with the help of AI. This means:
- **Expect bugs:** Since I'm not a pro, there might be glitches.
- **Transparency:** I don't care if it was made with AI or not – I wanted a solution to a problem, and it worked surprisingly well.
- **Sharing is caring:** I'm sharing this simply in case someone else is also tired of "data krakens."

---

## Why NullChat?
The name says it all. **Null** data permanently stored. **Null** tracking. **Null** account requirement.

It's intended for people who need a fast, private connection to friends without a big corporation sitting in the middle.

NullChat started as a **fun side project** and that's exactly what it still is. I don't expect it to ever replace Discord or TeamSpeak — and that's not the goal. But if all you need is a simple, private way to talk to friends without accounts, servers, or data collection, it does exactly that.

### ⚠️ Flaws & Limitations
Being honest matters. There are things NullChat intentionally *can't* do:

- **Both users must be online at the same time.** Because there are no servers storing messages, there's no way to deliver messages when your friend is offline. It's a live connection — if they're not there, it doesn't work. This is the direct trade-off for having zero data storage.
- **Desktop only.** Available for Windows, macOS, and Linux — but no mobile support yet.
- **No message history.** By design — everything lives in RAM and disappears when you close the app.

---

## Security & Privacy
- **Encryption:** All data is end-to-end encrypted by default via WebRTC (DTLS/SRTP).
- **Sandboxed:** The program is configured so that the chat part has no access to your hard drive or system (Context Isolation).
- **No Cloud:** Your messages never touch a cloud database.
- **No Accounts:** No registration, no email, no phone number. Just open and connect.

---

## ❓ FAQ

<details>
<summary><strong>Is NullChat really serverless?</strong></summary>

Not 100%, and we want to be transparent about that. NullChat uses a public **signaling server** (PeerJS Cloud) only to help two peers find each other on the internet — like a matchmaker that introduces you and then leaves the room. Once the connection is established, **all communication is direct between you and your friend**. The signaling server never sees your messages, voice data, or any content. Your actual conversations are fully peer-to-peer.
</details>

<details>
<summary><strong>How secure is NullChat?</strong></summary>

All voice and text data is **end-to-end encrypted** by default using WebRTC's built-in DTLS/SRTP encryption. This means your data is encrypted before it leaves your device and can only be decrypted by the person you're talking to. On top of that, the app uses **Context Isolation** (sandboxing), so the chat interface has no access to your file system or operating system. There are no accounts, no stored data, and no servers that could be hacked or subpoenaed.
</details>

<details>
<summary><strong>Why use Peer IDs instead of IP addresses or ports?</strong></summary>

Connecting via raw IP addresses would expose your exact network location to anyone you chat with and require manual port forwarding — a huge privacy and usability problem. PeerJS IDs act as an **anonymous alias** that gets resolved during the signaling handshake. This way, WebRTC handles NAT traversal automatically (via ICE/STUN), and neither user needs to know the other's IP address to connect. It's both more private and more user-friendly.
</details>

<details>
<summary><strong>Why JavaScript? Why Electron? Why PeerJS?</strong></summary>

Honestly? I don't have a strong technical reason for any of these choices. When I started this project, I described what I wanted to build and AI suggested this tech stack — JavaScript, Electron, PeerJS. I went with it without overthinking, and it turned out to work really well for what NullChat needs to do. Could other choices have worked too? Probably. But these got the job done.
</details>

<details>
<summary><strong>Will there be a mobile version?</strong></summary>

Maybe. It's something I'm exploring, but there's no timeline or promise. The current focus is on making the desktop experience as solid as possible. If a mobile version happens, Android would likely come first.
</details>

<details>
<summary><strong>Can people see my IP address?</strong></summary>

The person you're directly connected to *could* technically see your IP address — this is inherent to any peer-to-peer technology (including torrents, online gaming, etc.). However, the signaling server and other group members in a mesh call only see connection metadata. If IP privacy is critical to you, using a VPN is recommended.
</details>

<details>
<summary><strong>Why is there no message history?</strong></summary>

By design. NullChat stores nothing — all messages exist only in RAM while the app is running. The moment you close the app, everything is gone. This is a deliberate privacy choice: what doesn't exist can't be leaked, hacked, or subpoenaed.
</details>

<details>
<summary><strong>Is NullChat open source?</strong></summary>

Yes! The full source code is available on GitHub. NullChat is licensed under **CC BY-NC-SA 4.0**, meaning you can view, share, and modify the code for non-commercial purposes as long as you give credit and share under the same license.
</details>

---

## Troubleshooting & Support

Encountering issues? We're here to help!

### 🐛 How to Report a Bug
If you encounter bugs, please help us fix them by providing:

1.  **A detailed description** of what you did and what happened.
2.  **Screen recording** (optional but extremely helpful!) showing how to reproduce the bug.
3.  **Log files** from all involved peers (if possible).

**Where to find logs:**
*   **Windows:** Press `Win + R`, type `%APPDATA%\nullchat\logs`, and press Enter.
*   **macOS:** Open Finder → Go → Go to Folder → `~/Library/Application Support/nullchat/logs`
*   **Linux:** Open a terminal and navigate to `~/.config/nullchat/logs`
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
