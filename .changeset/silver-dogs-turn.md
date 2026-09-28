---
'hongzhao': minor
---

feat: launch browser toolbox with QR code generator, encrypted link transfer, and 2FA

- **QR code**: generate QR codes for text, URLs, Wi-Fi, contacts, events, and 2FA with PNG/SVG export, camera scanning, and image recognition, including a safe preview mode that prevents immediate navigation.
- **Encrypted link transfer**: encode and share data via URL hash fragments with optional AES-256-GCM or ECDH-ES (X25519) encryption, paired with a standalone receiver page supporting in-memory persistent key sessions.
- **2FA**: compute real-time TOTP verification codes from Base32 secrets, otpauth URIs, or uploaded QR screenshots, with exportable QR codes for authenticator apps.
- **Offline & PWA**: fully client-side Progressive Web App operating with strict zero-network CSP (`connect-src 'none'`), ephemeral in-memory state, and HTTP LAN compatibility.
