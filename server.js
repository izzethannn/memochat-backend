const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Security and middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow for WebRTC
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

// Enhanced rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});
app.use(limiter);

// Chat message rate limiting
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 messages per minute
    message: 'Too many messages. Please slow down.',
    skipSuccessfulRequests: true
});

app.use(express.json());
app.use(express.static('public'));

// Socket.IO setup with CORS
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Data structures to manage rooms and users
const rooms = new Map();
const users = new Map();
const roomPasswords = new Map(); // Store room passwords
const userMessageHistory = new Map(); // Track user message history for spam protection

// Room management
class Room {
    constructor(name, password = null) {
        this.name = name;
        this.users = new Map();
        this.createdAt = new Date();
        this.messages = [];
        this.maxMessages = 100;
        this.password = password;
        this.isPasswordProtected = !!password;
    }

    addUser(user) {
        this.users.set(user.id, user);
        console.log(`User ${user.username} joined room ${this.name}`);
        return Array.from(this.users.values());
    }

    removeUser(userId) {
        const user = this.users.get(userId);
        this.users.delete(userId);
        if (user) {
            console.log(`User ${user.username} left room ${this.name}`);
        }
        return user;
    }

    addMessage(message) {
        this.messages.push({
            ...message,
            timestamp: new Date()
        });
        
        // Keep only last maxMessages
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
    }

    getUsers() {
        return Array.from(this.users.values());
    }

    isEmpty() {
        return this.users.size === 0;
    }

    verifyPassword(password) {
        if (!this.isPasswordProtected) return true;
        return this.password === password;
    }
}

// User management
class User {
    constructor(id, username, socketId) {
        this.id = id;
        this.username = username;
        this.socketId = socketId;
        this.room = null;
        this.isMuted = false;
        this.isScreenSharing = false;
        this.isInCall = false;
        this.callPartner = null;
        this.joinedAt = new Date();
        this.messageCount = 0;
        this.lastMessageTime = 0;
        this.screenShareStartTime = null;
    }
}

// Spam protection functions
function checkSpam(userId, socketId) {
    const now = Date.now();
    const userHistory = userMessageHistory.get(socketId) || { messages: [], lastReset: now };
    
    // Reset counter every minute
    if (now - userHistory.lastReset > 60000) {
        userHistory.messages = [];
        userHistory.lastReset = now;
    }
    
    // Add current message
    userHistory.messages.push(now);
    
    // Check if user is sending too many messages
    const recentMessages = userHistory.messages.filter(time => now - time < 60000);
    userHistory.messages = recentMessages;
    
    userMessageHistory.set(socketId, userHistory);
    
    // Allow max 20 messages per minute
    return recentMessages.length > 20;
}

function checkMessageSimilarity(message, userHistory) {
    const recentMessages = userHistory.messages || [];
    const similarCount = recentMessages.filter(msg => 
        msg.content && levenshteinDistance(msg.content.toLowerCase(), message.toLowerCase()) < 3
    ).length;
    
    return similarCount > 3; // Flag if 3+ similar messages
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// Utility functions
function sanitizeInput(input) {
    return input.replace(/[<>]/g, '').trim().substring(0, 500);
}

function isValidRoomName(roomName) {
    const validRooms = ['general', 'gaming', 'study', 'music', 'private'];
    return validRooms.includes(roomName) || /^custom_[a-zA-Z0-9_]+$/.test(roomName);
}

function isValidUsername(username) {
    return username && 
           username.length >= 2 && 
           username.length <= 20 && 
           /^[a-zA-Z0-9_\-\s]+$/.test(username);
}

function generateRoomId() {
    return 'custom_' + Math.random().toString(36).substr(2, 9);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Handle creating password-protected room
    socket.on('create-private-room', (data) => {
        try {
            const { username, password } = data;
            
            if (!isValidUsername(username)) {
                socket.emit('error', { message: 'Invalid username' });
                return;
            }
            
            if (!password || password.length < 4) {
                socket.emit('error', { message: 'Password must be at least 4 characters' });
                return;
            }
            
            const roomId = generateRoomId();
            const room = new Room(roomId, password);
            rooms.set(roomId, room);
            roomPasswords.set(roomId, password);
            
            socket.emit('private-room-created', {
                roomId: roomId,
                password: password
            });
            
            console.log(`Private room created: ${roomId}`);
            
        } catch (error) {
            console.error('Error creating private room:', error);
            socket.emit('error', { message: 'Failed to create private room' });
        }
    });
    
    // Handle user joining a room
    socket.on('join-room', async (data) => {
        try {
            const { userId, username, room, password } = data;
            
            // Validate input
            if (!userId || !username || !room) {
                socket.emit('error', { message: 'Missing required fields' });
                return;
            }
            
            if (!isValidUsername(username)) {
                socket.emit('error', { message: 'Invalid username' });
                return;
            }
            
            if (!isValidRoomName(room)) {
                socket.emit('error', { message: 'Invalid room name' });
                return;
            }
            
            const sanitizedUsername = sanitizeInput(username);
            
            // Create or get room
            if (!rooms.has(room)) {
                rooms.set(room, new Room(room));
            }
            const roomObj = rooms.get(room);
            
            // Check password if room is password protected
            if (roomObj.isPasswordProtected && !roomObj.verifyPassword(password)) {
                socket.emit('error', { message: 'Incorrect password' });
                return;
            }
            
            // Create user
            const user = new User(userId, sanitizedUsername, socket.id);
            user.room = room;
            
            // Add user to room and global users map
            users.set(socket.id, user);
            const roomUsers = roomObj.addUser(user);
            
            // Join socket room
            socket.join(room);
            
            // Notify user of successful join
            socket.emit('room-joined', {
                room: room,
                users: roomUsers,
                messages: roomObj.messages.slice(-20), // Send last 20 messages
                isPasswordProtected: roomObj.isPasswordProtected
            });
            
            // Notify other users in room
            socket.to(room).emit('user-joined', {
                userId: user.id,
                username: user.username,
                joinedAt: user.joinedAt
            });
            
            // Add system message
            const systemMessage = {
                id: Date.now(),
                username: 'System',
                message: `${sanitizedUsername} joined the room`,
                isSystem: true
            };
            roomObj.addMessage(systemMessage);
            
            // Broadcast system message
            io.to(room).emit('chat-message', systemMessage);
            
            console.log(`User ${sanitizedUsername} joined room ${room}`);
            
        } catch (error) {
            console.error('Error in join-room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    // Handle user leaving room
    socket.on('leave-room', (data) => {
        handleUserLeave(socket, data?.userId);
    });
    
    // Enhanced chat message handling with spam protection
    socket.on('chat-message', (data) => {
        try {
            const user = users.get(socket.id);
            if (!user || !user.room) {
                socket.emit('error', { message: 'Not in a room' });
                return;
            }
            
            const { message } = data;
            if (!message || message.trim().length === 0) {
                return;
            }
            
            // Check for spam
            if (checkSpam(user.id, socket.id)) {
                socket.emit('error', { message: 'You are sending messages too quickly. Please slow down.' });
                return;
            }
            
            const sanitizedMessage = sanitizeInput(message);
            
            // Check for message similarity (simple spam detection)
            const userHistory = userMessageHistory.get(socket.id) || { messages: [] };
            if (checkMessageSimilarity(sanitizedMessage, userHistory)) {
                socket.emit('error', { message: 'Please avoid sending repetitive messages.' });
                return;
            }
            
            // Store message in user history
            if (!userHistory.messages) userHistory.messages = [];
            userHistory.messages.push({ content: sanitizedMessage, time: Date.now() });
            userHistory.messages = userHistory.messages.slice(-10); // Keep last 10 messages
            userMessageHistory.set(socket.id, userHistory);
            
            const room = rooms.get(user.room);
            
            const chatMessage = {
                id: Date.now(),
                userId: user.id,
                username: user.username,
                message: sanitizedMessage,
                isSystem: false
            };
            
            room.addMessage(chatMessage);
            
            // Broadcast to all users in room
            io.to(user.room).emit('chat-message', chatMessage);
            
        } catch (error) {
            console.error('Error in chat-message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    
    // Enhanced WebRTC signaling for voice chat and screen sharing
    socket.on('webrtc-offer', (data) => {
        const { targetUserId, offer, callerId, isScreenShare } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            // Forward offer to specific user
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                console.log(`Forwarding ${isScreenShare ? 'screen share' : 'voice'} offer from ${user.username} to ${targetUser.username}`);
                
                io.to(targetUser.socketId).emit('webrtc-offer', {
                    offer: offer,
                    callerId: callerId,
                    callerName: user.username,
                    isScreenShare: isScreenShare || false
                });
            } else {
                console.warn(`Target user ${targetUserId} not found for WebRTC offer`);
            }
        }
    });

    socket.on('webrtc-answer', (data) => {
        const { targetUserId, answer, answererId, isScreenShare } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            // Forward answer to caller
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                console.log(`Forwarding ${isScreenShare ? 'screen share' : 'voice'} answer from ${user.username} to ${targetUser.username}`);
                
                io.to(targetUser.socketId).emit('webrtc-answer', {
                    answer: answer,
                    answererId: answererId,
                    answererName: user.username,
                    isScreenShare: isScreenShare || false
                });
            } else {
                console.warn(`Target user ${targetUserId} not found for WebRTC answer`);
            }
        }
    });

    socket.on('webrtc-ice-candidate', (data) => {
        const { targetUserId, candidate, senderId, isScreenShare } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            // Forward ICE candidate to target user
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                io.to(targetUser.socketId).emit('webrtc-ice-candidate', {
                    candidate: candidate,
                    senderId: senderId,
                    isScreenShare: isScreenShare || false
                });
            }
        }
    });

    // Enhanced screen share start handler
    socket.on('screen-share-start', (data) => {
        const user = users.get(socket.id);
        if (user && user.room) {
            user.isScreenSharing = true;
            user.screenShareStartTime = new Date();
            
            console.log(`${user.username} started screen sharing in room ${user.room}`);
            
            // Notify all users in room about screen share
            socket.to(user.room).emit('user-screen-share-start', {
                userId: user.id,
                username: user.username,
                roomName: user.room
            });
            
            // Also broadcast updated user status
            socket.to(user.room).emit('user-status-update', {
                userId: user.id,
                username: user.username,
                isMuted: user.isMuted,
                isScreenSharing: true,
                isInCall: user.isInCall
            });
            
            // Add system message to chat
            const room = rooms.get(user.room);
            if (room) {
                const systemMessage = {
                    id: Date.now(),
                    username: 'System',
                    message: `${user.username} started sharing their screen`,
                    isSystem: true
                };
                room.addMessage(systemMessage);
                io.to(user.room).emit('chat-message', systemMessage);
            }
        }
    });

    // Enhanced screen share stop handler
    socket.on('screen-share-stop', (data) => {
        const user = users.get(socket.id);
        if (user && user.room) {
            user.isScreenSharing = false;
            user.screenShareStartTime = null;
            
            console.log(`${user.username} stopped screen sharing in room ${user.room}`);
            
            // Notify all users in room about screen share stop
            socket.to(user.room).emit('user-screen-share-stop', {
                userId: user.id,
                username: user.username,
                roomName: user.room
            });
            
            // Also broadcast updated user status
            socket.to(user.room).emit('user-status-update', {
                userId: user.id,
                username: user.username,
                isMuted: user.isMuted,
                isScreenSharing: false,
                isInCall: user.isInCall
            });
            
            // Add system message to chat
            const room = rooms.get(user.room);
            if (room) {
                const systemMessage = {
                    id: Date.now(),
                    username: 'System',
                    message: `${user.username} stopped sharing their screen`,
                    isSystem: true
                };
                room.addMessage(systemMessage);
                io.to(user.room).emit('chat-message', systemMessage);
            }
        }
    });    

    // Handle when user wants to start voice call with someone
    socket.on('call-user', (data) => {
        const { targetUserId } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                io.to(targetUser.socketId).emit('incoming-call', {
                    callerId: user.id,
                    callerName: user.username
                });
                console.log(`${user.username} is calling ${targetUser.username}`);
            }
        }
    });

    // Handle call responses
    socket.on('call-response', (data) => {
        const { callerId, accepted } = data;
        const user = users.get(socket.id);
        
        if (user) {
            const callerUser = Array.from(users.values()).find(u => u.id === callerId);
            if (callerUser) {
                io.to(callerUser.socketId).emit('call-response', {
                    targetId: user.id,
                    targetName: user.username,
                    accepted: accepted
                });
                
                // Update call status for both users
                if (accepted) {
                    user.isInCall = true;
                    user.callPartner = callerId;
                    callerUser.isInCall = true;
                    callerUser.callPartner = user.id;
                    
                    // Notify room about call status change
                    updateUserCallStatus(user);
                    updateUserCallStatus(callerUser);
                }
                
                console.log(`${user.username} ${accepted ? 'accepted' : 'rejected'} call from ${callerUser.username}`);
            }
        }
    });

    // Handle ending calls
    socket.on('end-call', (data) => {
        const { targetUserId } = data;
        const user = users.get(socket.id);
        
        if (user) {
            // End call for both users
            endCallForUser(user);
            
            if (targetUserId) {
                const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
                if (targetUser) {
                    endCallForUser(targetUser);
                    io.to(targetUser.socketId).emit('call-ended', {
                        userId: user.id,
                        userName: user.username
                    });
                }
            }
        }
    });
    
    // Original WebRTC signaling (for backward compatibility)
    socket.on('offer', (data) => {
        const { targetUserId, offer } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            socket.to(user.room).emit('offer', {
                fromUserId: user.id,
                fromUsername: user.username,
                targetUserId,
                offer
            });
        }
    });
    
    socket.on('answer', (data) => {
        const { targetUserId, answer } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            socket.to(user.room).emit('answer', {
                fromUserId: user.id,
                fromUsername: user.username,
                targetUserId,
                answer
            });
        }
    });
    
    socket.on('ice-candidate', (data) => {
        const { targetUserId, candidate } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            socket.to(user.room).emit('ice-candidate', {
                fromUserId: user.id,
                targetUserId,
                candidate
            });
        }
    });
    
    // Handle user status updates
    socket.on('user-status', (data) => {
        const user = users.get(socket.id);
        if (!user || !user.room) return;
        
        const { isMuted, isScreenSharing } = data;
        user.isMuted = isMuted;
        user.isScreenSharing = isScreenSharing;
        
        // Broadcast status update to room
        socket.to(user.room).emit('user-status-update', {
            userId: user.id,
            username: user.username,
            isMuted,
            isScreenSharing,
            isInCall: user.isInCall
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleUserLeave(socket);
        // Clean up user message history
        userMessageHistory.delete(socket.id);
    });
});

// Helper function to end call for a user
function endCallForUser(user) {
    if (user.isInCall) {
        user.isInCall = false;
        user.callPartner = null;
        updateUserCallStatus(user);
    }
}

// Helper function to update user call status in room
function updateUserCallStatus(user) {
    if (user.room) {
        io.to(user.room).emit('user-status-update', {
            userId: user.id,
            username: user.username,
            isMuted: user.isMuted,
            isScreenSharing: user.isScreenSharing,
            isInCall: user.isInCall
        });
    }
}

// Enhanced helper function to handle user leaving
function handleUserLeave(socket, userId = null) {
    const user = users.get(socket.id);
    if (!user) return;
    
    // If user was screen sharing, notify others
    if (user.isScreenSharing) {
        console.log(`User ${user.username} disconnected while screen sharing`);
        
        socket.to(user.room).emit('user-screen-share-stop', {
            userId: user.id,
            username: user.username,
            disconnected: true
        });
        
        // Add system message
        const room = rooms.get(user.room);
        if (room) {
            const systemMessage = {
                id: Date.now(),
                username: 'System',
                message: `${user.username} stopped sharing (disconnected)`,
                isSystem: true
            };
            room.addMessage(systemMessage);
            socket.to(user.room).emit('chat-message', systemMessage);
        }
    }
    
    // End any active calls
    if (user.isInCall && user.callPartner) {
        const partnerUser = Array.from(users.values()).find(u => u.id === user.callPartner);
        if (partnerUser) {
            endCallForUser(partnerUser);
            io.to(partnerUser.socketId).emit('call-ended', {
                userId: user.id,
                userName: user.username
            });
        }
    }
    
    const roomName = user.room;
    if (roomName && rooms.has(roomName)) {
        const room = rooms.get(roomName);
        room.removeUser(user.id);
        
        // Notify other users
        socket.to(roomName).emit('user-left', {
            userId: user.id,
            username: user.username
        });
        
        // Broadcast user disconnected for WebRTC cleanup
        socket.to(roomName).emit('user-disconnected', {
            userId: user.id
        });
        
        // Add system message
        const systemMessage = {
            id: Date.now(),
            username: 'System',
            message: `${user.username} left the room`,
            isSystem: true
        };
        room.addMessage(systemMessage);
        
        // Broadcast system message
        socket.to(roomName).emit('chat-message', systemMessage);
        
        // Remove empty rooms (except for persistent rooms)
        if (room.isEmpty() && !['general', 'gaming', 'study', 'music', 'private'].includes(roomName)) {
            rooms.delete(roomName);
            roomPasswords.delete(roomName);
            console.log(`Deleted empty room: ${roomName}`);
        }
    }
    
    // Remove user from global users map
    users.delete(socket.id);
}

// REST API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        users: users.size
    });
});

app.get('/api/rooms', (req, res) => {
    const roomStats = Array.from(rooms.entries()).map(([name, room]) => ({
        name,
        userCount: room.users.size,
        createdAt: room.createdAt,
        isPasswordProtected: room.isPasswordProtected
    }));
    
    res.json({
        rooms: roomStats,
        totalUsers: users.size
    });
});

app.get('/api/room/:roomName', (req, res) => {
    const { roomName } = req.params;
    
    if (!isValidRoomName(roomName)) {
        return res.status(400).json({ error: 'Invalid room name' });
    }
    
    const room = rooms.get(roomName);
    if (!room) {
        return res.json({
            name: roomName,
            userCount: 0,
            users: [],
            exists: false
        });
    }
    
    res.json({
        name: roomName,
        userCount: room.users.size,
        users: room.getUsers().map(user => ({
            id: user.id,
            username: user.username,
            joinedAt: user.joinedAt,
            isMuted: user.isMuted,
            isScreenSharing: user.isScreenSharing,
            isInCall: user.isInCall
        })),
        exists: true,
        createdAt: room.createdAt,
        isPasswordProtected: room.isPasswordProtected
    });
});

// API endpoint to get room screen sharing status
app.get('/api/room/:roomName/screenshare', (req, res) => {
    const { roomName } = req.params;
    
    if (!isValidRoomName(roomName)) {
        return res.status(400).json({ error: 'Invalid room name' });
    }
    
    const room = rooms.get(roomName);
    if (!room) {
        return res.json({
            room: roomName,
            screenSharingSessions: [],
            totalSessions: 0
        });
    }
    
    const screenSharingSessions = room.getUsers()
        .filter(user => user.isScreenSharing)
        .map(user => ({
            userId: user.id,
            username: user.username,
            startTime: user.screenShareStartTime || null
        }));
    
    res.json({
        room: roomName,
        screenSharingSessions,
        totalSessions: screenSharingSessions.length
    });
});

// Debug endpoint for troubleshooting
app.get('/api/debug/webrtc', (req, res) => {
    const debugInfo = {
        totalUsers: users.size,
        totalRooms: rooms.size,
        usersScreenSharing: Array.from(users.values())
            .filter(u => u.isScreenSharing)
            .map(u => ({ username: u.username, room: u.room })),
        roomsWithScreenShare: Array.from(rooms.entries())
            .filter(([name, room]) => room.getUsers().some(u => u.isScreenSharing))
            .map(([name, room]) => ({
                roomName: name,
                usersSharingScreen: room.getUsers()
                    .filter(u => u.isScreenSharing)
                    .map(u => u.username)
            }))
    };
    
    res.json(debugInfo);
});

// Serve the frontend HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Cleanup function for graceful shutdown
function cleanup() {
    console.log('Server shutting down...');
    
    // Notify all connected users
    io.emit('server-shutdown', { message: 'Server is restarting. Please refresh the page.' });
    
    // Close all connections
    io.close();
    server.close();
}

// Handle graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Periodic cleanup of empty rooms and old messages - COMPLETE FUNCTION
setInterval(() => {
    let cleaned = 0;
    for (const [roomName, room] of rooms.entries()) {
        // Remove empty non-persistent rooms older than 1 hour
        if (room.isEmpty() && 
            !['general', 'gaming', 'study', 'music', 'private'].includes(roomName) &&
            Date.now() - room.createdAt.getTime() > 3600000) {
            rooms.delete(roomName);
            roomPasswords.delete(roomName);
            cleaned++;
        }
    }
    
    // Clean up old message histories
    for (const [socketId, history] of userMessageHistory.entries()) {
        if (Date.now() - history.lastReset > 3600000) { // 1 hour old
            userMessageHistory.delete(socketId);
        }
    }
    
    if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} empty rooms`);
    }
}, 300000); // Run every 5 minutes

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`📝 MemoChat Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
