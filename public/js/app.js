// NexusChat Core Application Controller

class ChatApp {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('nexus_token');
    this.activeChatId = 'general';
    this.activeChatType = 'room'; // 'room' or 'dm'
    this.theme = localStorage.getItem('nexus_theme') || 'dark';
    this.onlineUsers = [];
    this.allUsers = [];
    this.selectedFile = null;
    
    // Cache DOM Elements
    this.cacheElements();
    this.initTheme();
    this.bindEvents();
    this.initEmojiPicker();
    this.checkAuthentication();
  }

  cacheElements() {
    // Containers
    this.initialLoader = document.getElementById('initial-loader');
    this.authContainer = document.getElementById('auth-container');
    this.appContainer = document.getElementById('app-container');
    this.sidebarLeft = document.getElementById('sidebar-left');
    this.sidebarBackdrop = document.getElementById('sidebar-backdrop');
    
    // Forms & Error
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.authSubtitle = document.getElementById('auth-subtitle');
    this.authError = document.getElementById('auth-error');
    
    // Switches
    this.toRegisterBtn = document.getElementById('to-register-btn');
    this.toLoginBtn = document.getElementById('to-login-btn');
    
    // Global Header & profile
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.logoutBtn = document.getElementById('logout-btn');
    this.myAvatar = document.getElementById('my-avatar');
    this.myUsername = document.getElementById('my-username');
    
    // Lists Panels
    this.roomsList = document.getElementById('rooms-list');
    this.usersList = document.getElementById('users-list');
    
    // Chat Window
    this.activeChatTitle = document.getElementById('active-chat-title');
    this.activeChatSubtitle = document.getElementById('active-chat-subtitle');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.messagesStream = document.getElementById('messages-stream');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.typingUserName = document.getElementById('typing-user-name');
    
    // Inputs & attachments
    this.attachmentPreview = document.getElementById('attachment-preview');
    this.attachmentPreviewName = document.getElementById('attachment-preview-name');
    this.attachmentPreviewSize = document.getElementById('attachment-preview-size');
    this.attachmentPreviewRemove = document.getElementById('attachment-preview-remove');
    this.fileUploadInput = document.getElementById('file-upload-input');
    this.fileSelectBtn = document.getElementById('file-select-btn');
    this.emojiToggleBtn = document.getElementById('emoji-toggle-btn');
    this.emojiDrawer = document.getElementById('emoji-drawer');
    this.chatMessageInput = document.getElementById('chat-message-input');
    this.chatSendBtn = document.getElementById('chat-send-btn');
    
    // Modals
    this.openCreateRoomBtn = document.getElementById('open-create-room-btn');
    this.createRoomModal = document.getElementById('create-room-modal');
    this.createRoomClose = document.getElementById('create-room-close');
    this.createRoomCancelBtn = document.getElementById('create-room-cancel-btn');
    this.createRoomSubmitBtn = document.getElementById('create-room-submit-btn');
    this.newRoomName = document.getElementById('new-room-name');
    this.newRoomDesc = document.getElementById('new-room-desc');
    this.newRoomPrivate = document.getElementById('new-room-private');
    this.roomPasswordGroup = document.getElementById('room-password-group');
    this.newRoomPassword = document.getElementById('new-room-password');
    
    this.passwordRoomModal = document.getElementById('password-room-modal');
    this.passwordRoomClose = document.getElementById('password-room-close');
    this.passwordRoomCancelBtn = document.getElementById('password-room-cancel-btn');
    this.passwordRoomSubmitBtn = document.getElementById('password-room-submit-btn');
    this.joinRoomPasswordInput = document.getElementById('join-room-password-input');
    this.joinRoomError = document.getElementById('join-room-error');
    
    // Toast UI
    this.notificationToast = document.getElementById('notification-toast');
    this.toastSender = document.getElementById('toast-sender');
    this.toastText = document.getElementById('toast-text');
    
    // Responsive hamburger
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    
    // Track password verification room
    this.pendingPasswordRoomId = null;
  }

  // Theme Setup
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('nexus_theme', this.theme);
  }

  // Bind Listeners
  bindEvents() {
    // Theme toggle
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    
    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      const enabled = window.notifications.toggleSound();
      this.soundToggleBtn.innerHTML = enabled ? '🔊' : '🔇';
      this.soundToggleBtn.title = enabled ? 'Toggle Sound: On' : 'Toggle Sound: Off';
    });

    // Auth screen transitions
    this.toRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.loginForm.style.display = 'none';
      this.registerForm.style.display = 'flex';
      this.authSubtitle.innerText = 'Join NexusChat and start messaging.';
      this.hideAuthError();
    });

    this.toLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.registerForm.style.display = 'none';
      this.loginForm.style.display = 'flex';
      this.authSubtitle.innerText = 'Welcome back! Access your workspace.';
      this.hideAuthError();
    });

    // Auth Forms Submits
    this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    this.logoutBtn.addEventListener('click', () => this.logout());

    // Messages send events
    this.chatSendBtn.addEventListener('click', () => this.handleSendMessage());
    this.chatMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      } else {
        // Emit typing status on keystroke
        window.socketClient.handleTypingState();
      }
    });

    // Emoji panel controls
    this.emojiToggleBtn.addEventListener('click', () => {
      const isOpen = this.emojiDrawer.style.display === 'grid';
      this.emojiDrawer.style.display = isOpen ? 'none' : 'grid';
      this.emojiToggleBtn.classList.toggle('active', !isOpen);
    });

    // File attachments controls
    this.fileSelectBtn.addEventListener('click', () => this.fileUploadInput.click());
    this.fileUploadInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.attachmentPreviewRemove.addEventListener('click', () => this.clearFileSelection());

    // Create room modal open/close
    this.openCreateRoomBtn.addEventListener('click', () => {
      this.createRoomModal.style.display = 'flex';
      this.newRoomName.focus();
    });
    const closeCreateRoom = () => {
      this.createRoomModal.style.display = 'none';
      this.newRoomName.value = '';
      this.newRoomDesc.value = '';
      this.newRoomPrivate.checked = false;
      this.newRoomPassword.value = '';
      this.roomPasswordGroup.style.display = 'none';
    };
    this.createRoomClose.addEventListener('click', closeCreateRoom);
    this.createRoomCancelBtn.addEventListener('click', closeCreateRoom);
    this.newRoomPrivate.addEventListener('change', () => {
      this.roomPasswordGroup.style.display = this.newRoomPrivate.checked ? 'flex' : 'none';
    });
    this.createRoomSubmitBtn.addEventListener('click', () => this.handleCreateRoom(closeCreateRoom));

    // Password verification modal
    const closePasswordModal = () => {
      this.passwordRoomModal.style.display = 'none';
      this.joinRoomPasswordInput.value = '';
      this.joinRoomError.style.display = 'none';
      this.pendingPasswordRoomId = null;
    };
    this.passwordRoomClose.addEventListener('click', closePasswordModal);
    this.passwordRoomCancelBtn.addEventListener('click', closePasswordModal);
    this.passwordRoomSubmitBtn.addEventListener('click', () => this.handleVerifyRoomPassword(closePasswordModal));
    this.joinRoomPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleVerifyRoomPassword(closePasswordModal);
    });

    // Mobile navigation controls
    this.mobileMenuBtn.addEventListener('click', () => {
      this.sidebarLeft.classList.toggle('show');
      this.sidebarBackdrop.classList.toggle('show');
    });

    this.sidebarBackdrop.addEventListener('click', () => {
      this.sidebarLeft.classList.remove('show');
      this.sidebarBackdrop.classList.remove('show');
    });
  }

  // Emoji Populator
  initEmojiPicker() {
    const emojis = [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
      '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
      '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
      '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
      '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
      '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
      '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
      '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
      '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👊',
      '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝'
    ];
    
    emojis.forEach(emoji => {
      const emojiBtn = document.createElement('div');
      emojiBtn.classList.add('emoji-btn');
      emojiBtn.innerText = emoji;
      emojiBtn.addEventListener('click', () => {
        this.chatMessageInput.value += emoji;
        this.chatMessageInput.focus();
        this.emojiDrawer.style.display = 'none';
        this.emojiToggleBtn.classList.remove('active');
      });
      this.emojiDrawer.appendChild(emojiBtn);
    });
  }

  // Auth Operations
  checkAuthentication() {
    if (this.token) {
      // Decode JWT locally to read username (or query server)
      try {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        this.currentUser = { id: payload.id, username: payload.username };
        this.initWorkspace();
      } catch (err) {
        console.error('Invalid JWT format, clearing storage:', err);
        this.logout();
      }
    } else {
      this.initialLoader.style.display = 'none';
      this.authContainer.style.display = 'flex';
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    this.hideAuthError();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('nexus_token', data.token);
      this.token = data.token;
      this.currentUser = data.user;
      
      this.authContainer.style.display = 'none';
      this.initWorkspace();
    } catch (err) {
      this.showAuthError(err.message);
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    this.hideAuthError();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    if (password !== passwordConfirm) {
      return this.showAuthError('Passwords do not match');
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      localStorage.setItem('nexus_token', data.token);
      this.token = data.token;
      this.currentUser = data.user;
      
      this.authContainer.style.display = 'none';
      this.initWorkspace();
    } catch (err) {
      this.showAuthError(err.message);
    }
  }

  logout() {
    localStorage.removeItem('nexus_token');
    this.token = null;
    this.currentUser = null;
    window.socketClient.disconnect();
    
    this.appContainer.style.display = 'none';
    this.authContainer.style.display = 'flex';
    this.initialLoader.style.display = 'none';
    
    // Reset forms
    this.loginForm.reset();
    this.registerForm.reset();
    this.loginForm.style.display = 'flex';
    this.registerForm.style.display = 'none';
    this.authSubtitle.innerText = 'Welcome back! Access your workspace.';
  }

  showAuthError(msg) {
    this.authError.innerText = msg;
    this.authError.style.display = 'block';
  }

  hideAuthError() {
    this.authError.innerText = '';
    this.authError.style.display = 'none';
  }

  // Workspace Initialization
  async initWorkspace() {
    this.initialLoader.style.display = 'flex';
    
    // Set Profile UI
    this.myUsername.innerText = this.currentUser.username;
    this.myAvatar.innerText = this.currentUser.username.substring(0, 2).toUpperCase();

    // Connect WebSocket
    window.socketClient.connect(
      this.token,
      () => {
        // Callback on successful connect
        this.loadSidebarData().then(() => {
          this.initialLoader.style.display = 'none';
          this.appContainer.style.display = 'flex';
          
          // Switch to default General Chat room
          this.switchActiveChat('general', 'room');
        });
      },
      (errMessage) => {
        // Callback on connect error (e.g. expired token)
        this.logout();
        alert('Authentication failed: ' + errMessage);
      }
    );
  }

  async loadSidebarData() {
    try {
      // 1. Fetch Rooms (which we get from a socket listener, or can render initially)
      // Since rooms list is small, we will query them directly, or let the server broadcast
      // We can also create a default room fetch, but since we are simple we'll just populate rooms list
      const defaultRooms = [
        { id: 'general', name: 'General Chat', description: 'Welcome to the main chat room!', isPrivate: false },
        { id: 'gaming', name: 'Gaming Zone', description: 'Talk about your favorite games.', isPrivate: false },
        { id: 'tech', name: 'Tech Talk', description: 'Programming, hardware, and news.', isPrivate: false }
      ];
      this.roomsList.innerHTML = '';
      defaultRooms.forEach(room => this.addRoomToList(room));

      // 2. Fetch Users List for DMs
      const response = await fetch('/api/users', {
        headers: { 'Authorization': 'Bearer ' + this.token }
      });
      if (response.ok) {
        this.allUsers = await response.json();
        this.renderUsersList();
      }
    } catch (err) {
      console.error('Error fetching sidebar initialization data:', err);
    }
  }

  // Sidebar dynamic modifiers
  addRoomToList(room) {
    // Check if room is already rendered to avoid double entries
    if (document.getElementById(`item-room-${room.id}`)) return;

    const div = document.createElement('div');
    div.id = `item-room-${room.id}`;
    div.classList.add('list-item');
    div.innerHTML = `
      <div class="list-item-left">
        <span>#</span>
        <span class="list-item-name">${room.name}</span>
      </div>
      <span class="item-meta">${room.isPrivate ? '🔒' : ''}</span>
    `;
    
    div.addEventListener('click', () => {
      this.switchActiveChat(room.id, 'room');
      // Collapse sidebar on mobile once clicked
      this.sidebarLeft.classList.remove('show');
      this.sidebarBackdrop.classList.remove('show');
    });

    this.roomsList.appendChild(div);
  }

  renderUsersList() {
    this.usersList.innerHTML = '';
    
    // Filter out our own user from DMs list
    const dmUsers = this.allUsers.filter(u => u.id !== this.currentUser.id);
    
    if (dmUsers.length === 0) {
      this.usersList.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">No other users found</div>';
      return;
    }

    dmUsers.forEach(user => {
      const isOnline = this.onlineUsers.some(ou => ou.userId === user.id);
      
      const div = document.createElement('div');
      div.id = `item-user-${user.id}`;
      div.classList.add('list-item');
      div.innerHTML = `
        <div class="list-item-left">
          <div class="status-badge ${isOnline ? 'online' : ''}" id="status-badge-${user.id}"></div>
          <span class="list-item-name">${user.username}</span>
        </div>
      `;

      div.addEventListener('click', () => {
        // For DMs, the room ID is combined dm_user1_user2
        const sortedIds = [this.currentUser.id, user.id].sort();
        const dmRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
        
        this.switchActiveChat(dmRoomId, 'dm', user.username);
        this.sidebarLeft.classList.remove('show');
        this.sidebarBackdrop.classList.remove('show');
      });

      this.usersList.appendChild(div);
    });
  }

  updateOnlineUsers(onlineUsers) {
    this.onlineUsers = onlineUsers;
    
    // Update active badges in user list
    this.allUsers.forEach(user => {
      const isOnline = this.onlineUsers.some(ou => ou.userId === user.id);
      const badge = document.getElementById(`status-badge-${user.id}`);
      if (badge) {
        if (isOnline) {
          badge.classList.add('online');
        } else {
          badge.classList.remove('online');
        }
      }
    });
  }

  // Room / DM Switching Logic
  switchActiveChat(chatId, type = null, customName = null) {
    // If type is not provided, detect from ID prefix
    if (!type) {
      type = chatId.startsWith('dm_') ? 'dm' : 'room';
    }

    this.activeChatId = chatId;
    this.activeChatType = type;

    // Highlight sidebar active items
    document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));
    if (type === 'room') {
      const roomEl = document.getElementById(`item-room-${chatId}`);
      if (roomEl) roomEl.classList.add('active');
    } else {
      // Find direct message recipient user ID from room name dm_id1_id2
      const parts = chatId.replace('dm_', '').split('_');
      const otherUserId = parts.find(id => id !== this.currentUser.id);
      const userEl = document.getElementById(`item-user-${otherUserId}`);
      if (userEl) userEl.classList.add('active');
    }

    // Attempt to join the room on websocket
    this.joinSelectedRoom(chatId, null);
  }

  joinSelectedRoom(roomId, password = null) {
    window.socketClient.joinRoom(roomId, password, (err, room, history, passwordRequired) => {
      if (err) {
        if (passwordRequired) {
          // Open room password verification modal
          this.pendingPasswordRoomId = roomId;
          this.passwordRoomModal.style.display = 'flex';
          this.joinRoomPasswordInput.focus();
        } else {
          alert('Failed to join chat: ' + err);
        }
        return;
      }

      // Update Header Details
      if (this.activeChatType === 'room') {
        this.activeChatTitle.innerText = `# ${room.name}`;
        this.activeChatSubtitle.innerText = room.description || '';
      } else {
        // DM conversation name rendering
        // Extract recipient username
        const parts = roomId.replace('dm_', '').split('_');
        const otherUserId = parts.find(id => id !== this.currentUser.id);
        const otherUser = this.allUsers.find(u => u.id === otherUserId);
        const otherUsername = otherUser ? otherUser.username : 'Direct Message';
        
        this.activeChatTitle.innerText = `💬 ${otherUsername}`;
        this.activeChatSubtitle.innerText = 'Private 1-on-1 direct conversation.';
      }

      // Render Messages stream history
      this.messagesStream.innerHTML = '';
      // Inject templates back
      this.messagesStream.appendChild(this.typingIndicator);
      
      history.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();
    });
  }

  handleVerifyRoomPassword(closeCallback) {
    const password = this.joinRoomPasswordInput.value;
    if (!password) {
      this.joinRoomError.innerText = 'Password is required';
      this.joinRoomError.style.display = 'block';
      return;
    }

    window.socketClient.joinRoom(this.pendingPasswordRoomId, password, (err, room, history) => {
      if (err) {
        this.joinRoomError.innerText = err;
        this.joinRoomError.style.display = 'block';
        return;
      }

      // Succeeded!
      closeCallback();
      this.switchActiveChat(room.id, 'room');
    });
  }

  // Room Creation
  async handleCreateRoom(closeCallback) {
    const name = this.newRoomName.value.trim();
    const description = this.newRoomDesc.value.trim();
    const isPrivate = this.newRoomPrivate.checked;
    const password = this.newRoomPassword.value;

    if (!name) return alert('Room name is required');
    if (isPrivate && password.length < 4) {
      return alert('Private rooms require a password of at least 4 characters');
    }

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.token
        },
        body: JSON.stringify({ name, description, isPrivate, password })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to create room');
      
      closeCallback();
      
      // Select the new room automatically
      this.switchActiveChat(data.id, 'room');
    } catch (err) {
      alert(err.message);
    }
  }

  // Chat message rendering
  renderMessage(msg) {
    const isSelf = msg.senderId === this.currentUser.id;
    
    const node = document.createElement('div');
    node.classList.add('message-node', isSelf ? 'self' : 'other');
    
    // Format timestamp
    const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let contentHtml = '';
    
    if (msg.type === 'text') {
      contentHtml = `<div class="msg-bubble">${msg.content}</div>`;
    } else if (msg.type === 'image') {
      contentHtml = `
        <div class="msg-bubble">
          <div class="msg-media">
            <img src="${msg.fileUrl}" alt="shared image" onclick="window.open('${msg.fileUrl}', '_blank')">
          </div>
          ${msg.content ? `<p style="margin-top: 6px;">${msg.content}</p>` : ''}
        </div>
      `;
    } else if (msg.type === 'file') {
      const sizeMB = (msg.fileSize / (1024 * 1024)).toFixed(2);
      contentHtml = `
        <div class="msg-bubble">
          <a href="${msg.fileUrl}" download="${msg.fileName}" class="msg-attachment">
            <span class="msg-attachment-icon">📁</span>
            <div class="msg-attachment-info">
              <span class="msg-attachment-name" title="${msg.fileName}">${msg.fileName}</span>
              <span class="msg-attachment-size">${sizeMB} MB</span>
            </div>
          </a>
          ${msg.content ? `<p style="margin-top: 6px;">${msg.content}</p>` : ''}
        </div>
      `;
    }

    node.innerHTML = `
      <span class="msg-sender">${msg.senderName}</span>
      ${contentHtml}
      <span class="msg-timestamp">${timeStr}</span>
    `;

    // Append message above typing indicator template
    this.messagesStream.insertBefore(node, this.typingIndicator);
  }

  scrollToBottom() {
    this.messagesStream.scrollTop = this.messagesStream.scrollHeight;
  }

  // Typing state indicators modifiers
  showTypingIndicator(username) {
    this.typingUserName.innerText = username;
    this.typingIndicator.style.display = 'flex';
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    this.typingIndicator.style.display = 'none';
  }

  // Upload/File processing logic
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large! Maximum limit is 10MB.');
      return;
    }

    this.selectedFile = file;
    const sizeKB = (file.size / 1024).toFixed(0);
    
    this.attachmentPreviewName.innerText = file.name;
    this.attachmentPreviewSize.innerText = `(${sizeKB} KB)`;
    this.attachmentPreview.style.display = 'flex';
    
    this.chatMessageInput.placeholder = 'Add a caption...';
  }

  clearFileSelection() {
    this.selectedFile = null;
    this.fileUploadInput.value = '';
    this.attachmentPreview.style.display = 'none';
    this.chatMessageInput.placeholder = 'Type a message...';
  }

  async handleSendMessage() {
    const textContent = this.chatMessageInput.value.trim();
    
    if (!textContent && !this.selectedFile) return;

    // Reset fields
    this.chatMessageInput.value = '';

    // If there is an attachment
    if (this.selectedFile) {
      // Show upload indicator / lock input
      const fileToUpload = this.selectedFile;
      this.clearFileSelection();
      
      try {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + this.token },
          body: formData
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Upload failed');
        
        // Emit image or file message
        window.socketClient.sendMessage(textContent, data.type, {
          url: data.url,
          name: data.name,
          size: data.size
        });
      } catch (err) {
        alert('File upload failed: ' + err.message);
      }
    } else {
      // Direct text send
      window.socketClient.sendMessage(textContent, 'text');
    }
  }

  // Toast UI Popup Trigger
  showToast(senderName, messageText, onClickCallback) {
    this.toastSender.innerText = senderName;
    this.toastText.innerText = messageText;
    
    this.notificationToast.classList.add('show');
    
    // Remove click event handlers to avoid duplication
    const newToast = this.notificationToast.cloneNode(true);
    this.notificationToast.parentNode.replaceChild(newToast, this.notificationToast);
    this.notificationToast = newToast;
    this.toastSender = document.getElementById('toast-sender');
    this.toastText = document.getElementById('toast-text');
    
    this.notificationToast.addEventListener('click', () => {
      onClickCallback();
      this.notificationToast.classList.remove('show');
    });

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.notificationToast.classList.remove('show');
    }, 4000);
  }
}

// Instantiate on document load
document.addEventListener('DOMContentLoaded', () => {
  window.chatApp = new ChatApp();
});
