// Socket.io Client Operations Manager

class SocketClient {
  constructor() {
    this.socket = null;
    this.activeRoomId = null;
    this.typingTimeout = null;
    this.isTyping = false;
  }

  // Connect to the socket server using the JWT Token
  connect(token, onConnectCallback, onErrorCallback) {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Initialize io instance from served client library
    this.socket = io({
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Successfully connected to WebSocket server');
      if (onConnectCallback) onConnectCallback();
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection authentication error:', err.message);
      if (onErrorCallback) onErrorCallback(err.message);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected from server');
    });

    this.setupListeners();
  }

  // Setup standard global event listeners
  setupListeners() {
    if (!this.socket) return;

    // Room broadcast: user online lists
    this.socket.on('online-users', (users) => {
      if (window.chatApp) {
        window.chatApp.updateOnlineUsers(users);
      }
    });

    // Room broadcast: dynamic room creation notifications
    this.socket.on('room-created', (room) => {
      if (window.chatApp) {
        window.chatApp.addRoomToList(room);
      }
    });

    // Incoming messages
    this.socket.on('message', (message) => {
      // Check if message belongs to currently opened room
      if (message.roomId === this.activeRoomId) {
        if (window.chatApp) {
          window.chatApp.renderMessage(message);
          window.chatApp.scrollToBottom();
        }
        
        // Play notification chime for incoming messages from others
        const myUser = window.chatApp.currentUser;
        if (myUser && message.senderId !== myUser.id) {
          window.notifications.playChime();
        }
      } else {
        // Message is from another room or DM. Show popup toast and browser alert
        const myUser = window.chatApp ? window.chatApp.currentUser : null;
        if (myUser && message.senderId !== myUser.id) {
          window.notifications.playChime();
          
          let senderName = message.senderName;
          let bodyText = message.type === 'text' ? message.content : `Sent an attachment: ${message.fileName}`;
          
          // Trigger floating UI toast
          if (window.chatApp) {
            window.chatApp.showToast(senderName, bodyText, () => {
              // Click toast callback: Switch to that room!
              window.chatApp.switchActiveChat(message.roomId);
            });
          }
          
          // Trigger system push notification
          window.notifications.showBrowserNotification(`New message from ${senderName}`, bodyText, () => {
            if (window.chatApp) window.chatApp.switchActiveChat(message.roomId);
          });
        }
      }
    });

    // Handle incoming typing status broadcasts
    this.socket.on('user-typing', ({ userId, username, roomId }) => {
      if (roomId === this.activeRoomId) {
        if (window.chatApp) {
          window.chatApp.showTypingIndicator(username);
        }
      }
    });

    this.socket.on('user-stop-typing', ({ userId, username, roomId }) => {
      if (roomId === this.activeRoomId) {
        if (window.chatApp) {
          window.chatApp.hideTypingIndicator();
        }
      }
    });
  }

  // Join a standard chat room or DM conversation
  joinRoom(roomId, password = null, callback) {
    if (!this.socket) return;

    this.socket.emit('join-room', { roomId, roomPassword: password }, (response) => {
      if (response.success) {
        this.activeRoomId = roomId;
        this.hideTypingIndicator(); // clear typing states
        
        if (callback) callback(null, response.room, response.history);
      } else {
        if (callback) callback(response.error, null, null, response.passwordRequired);
      }
    });
  }

  // Emit a text or multimedia message
  sendMessage(content, type = 'text', fileData = null) {
    if (!this.socket || !this.activeRoomId) return;

    this.socket.emit('chat-message', {
      roomId: this.activeRoomId,
      content,
      type,
      fileData
    });
    
    this.emitStopTyping();
  }

  // Send "User is typing" indicator to room
  emitTyping() {
    if (!this.socket || !this.activeRoomId || this.isTyping) return;

    this.isTyping = true;
    this.socket.emit('typing', { roomId: this.activeRoomId });
  }

  // Send "User stopped typing" indicator to room
  emitStopTyping() {
    if (!this.socket || !this.activeRoomId || !this.isTyping) return;

    this.isTyping = false;
    this.socket.emit('stop-typing', { roomId: this.activeRoomId });
  }

  // Heartbeat typing tracker
  handleTypingState() {
    this.emitTyping();

    // Reset typing status if user hasn't typed in 2.5 seconds
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.emitStopTyping();
    }, 2500);
  }

  // Disconnect from websocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.activeRoomId = null;
    }
  }
}

// Global reference
window.socketClient = new SocketClient();
