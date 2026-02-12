# NullChat

A minimalistic, secure, peer-to-peer (P2P) chat and voice application built with Electron and PeerJS.

## Features
- **True P2P:** Direct communication between peers using WebRTC.
- **No Persistence:** Messages are only stored in memory. Closing the app wipes all data.
- **Secure ID:** Generates a unique UUID that persists across restarts.
- **Voice Calls:** Automatic voice stream connection upon chat initialization.
- **Dark Mode:** Modern, Discord-inspired UI.

## Technology Stack
- **Electron:** Desktop wrapper.
- **PeerJS:** WebRTC implementation using public PeerJS cloud servers for signaling.
- **Vanilla JS/CSS:** No heavy frameworks, just clean logic and styling.

## Installation
1. Clone the repo:
   ```bash
   git clone https://github.com/xDerApfelx/NullChat.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app:
   ```bash
   npm start
   ```

## Security
- `nodeIntegration` is disabled.
- Remote content is isolated via `contextBridge` and `preload.js`.
- Peer-to-peer data is encrypted via WebRTC's native DTLS/SRTP protocols.
