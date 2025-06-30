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

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});
app.use(limiter);

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

// Room management
class Room {
    constructor(name) {
        this.name = name;
        this.users = new Map();
        this.createdAt = new Date();
        this.messages = [];
        this.maxMessages = 100;
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
    }
}

// Utility functions
function sanitizeInput(input) {
    return input.replace(/[<>]/g, '').trim().substring(0, 500);
}

function isValidRoomName(roomName) {
    const validRooms = ['general', 'gaming', 'study', 'music', 'private'];
    return validRooms.includes(roomName);
}

function isValidUsername(username) {
    return username && 
           username.length >= 2 && 
           username.length <= 20 && 
           /^[a-zA-Z0-9_\-\s]+$/.test(username);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Handle user joining a room
    socket.on('join-room', async (data) => {
        try {
            const { userId, username, room } = data;
            
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
                messages: roomObj.messages.slice(-20) // Send last 20 messages
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
    
    // Handle chat messages
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
            
            const sanitizedMessage = sanitizeInput(message);
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
    
    // Enhanced WebRTC signaling for voice chat
    socket.on('webrtc-offer', (data) => {
        const { targetUserId, offer, callerId } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            // Forward offer to specific user
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                io.to(targetUser.socketId).emit('webrtc-offer', {
                    offer: offer,
                    callerId: callerId,
                    callerName: user.username
                });
                console.log(`WebRTC offer from ${user.username} to ${targetUser.username}`);
            }
        }
    });

    socket.on('webrtc-answer', (data) => {
        const { targetUserId, answer, answererId } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            // Forward answer to caller
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                io.to(targetUser.socketId).emit('webrtc-answer', {
                    answer: answer,
                    answererId: answererId,
                    answererName: user.username
                });
                console.log(`WebRTC answer from ${user.username} to ${targetUser.username}`);
            }
        }
    });

    socket.on('webrtc-ice-candidate', (data) => {
        const { targetUserId, candidate, senderId } = data;
        const user = users.get(socket.id);
        
        if (user && user.room) {
            // Forward ICE candidate to target user
            const targetUser = Array.from(users.values()).find(u => u.id === targetUserId);
            if (targetUser) {
                io.to(targetUser.socketId).emit('webrtc-ice-candidate', {
                    candidate: candidate,
                    senderId: senderId
                });
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

// Helper function to handle user leaving
function handleUserLeave(socket, userId = null) {
    const user = users.get(socket.id);
    if (!user) return;
    
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
        createdAt: room.createdAt
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
        createdAt: room.createdAt
    });
});

// Serve the frontend HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Periodic cleanup of empty rooms and old messages
setInterval(() => {
    let cleaned = 0;
    for (const [roomName, room] of rooms.entries()) {
        // Remove empty non-persistent rooms older than 1 hour
        if (room.isEmpty() && 
            !['general', 'gaming', 'study', 'music', 'private'].includes(roomName) &&
            Date.now() - room.createdAt.getTime() > 3600000) {
            rooms.delete(roomName);
            cleaned++;
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
