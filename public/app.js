// ==========================================================================
// NEXUSCHAT CLIENT-SIDE APPLICATION SCRIPT
// ==========================================================================

// Global state
let token = localStorage.getItem('token') || null;
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('user')) || null;
} catch (e) {
  currentUser = null;
}

let socket = null;
let currentRoomId = null;
let roomsList = [];
let onlineUsers = [];
let typingTimeout = null;
let selectedFile = null;
const typingUsers = new Set();

// API Base URL (assuming same host)
const API_URL = '';

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const goToRegister = document.getElementById('go-to-register');
const goToLogin = document.getElementById('go-to-login');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const btnQuickLogin = document.getElementById('btn-quick-login');

const appContainer = document.getElementById('app-container');
const currentUsernameDisplay = document.getElementById('current-username');
const userAvatar = document.getElementById('user-avatar');
const btnLogout = document.getElementById('btn-logout');
const btnCallGreeting = document.getElementById('btn-call-greeting');

const roomsListContainer = document.getElementById('rooms-list');
const btnShowCreateRoom = document.getElementById('btn-show-create-room');
const roomModalOverlay = document.getElementById('room-modal-overlay');
const btnCloseRoomModal = document.getElementById('btn-close-room-modal');
const createRoomForm = document.getElementById('create-room-form');
const roomPrivateCheckbox = document.getElementById('room-private');
const roomPasswordGroup = document.getElementById('room-password-group');
const roomPasswordInput = document.getElementById('room-password');

const passwordModalOverlay = document.getElementById('password-modal-overlay');
const btnClosePasswordModal = document.getElementById('btn-close-password-modal');
const passwordRoomForm = document.getElementById('password-room-form');
const joinRoomPasswordInput = document.getElementById('join-room-password');
let pendingRoomIdToJoin = null;

const activeRoomName = document.getElementById('active-room-name');
const activeRoomDescription = document.getElementById('active-room-description');
const activeRoomTypeBadge = document.getElementById('active-room-type-badge');
const btnSpeakRoom = document.getElementById('btn-speak-room');

const messagesContainer = document.getElementById('messages-container');
const welcomeIntro = document.getElementById('welcome-intro');
const greetingUsername = document.getElementById('greeting-username');
const typingIndicatorBar = document.getElementById('typing-indicator-bar');
const typingText = document.getElementById('typing-text');

const composerForm = document.getElementById('composer-form');
const composerInput = document.getElementById('composer-input');
const btnSendMessage = document.getElementById('btn-send-message');
const btnAttach = document.getElementById('btn-attach');
const fileInput = document.getElementById('file-input');
const composerPreview = document.getElementById('composer-preview');
const previewFilename = document.getElementById('preview-filename');
const btnRemovePreview = document.getElementById('btn-remove-preview');

const onlineUsersList = document.getElementById('online-users-list');
const dmUsersList = document.getElementById('dm-users-list');
const toastContainer = document.getElementById('toast-container');

// ==========================================
// UTILITY FUNCTIONS & TOASTS
// ==========================================

function showToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Slide out and remove
  setTimeout(() => {
    toast.style.animation = 'slideInRight var(--transition-fast) reverse forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// Text-to-Speech Engine
function speakText(text) {
  if ('speechSynthesis' in window) {
    // Cancel any current speaking
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select a premium sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => 
      voice.lang.includes('en') && (voice.name.includes('Google') || voice.name.includes('Natural'))
    ) || voices.find(voice => voice.lang.includes('en'));
    
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } else {
    showToast('TTS Warning', 'Your browser does not support text-to-speech synthesis.', 'error');
  }
}

// Format Date/Time helper
function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Voice Greeting Trigger for prannoy
function triggerVoiceGreeting(username) {
  const name = username.trim().toLowerCase();
  if (name === 'prannoy') {
    speakText("Hello prannoy. Welcome to Nexus Chat. I am your voice assistant.");
    showToast("Voice Assistant", "Calling Hello Prannoy...", "success");
  } else {
    speakText(`Hello ${username}. Welcome to Nexus Chat.`);
    showToast("Voice Assistant", `Greeting ${username}...`, "success");
  }
}

// Setup voice greeting button listener
btnCallGreeting.addEventListener('click', () => {
  if (currentUser) {
    triggerVoiceGreeting(currentUser.username);
  }
});

// Load voices when they change (Chrome loads asynchronously)
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {};
}

// ==========================================
// AUTHENTICATION FLOW
// ==========================================

// Screen switcher
goToRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.remove('active');
  registerForm.classList.add('active');
});

goToLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.remove('active');
  loginForm.classList.add('active');
});

// Seed quick login
btnQuickLogin.addEventListener('click', async () => {
  loginUsernameInput.value = 'prannoy';
  loginPasswordInput.value = '123456';
  loginForm.dispatchEvent(new Event('submit'));
});

// Submit Login form
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    // Save tokens
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    showToast('Success', `Logged in as ${currentUser.username}`, 'success');
    setupAppView();
    
    // Automatically trigger audio greeting on login
    setTimeout(() => {
      triggerVoiceGreeting(currentUser.username);
    }, 800);

  } catch (err) {
    showToast('Login Failed', err.message, 'error');
  }
});

// Submit Registration form
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = registerUsernameInput.value.trim();
  const password = registerPasswordInput.value;

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));

    showToast('Account Created', `Welcome to the platform, ${currentUser.username}!`, 'success');
    setupAppView();
    
    setTimeout(() => {
      triggerVoiceGreeting(currentUser.username);
    }, 800);

  } catch (err) {
    showToast('Registration Error', err.message, 'error');
  }
});

// Logout method
function logout() {
  if (socket) {
    socket.disconnect();
  }
  token = null;
  currentUser = null;
  currentRoomId = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Reset form inputs
  loginUsernameInput.value = '';
  loginPasswordInput.value = '';
  registerUsernameInput.value = '';
  registerPasswordInput.value = '';
  
  // Swap UI views
  appContainer.classList.add('hidden');
  authOverlay.classList.remove('hidden');
  
  showToast('Signed Out', 'You have been disconnected from the server.', 'info');
}

btnLogout.addEventListener('click', logout);

// Check if user is logged in on load
function checkAuthState() {
  if (token && currentUser) {
    setupAppView();
  } else {
    authOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
}

// Setup Dashboard View
function setupAppView() {
  authOverlay.classList.add('hidden');
  appContainer.classList.remove('hidden');
  
  currentUsernameDisplay.textContent = currentUser.username;
  greetingUsername.textContent = currentUser.username;
  
  // Set profile avatar with robohash/dicebear for coolness
  userAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`;
  
  // Reset fields
  composerInput.value = '';
  composerInput.disabled = true;
  btnSendMessage.disabled = true;
  
  // Load room name placeholder
  activeRoomName.textContent = 'Select a Room';
  activeRoomDescription.textContent = 'Join a channel from the sidebar to start exchanging messages.';
  
  initSocket();
  fetchRooms();
}

// ==========================================
// SOCKET.IO REAL-TIME INTERACTION
// ==========================================

function initSocket() {
  if (socket) {
    socket.disconnect();
  }

  // Connect to websocket backend passing jwt token
  socket = io({
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket Connection Error:', err.message);
    showToast('Connection Error', err.message, 'error');
    logout();
  });

  // Handle incoming message
  socket.on('message', (message) => {
    // Only display if it belongs to current active channel
    if (message.roomId === currentRoomId) {
      appendMessage(message);
      scrollToBottom();
    } else {
      // Trigger notification toast for another channel
      if (!message.roomId.startsWith('dm_')) {
        const room = roomsList.find(r => r.id === message.roomId);
        if (room) {
          showToast(`New Msg in #${room.name}`, `${message.senderName}: ${message.content || 'Attached file'}`, 'info');
        }
      } else {
        // Direct Message notification
        showToast(`New Direct Message`, `${message.senderName}: ${message.content || 'Attached file'}`, 'info');
      }
    }
  });

  // Handle online users lists
  socket.on('online-users', (users) => {
    onlineUsers = users;
    renderOnlineUsers();
  });

  // Handle room creation broadcasts
  socket.on('room-created', (newRoom) => {
    roomsList.push(newRoom);
    renderRooms();
  });

  // Handle user joined room notices
  socket.on('user-joined-room', (info) => {
    if (info.roomId === currentRoomId && info.userId !== currentUser.id) {
      appendSystemMessage(`${info.username} joined the chat`);
    }
  });

  // Typing indicators listeners
  socket.on('user-typing', (info) => {
    if (info.roomId === currentRoomId && info.userId !== currentUser.id) {
      typingUsers.add(info.username);
      updateTypingIndicator();
    }
  });

  socket.on('user-stop-typing', (info) => {
    if (info.roomId === currentRoomId && info.userId !== currentUser.id) {
      typingUsers.delete(info.username);
      updateTypingIndicator();
    }
  });
}

// ==========================================
// DATA FETCHING & RENDERING (ROOMS / USERS)
// ==========================================

async function fetchRooms() {
  try {
    const res = await fetch(`${API_URL}/api/rooms`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Failed to retrieve chat rooms');
    
    roomsList = await res.json();
    renderRooms();
    
    // Automatically join general room first
    const generalRoom = roomsList.find(r => r.id === 'general');
    if (generalRoom) {
      joinRoom('general');
    }
  } catch (err) {
    showToast('Rooms Error', err.message, 'error');
  }
}

function renderRooms() {
  roomsListContainer.innerHTML = '';
  
  if (roomsList.length === 0) {
    roomsListContainer.innerHTML = '<p class="dm-fallback">No channels available.</p>';
    return;
  }

  roomsList.forEach(room => {
    const roomEl = document.createElement('div');
    roomEl.className = `room-item ${currentRoomId === room.id ? 'active' : ''}`;
    roomEl.setAttribute('data-id', room.id);
    
    roomEl.innerHTML = `
      <i class="fa-solid ${room.isPrivate ? 'fa-lock' : 'fa-hashtag'} room-icon"></i>
      <div class="room-info">
        <div class="room-name-wrapper">
          <span class="room-name">${room.name}</span>
          ${room.isPrivate ? '<i class="fa-solid fa-lock lock-badge"></i>' : ''}
        </div>
        <span class="room-desc">${room.description || 'No description'}</span>
      </div>
    `;
    
    roomEl.addEventListener('click', () => {
      if (room.id !== currentRoomId) {
        if (room.isPrivate) {
          promptPrivateRoomPassword(room.id);
        } else {
          joinRoom(room.id);
        }
      }
    });
    
    roomsListContainer.appendChild(roomEl);
  });
}

function renderOnlineUsers() {
  onlineUsersList.innerHTML = '';
  dmUsersList.innerHTML = '';
  
  // Filter out self from direct messaging options
  const peerUsers = onlineUsers.filter(u => u.userId !== currentUser.id);
  
  // 1. Online Users list
  onlineUsers.forEach(u => {
    const userEl = document.createElement('div');
    userEl.className = `user-item`;
    
    const isSelf = u.userId === currentUser.id;
    const nameDisplay = isSelf ? `${u.username} (You)` : u.username;
    
    userEl.innerHTML = `
      <div class="user-avatar-sm">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}" alt="Avatar">
        <div class="status-dot online"></div>
      </div>
      <div class="user-info-wrapper">
        <span class="user-name">${nameDisplay}</span>
        <span class="user-status-text">Active Now</span>
      </div>
    `;
    
    if (!isSelf) {
      userEl.addEventListener('click', () => {
        initiateDirectMessage(u.userId, u.username);
      });
    }
    
    onlineUsersList.appendChild(userEl);
  });

  // 2. DM lists
  if (peerUsers.length === 0) {
    dmUsersList.innerHTML = '<p class="dm-fallback">No other active peers online to direct message.</p>';
    return;
  }

  peerUsers.forEach(u => {
    const dmRoomId = getDmRoomId(currentUser.id, u.userId);
    const isActive = currentRoomId === dmRoomId;
    
    const dmEl = document.createElement('div');
    dmEl.className = `user-item ${isActive ? 'active-chat' : ''}`;
    
    dmEl.innerHTML = `
      <div class="user-avatar-sm">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}" alt="Avatar">
        <div class="status-dot online"></div>
      </div>
      <div class="user-info-wrapper">
        <span class="user-name">${u.username}</span>
        <span class="user-status-text">Click to direct chat</span>
      </div>
    `;
    
    dmEl.addEventListener('click', () => {
      initiateDirectMessage(u.userId, u.username);
    });
    
    dmUsersList.appendChild(dmEl);
  });
}

// Compute DM room ID based on sorting
function getDmRoomId(userId1, userId2) {
  const sorted = [userId1, userId2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
}

// Initiate Direct Message Room
function initiateDirectMessage(peerId, peerUsername) {
  const dmRoomId = getDmRoomId(currentUser.id, peerId);
  joinRoom(dmRoomId, null, {
    name: `@${peerUsername}`,
    description: `Direct conversation with ${peerUsername}`,
    isDm: true
  });
}

// ==========================================
// JOINING ROOMS & DM CONVERSATIONS
// ==========================================

function joinRoom(roomId, roomPassword = null, dmMeta = null) {
  if (!socket) return;
  
  socket.emit('join-room', { roomId, roomPassword }, (res) => {
    if (res.error) {
      if (res.passwordRequired) {
        promptPrivateRoomPassword(roomId);
      } else {
        showToast('Access Denied', res.error, 'error');
      }
      return;
    }
    
    // Successfully joined room
    currentRoomId = roomId;
    typingUsers.clear();
    updateTypingIndicator();
    
    // Clear preview file
    clearFileAttachment();
    
    // Update headers and badges
    if (dmMeta) {
      activeRoomName.textContent = dmMeta.name;
      activeRoomDescription.textContent = dmMeta.description;
      activeRoomTypeBadge.textContent = 'Direct Message';
      activeRoomTypeBadge.className = 'badge btn-accent';
    } else {
      activeRoomName.textContent = `#${res.room.name}`;
      activeRoomDescription.textContent = res.room.description;
      activeRoomTypeBadge.textContent = res.room.isPrivate ? 'Private' : 'Public';
      activeRoomTypeBadge.className = res.room.isPrivate ? 'badge' : 'badge btn-primary';
    }
    
    // Enable composer input fields
    composerInput.disabled = false;
    composerInput.placeholder = `Message ${dmMeta ? dmMeta.name : '#' + res.room.name}...`;
    composerInput.focus();
    btnSendMessage.disabled = false;
    
    // Re-render rooms list to highlight active
    renderRooms();
    renderOnlineUsers(); // Re-render to highlight active DM
    
    // Load chat history
    welcomeIntro.classList.add('hidden');
    messagesContainer.innerHTML = '';
    
    if (res.history && res.history.length > 0) {
      res.history.forEach(msg => appendMessage(msg));
    } else {
      appendSystemMessage(`Start of conversation in this channel.`);
    }
    scrollToBottom();
  });
}

// Private password modals logic
function promptPrivateRoomPassword(roomId) {
  pendingRoomIdToJoin = roomId;
  joinRoomPasswordInput.value = '';
  passwordModalOverlay.classList.remove('hidden');
}

btnClosePasswordModal.addEventListener('click', () => {
  passwordModalOverlay.classList.add('hidden');
  pendingRoomIdToJoin = null;
});

passwordRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = joinRoomPasswordInput.value;
  passwordModalOverlay.classList.add('hidden');
  
  if (pendingRoomIdToJoin) {
    joinRoom(pendingRoomIdToJoin, password);
    pendingRoomIdToJoin = null;
  }
});

// Speak Room Details
btnSpeakRoom.addEventListener('click', () => {
  const roomName = activeRoomName.textContent;
  const roomDesc = activeRoomDescription.textContent;
  speakText(`You are viewing room, ${roomName}. Description, ${roomDesc}.`);
});

// ==========================================
// MESSAGE COMPOSITION & FILE ATTACHMENTS
// ==========================================

// Handle messages append inside chat panel
function appendMessage(msg) {
  const isOutgoing = msg.senderId === currentUser.id;
  const msgBlock = document.createElement('div');
  msgBlock.className = `message-block ${isOutgoing ? 'outgoing' : ''}`;
  
  // Format user text with high security
  const formattedContent = escapeHTML(msg.content);
  
  let attachmentHTML = '';
  if (msg.type === 'image' && msg.fileUrl) {
    attachmentHTML = `
      <div class="media-attachment">
        <img src="${msg.fileUrl}" alt="Media shared" onclick="window.open('${msg.fileUrl}')">
      </div>
    `;
  } else if (msg.type === 'file' && msg.fileUrl) {
    const sizeKB = Math.round(msg.fileSize / 102.4) / 10;
    attachmentHTML = `
      <div class="file-attachment">
        <i class="fa-solid fa-file-invoice"></i>
        <div class="file-details">
          <span class="file-name" title="${escapeHTML(msg.fileName)}">${escapeHTML(msg.fileName)}</span>
          <span class="file-size">${sizeKB} KB</span>
        </div>
        <a href="${msg.fileUrl}" download="${escapeHTML(msg.fileName)}" class="file-download-btn" title="Download">
          <i class="fa-solid fa-cloud-arrow-down"></i>
        </a>
      </div>
    `;
  }
  
  msgBlock.innerHTML = `
    <div class="message-avatar">
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderName}" alt="Avatar">
    </div>
    <div class="message-content-wrapper">
      <div class="message-meta">
        <span class="sender-name">${msg.senderName}</span>
        <span class="timestamp">${formatTime(msg.createdAt)}</span>
      </div>
      <div class="message-bubble">
        <span>${formattedContent}</span>
        ${attachmentHTML}
        <!-- Speech Read Button -->
        <button class="btn-bubble-tts" title="Read message aloud">
          <i class="fa-solid fa-volume-low"></i>
        </button>
      </div>
    </div>
  `;
  
  // Hook Speech read bubble helper
  const ttsBtn = msgBlock.querySelector('.btn-bubble-tts');
  ttsBtn.addEventListener('click', () => {
    let ttsText = `${msg.senderName} says: ${msg.content}`;
    if (msg.type === 'image') ttsText = `${msg.senderName} shared an image.`;
    if (msg.type === 'file') ttsText = `${msg.senderName} shared a file named ${msg.fileName}`;
    speakText(ttsText);
  });
  
  messagesContainer.appendChild(msgBlock);
}

function appendSystemMessage(content) {
  const block = document.createElement('div');
  block.className = 'message-block system';
  block.innerHTML = `<div class="system-bubble">${content}</div>`;
  messagesContainer.appendChild(block);
}

// Escape HTML utility to avoid XSS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Composition submission
composerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentRoomId) return;

  const content = composerInput.value.trim();
  
  // If a file is selected, upload it first
  if (selectedFile) {
    btnSendMessage.disabled = true;
    composerInput.disabled = true;
    
    try {
      const fileData = await uploadFile(selectedFile);
      
      // Emit the socket message with fileData attached
      socket.emit('chat-message', {
        roomId: currentRoomId,
        content: content,
        type: fileData.type,
        fileData: fileData
      });
      
      clearFileAttachment();
    } catch (err) {
      showToast('Upload Failed', err.message, 'error');
    } finally {
      btnSendMessage.disabled = false;
      composerInput.disabled = false;
      composerInput.focus();
    }
  } else {
    // Text-only message
    if (!content) return;
    socket.emit('chat-message', {
      roomId: currentRoomId,
      content: content,
      type: 'text'
    });
  }

  composerInput.value = '';
  // Force stop typing
  stopTypingEvent();
});

// ==========================================
// TYPING DETECTORS & THROTTLES
// ==========================================

composerInput.addEventListener('input', () => {
  if (!socket || !currentRoomId) return;
  
  // Emit typing event
  socket.emit('typing', { roomId: currentRoomId });
  
  // Clear existing timeout
  if (typingTimeout) clearTimeout(typingTimeout);
  
  // Setup delay to emit stop-typing
  typingTimeout = setTimeout(() => {
    stopTypingEvent();
  }, 2000);
});

function stopTypingEvent() {
  if (socket && currentRoomId) {
    socket.emit('stop-typing', { roomId: currentRoomId });
  }
}

function updateTypingIndicator() {
  if (typingUsers.size > 0) {
    const list = Array.from(typingUsers);
    let text = '';
    if (list.length === 1) {
      text = `${list[0]} is typing...`;
    } else if (list.length === 2) {
      text = `${list[0]} and ${list[1]} are typing...`;
    } else {
      text = 'Multiple users are typing...';
    }
    
    typingText.textContent = text;
    typingIndicatorBar.classList.remove('hidden');
  } else {
    typingIndicatorBar.classList.add('hidden');
  }
}

// ==========================================
// FILE SHARING LOGICS
// ==========================================

btnAttach.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('File Too Large', 'Maximum file upload size is 10MB.', 'error');
      fileInput.value = '';
      return;
    }
    
    selectedFile = file;
    previewFilename.textContent = file.name;
    composerPreview.classList.remove('hidden');
    composerInput.placeholder = `Add caption to file and press enter...`;
  }
});

btnRemovePreview.addEventListener('click', clearFileAttachment);

function clearFileAttachment() {
  selectedFile = null;
  fileInput.value = '';
  composerPreview.classList.add('hidden');
  if (currentRoomId) {
    composerInput.placeholder = `Type message...`;
  }
}

// Upload file to server REST endpoint
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Server error uploading file.');
  }
  
  return await res.json();
}

// ==========================================
// CREATE ROOM HANDLERS
// ==========================================

btnShowCreateRoom.addEventListener('click', () => {
  roomName.value = '';
  roomDesc.value = '';
  roomPrivateCheckbox.checked = false;
  roomPasswordInput.value = '';
  roomPasswordGroup.classList.add('hidden');
  roomModalOverlay.classList.remove('hidden');
});

btnCloseRoomModal.addEventListener('click', () => {
  roomModalOverlay.classList.add('hidden');
});

roomPrivateCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    roomPasswordGroup.classList.remove('hidden');
    roomPasswordInput.required = true;
  } else {
    roomPasswordGroup.classList.add('hidden');
    roomPasswordInput.required = false;
    roomPasswordInput.value = '';
  }
});

createRoomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('room-name').value.trim();
  const description = document.getElementById('room-desc').value.trim();
  const isPrivate = roomPrivateCheckbox.checked;
  const password = roomPasswordInput.value;

  try {
    const res = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, description, isPrivate, password })
    });

    const data = await res.ok ? await res.json() : null;
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Room creation failed');
    }

    roomModalOverlay.classList.add('hidden');
    showToast('Room Created', `Room #${name} was successfully built!`, 'success');
    
    // Automatically join the newly created room
    joinRoom(data.id);

  } catch (err) {
    showToast('Error Creating Room', err.message, 'error');
  }
});

// Drag and drop attachment support on composer
composerInput.addEventListener('dragover', (e) => {
  e.preventDefault();
  composerInput.style.borderColor = 'var(--color-primary)';
});

composerInput.addEventListener('dragleave', (e) => {
  e.preventDefault();
  composerInput.style.borderColor = 'var(--glass-border)';
});

composerInput.addEventListener('drop', (e) => {
  e.preventDefault();
  composerInput.style.borderColor = 'var(--glass-border)';
  
  const file = e.dataTransfer.files[0];
  if (file) {
    if (file.size > 10 * 1024 * 1024) {
      showToast('File Too Large', 'Maximum file upload size is 10MB.', 'error');
      return;
    }
    
    selectedFile = file;
    previewFilename.textContent = file.name;
    composerPreview.classList.remove('hidden');
    composerInput.placeholder = `Add caption to file and press enter...`;
  }
});

// ==========================================
// STARTUP CHECK
// ==========================================
checkAuthState();
