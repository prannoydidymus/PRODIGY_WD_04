const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// Initialize database file if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: [],
      rooms: [
        { id: 'general', name: 'General Chat', description: 'Welcome to the main chat room!', isPrivate: false, passwordHash: null, createdAt: new Date() },
        { id: 'gaming', name: 'Gaming Zone', description: 'Talk about your favorite games.', isPrivate: false, passwordHash: null, createdAt: new Date() },
        { id: 'tech', name: 'Tech Talk', description: 'Programming, hardware, and news.', isPrivate: false, passwordHash: null, createdAt: new Date() }
      ],
      messages: [] // Contains room messages and direct messages
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

// Helper to read data synchronously
function readData() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading database file, returning empty structure:', err);
    return { users: [], rooms: [], messages: [] };
  }
}

// Helper to write data synchronously
function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

// --- USER OPERATIONS ---

function getUsers() {
  return readData().users;
}

function getUserByUsername(username) {
  const users = getUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function getUserById(id) {
  const users = getUsers();
  return users.find(u => u.id === id);
}

function createUser(username, passwordHash) {
  const data = readData();
  const newUser = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    username,
    passwordHash,
    createdAt: new Date()
  };
  data.users.push(newUser);
  writeData(data);
  return newUser;
}

// --- ROOM OPERATIONS ---

function getRooms() {
  return readData().rooms;
}

function getRoomById(id) {
  return getRooms().find(r => r.id === id);
}

function createRoom(name, description, isPrivate = false, passwordHash = null, ownerId = null) {
  const data = readData();
  const newRoom = {
    id: 'room_' + Math.random().toString(36).substr(2, 9),
    name,
    description: description || 'No description provided.',
    isPrivate,
    passwordHash,
    ownerId,
    createdAt: new Date()
  };
  data.rooms.push(newRoom);
  writeData(data);
  return newRoom;
}

// --- MESSAGE OPERATIONS ---

function getMessages(roomId) {
  const data = readData();
  return data.messages.filter(m => m.roomId === roomId);
}

function saveMessage(roomId, senderId, senderName, content, type = 'text', fileData = null) {
  const data = readData();
  const newMessage = {
    id: 'msg_' + Math.random().toString(36).substr(2, 9),
    roomId,
    senderId,
    senderName,
    content,
    type, // 'text', 'image', 'file'
    fileUrl: fileData ? fileData.url : null,
    fileName: fileData ? fileData.name : null,
    fileSize: fileData ? fileData.size : null,
    createdAt: new Date()
  };
  data.messages.push(newMessage);
  writeData(data);
  return newMessage;
}

// Get direct messages between two users (e.g. room ID is dm_userA_userB alphabetically)
function getDmRoomId(userAId, userBId) {
  const sortedIds = [userAId, userBId].sort();
  return `dm_${sortedIds[0]}_${sortedIds[1]}`;
}

function getDirectMessages(userAId, userBId) {
  const dmRoomId = getDmRoomId(userAId, userBId);
  return getMessages(dmRoomId);
}

function saveDirectMessage(senderId, senderName, receiverId, content, type = 'text', fileData = null) {
  const dmRoomId = getDmRoomId(senderId, receiverId);
  return saveMessage(dmRoomId, senderId, senderName, content, type, fileData);
}

module.exports = {
  getUserByUsername,
  getUserById,
  createUser,
  getRooms,
  getRoomById,
  createRoom,
  getMessages,
  saveMessage,
  getDmRoomId,
  getDirectMessages,
  saveDirectMessage
};
