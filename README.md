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
Since I'm currently working on a simple installer (or an .exe file), usage is currently intended for people who can handle the code. However, it will be easier in the future!

1. **Share ID:** When you start the program, you will see your personal ID. Click the "Copy" button.
2. **Send to Friend:** Since there is no central server to find people, you need to **send this ID to your friend through another channel** (e.g., via phone, SMS, or another messenger).
3. **Connect:** Your friend enters your ID on their end and clicks "Connect."
4. **Chat & Speak:** As soon as it says "Connected," you can start typing. The microphone is active by default for voice chat.
5. **Mute/Disconnect:** You can mute yourself or terminate the connection using the buttons at the top.

---

## Features & Current Status
- [x] **Update Notifications:** Stay informed! The app checks for new versions and shows you the changelog.
- [x] **Custom Icons:** Professional look with dedicated icons.
- [x] **1-on-1 Chats:** Currently limited to **2 users** (you and one friend) at a time.
- [x] **True P2P:** Direct connection without detours.
- [x] **No Persistence:** Chat history exists only in memory. As soon as the window is closed, everything is gone.
- [x] **Persistent ID:** Your ID remains the same even after a restart (stored in a small local file).
- [x] **Voice Chat:** A voice connection is automatically established as soon as you connect.
- [x] **Dark Mode:** A simple, modern design (inspired by Discord).

---

## How it Works
NullChat uses **WebRTC technology**. Instead of your messages running through a central server from Discord or WhatsApp, your PC establishes a **direct connection** to your friend's PC.

A small signaling server (PeerJS Cloud) only helps the two PCs find each other on the internet ("handshake"). Once the connection is established, chat and voice flow directly from user to user.

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
