const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'nexus_secret_key_1298471923';

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware to authenticate API requests via JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

// --- HTTP API ENDPOINTS ---

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const user = db.createUser(username, passwordHash);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Room Endpoint (authenticated)
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate, password } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name is required' });
    
    let passwordHash = null;
    if (isPrivate && password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }
    
    const room = db.createRoom(name, description, isPrivate, passwordHash, req.user.id);
    
    // Notify all connected sockets about the new room
    io.emit('room-created', {
      id: room.id,
      name: room.name,
      description: room.description,
      isPrivate: room.isPrivate
    });
    
    res.status(201).json(room);
  } catch (err) {
    console.error('Room creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload File Endpoint (authenticated)
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Determine type (image or generic file)
    let type = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      type = 'image';
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      url: fileUrl,
      name: req.file.originalname,
      size: req.file.size,
      type
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch active users list (authenticated)
app.get('/api/users', authenticateToken, (req, res) => {
  try {
    const users = db.getUsers().map(u => ({ id: u.id, username: u.username }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Fetch active rooms list (authenticated)
app.get('/api/rooms', authenticateToken, (req, res) => {
  try {
    const rooms = db.getRooms().map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isPrivate: r.isPrivate
    }));
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// --- SOCKET.IO REAL-TIME MANAGER ---

// Maps socket.id to user info
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  const user = socket.user;
  
  // Store user connection (handle multiple tabs by storing socket)
  onlineUsers.set(socket.id, {
    userId: user.id,
    username: user.username,
    connectedAt: new Date()
  });
  
  console.log(`User connected: ${user.username} (Socket: ${socket.id})`);
  
  // Broadcast updated online status
  sendOnlineUsersList();
  
  // Handlers
  
  // Join room (chat room or Direct Message)
  socket.on('join-room', async ({ roomId, roomPassword }, callback) => {
    try {
      const isDm = roomId.startsWith('dm_');
      let roomInfo = null;
      
      if (isDm) {
        // Direct Message validation: check if current user is part of the room
        const parts = roomId.replace('dm_', '').split('_');
        if (!parts.includes(user.id)) {
          return callback({ error: 'Unauthorized to view this conversation' });
        }
        roomInfo = { id: roomId, name: 'Direct Message', isPrivate: true };
      } else {
        // Room validation
        const room = db.getRoomById(roomId);
        if (!room) {
          return callback({ error: 'Room not found' });
        }
        
        // Private room password validation
        if (room.isPrivate && room.passwordHash) {
          if (!roomPassword) {
            return callback({ error: 'Password required', passwordRequired: true });
          }
          const isMatch = await bcrypt.compare(roomPassword, room.passwordHash);
          if (!isMatch) {
            return callback({ error: 'Incorrect room password', passwordRequired: true });
          }
        }
        
        roomInfo = room;
      }
      
      // Leave previous rooms (except their socket-specific ID room)
      const currentRooms = Array.from(socket.rooms);
      currentRooms.forEach(r => {
        if (r !== socket.id) {
          socket.leave(r);
        }
      });
      
      // Join new room
      socket.join(roomId);
      
      // Fetch chat history
      const history = db.getMessages(roomId);
      
      callback({ success: true, room: roomInfo, history });
      
      // Broadcast to room that user joined
      socket.to(roomId).emit('user-joined-room', {
        userId: user.id,
        username: user.username,
        roomId
      });
      
    } catch (err) {
      console.error('Error joining room:', err);
      callback({ error: 'Failed to join room' });
    }
  });
  
  // Incoming Chat Message
  socket.on('chat-message', ({ roomId, content, type = 'text', fileData = null }) => {
    if (!content && !fileData) return;
    
    let savedMsg;
    const isDm = roomId.startsWith('dm_');
    
    if (isDm) {
      const parts = roomId.replace('dm_', '').split('_');
      const receiverId = parts.find(id => id !== user.id) || user.id; // Self-message fallback
      savedMsg = db.saveDirectMessage(user.id, user.username, receiverId, content, type, fileData);
    } else {
      savedMsg = db.saveMessage(roomId, user.id, user.username, content, type, fileData);
    }
    
    // Broadcast message to room (including sender)
    io.to(roomId).emit('message', savedMsg);
  });
  
  // Typing Indicator
  socket.on('typing', ({ roomId }) => {
    socket.to(roomId).emit('user-typing', {
      userId: user.id,
      username: user.username,
      roomId
    });
  });
  
  // Stop Typing Indicator
  socket.on('stop-typing', ({ roomId }) => {
    socket.to(roomId).emit('user-stop-typing', {
      userId: user.id,
      username: user.username,
      roomId
    });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${user.username} (Socket: ${socket.id})`);
    onlineUsers.delete(socket.id);
    sendOnlineUsersList();
  });
});

// Helper to broadcast unique online users list
function sendOnlineUsersList() {
  const uniqueUsers = {};
  onlineUsers.forEach((value) => {
    uniqueUsers[value.userId] = {
      userId: value.userId,
      username: value.username
    };
  });
  io.emit('online-users', Object.values(uniqueUsers));
}

// Serve SPA for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Seed default user 'prannoy' with password '123456' on startup
async function seedDefaultUser() {
  try {
    const existingUser = db.getUserByUsername('prannoy');
    if (!existingUser) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('123456', salt);
      db.createUser('prannoy', passwordHash);
      console.log('🌱 Successfully seeded default user: prannoy with password 123456');
    } else {
      console.log('🌱 Default user prannoy already exists in the database.');
    }
  } catch (err) {
    console.error('Error seeding default user:', err);
  }
}

// Start Server
server.listen(PORT, async () => {
  await seedDefaultUser();
  console.log(`==================================================`);
  console.log(`🚀 NexusChat Server running on http://localhost:${PORT}`);
  console.log(`==================================================`);
});
