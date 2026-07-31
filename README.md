# PRODIGY_WD_04: NexusChat - Premium Real-Time Chat Application

Welcome to **NexusChat**, a premium, visually stunning, real-time messaging application designed with a modern glassmorphic interface. The application features user authentication, persistent chat history, public/private rooms, direct messaging, user presence states, typing indicators, multimedia file sharing, and audio/browser notifications.

This project fulfills **Task-04** of the Prodigy Infotech Web Development internship.

---

## 🌟 Key Features

1. **Elegant Glassmorphism Design:**
   - Premium color system (Deep space dark theme vs lavender light theme).
   - Glassmorphic panels using high-density backdrop blur filters, custom gradients, and glowing borders.
   - Smooth layout transitions and floating animations.

2. **User Authentication & Session Security:**
   - Registration and Login panels.
   - Passwords hashed using `bcryptjs` on the server.
   - Stateless session management using JSON Web Tokens (JWT) stored client-side.
   - Socket connection handshake authentication using client-stored JWT.

3. **Dynamic Chat Rooms:**
   - Instantly create new public or password-protected rooms.
   - Real-time room creation broadcast to all active users.
   - Join/leave mechanics with notification syncs.
   - Persistent room chat history fetched from server-side JSON database.

4. **One-on-One Direct Messaging (DM):**
   - Click any registered user in the sidebar to initiate a direct message.
   - Independent DM message routing and persistence.

5. **Real-time User Presence & Status:**
   - Dynamic user online/offline status updates in the sidebar with glowing status indicators.
   - Active typing status notifications ("User is typing...").

6. **Multimedia File Sharing:**
   - Send images and files (up to 10MB) directly in chat rooms and direct messages.
   - Automatic image inline preview rendering and click-to-zoom support.
   - Download links with file size calculations for other documents.

7. **Rich Client Notification System:**
   - Web Audio API synthesizer for zero-dependency notification chimes.
   - Native OS desktop notification banners when the browser tab is hidden or backgrounded.
   - Click-to-switch room navigation on active notification banners and toast widgets.

---

## 📂 Project Structure

```
PRODIGY_WD_04/
├── package.json               # Node dependencies & start scripts
├── db.js                      # Synchronization JSON file database helper
├── server.js                  # Express and Socket.io server
├── database.json              # Persistent data store (users, rooms, history)
├── uploads/                   # [Directory] Saved attachments
└── public/                    # Client static assets
    ├── index.html             # Client single-page layout
    ├── css/
    │   ├── variables.css      # CSS variables & theme parameters
    │   └── main.css           # Styling layouts, bubbles, & animations
    └── js/
        ├── notifications.js   # Browser push and Audio API controller
        ├── socket-client.js   # WebSocket event client manager
        └── app.js             # Main SPA views and DOM controller
```

---

## 🚀 How to Run Locally

### Prerequisites
Make sure you have **Node.js** (v14 or higher) installed on your system.

### Steps to Run
1. Navigate to the project directory:
   ```bash
   cd PRODIGY_WD_04
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🧪 Seeding Details (Easy Testing)

For convenience during review and testing:
- The server automatically seeds a default user on startup:
  - **Username:** `prannoy`
  - **Password:** `123456`
- Open two separate browser tabs (or one standard tab and one incognito tab) to test real-time chat sync, typing indicators, and user presence indicators between `prannoy` and a new registered user!

---

## 🛠️ Built With

* **Backend**: Node.js, Express, Socket.io, JWT, bcryptjs, multer
* **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism design tokens), Vanilla Javascript
* **Database**: Lightweight JSON transactional database
