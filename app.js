// Global variables
let localStream = null;
let screenStream = null;
let socket = null;
let currentRoom = null;
let currentUser = null;
let isMuted = false;
let isScreenSharing = false;
let isMobileView = false;
let isInVoiceChat = false;
let inputVolumeLevel = 100;
let outputVolumeLevel = 100;
let createdRoomInfo = null;

// WebRTC variables for group voice chat
let peerConnections = {};
let screenPeerConnections = {};
let connectedUsers = new Set();
let lastMessageTime = 0;
let messageCount = 0;

// STUN servers for NAT traversal
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Handle room type change
function handleRoomChange() {
    const roomSelect = document.getElementById('roomSelect');
    const passwordInput = document.getElementById('passwordInput');
    const customRoomInput = document.getElementById('customRoomInput');
    const joinBtn = document.querySelector('.join-form .btn-primary');
    const createBtn = document.querySelector('.create-room-btn');
    const passwordSection = document.getElementById('passwordSection');
    
    if (roomSelect.value === 'custom') {
        passwordInput.style.display = 'block';
        customRoomInput.style.display = 'block';
        passwordInput.classList.remove('password-input');
        customRoomInput.classList.remove('password-input');
        joinBtn.textContent = 'Join Protected Room';
        createBtn.style.display = 'block';
        passwordSection.style.display = 'block';
    } else {
        passwordInput.style.display = 'none';
        customRoomInput.style.display = 'none';
        passwordInput.classList.add('password-input');
        customRoomInput.classList.add('password-input');
        joinBtn.textContent = 'Join Voice Chat';
        createBtn.style.display = 'none';
        passwordSection.style.display = 'none';
    }
}

// Create private room
async function createPrivateRoom() {
    const username = document.getElementById('privateUsername').value.trim() || 
                   document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('privatePassword').value.trim();

    if (!username) {
        showToast('Please enter your name');
        return;
    }

    if (!password || password.length < 4) {
        showToast('Password must be at least 4 characters');
        return;
    }

    socket.emit('create-private-room', {
        username: username,
        password: password
    });
}

// Copy room info
function copyRoomInfo() {
    if (createdRoomInfo) {
        const text = `MemoChat Room\nRoom ID: ${createdRoomInfo.roomId}\nPassword: ${createdRoomInfo.password}`;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Room info copied to clipboard!');
        }).catch(() => {
            showToast('Please copy manually: Room ID and Password shown above');
        });
    }
}

// Volume controls
function updateInputVolume(value) {
    inputVolumeLevel = value;
    document.getElementById('inputVolumeValue').textContent = value + '%';
    
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            // Note: Modern browsers don't support real-time volume adjustment
            // This is more of a visual indicator. Real implementation would need 
            // Web Audio API for live volume control
            console.log(`Input volume set to ${value}%`);
        }
    }
}

function updateOutputVolume(value) {
    outputVolumeLevel = value;
    document.getElementById('outputVolumeValue').textContent = value + '%';
    
    // Apply to all audio elements
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach(element => {
        element.volume = value / 100;
    });
}

// Mobile view management
function toggleMobileView() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const mobileNavText = document.getElementById('mobileNavText');
    
    if (window.innerWidth <= 767) {
        isMobileView = !isMobileView;
        
        if (isMobileView) {
            sidebar.classList.add('hidden');
            mainContent.classList.add('mobile-active');
            mobileNavText.textContent = 'Show Users';
        } else {
            sidebar.classList.remove('hidden');
            mainContent.classList.remove('mobile-active');
            mobileNavText.textContent = 'Show Chat';
        }
    }
}

// Show toast notification
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Spam protection
function checkSpamProtection() {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - lastMessageTime > 60000) {
        messageCount = 0;
    }
    
    // Check if too many messages in short time
    if (now - lastMessageTime < 2000 && messageCount > 5) {
        return false; // Spam detected
    }
    
    messageCount++;
    lastMessageTime = now;
    return true;
}

// Utility functions
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = `connection-status status-${status}`;
    
    switch (status) {
        case 'connected':
            statusEl.textContent = 'Connected';
            break;
        case 'connecting':
            statusEl.textContent = 'Connecting...';
            break;
        default:
            statusEl.textContent = 'Disconnected';
    }
}
// Initialize app and socket connection
async function initializeApp() {
    // Connect to the backend server
    socket = io('https://memochat-backend-production.up.railway.app', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
    });
    
    // Connection event handlers
    socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
        updateConnectionStatus('connected');
        showToast('Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus('disconnected');
        cleanupVoiceChat();
        showToast('Disconnected from server');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateConnectionStatus('disconnected');
        showToast('Connection error');
    });

    // Private room creation response
    socket.on('private-room-created', (data) => {
        createdRoomInfo = data;
        const roomIdDisplay = document.getElementById('roomIdDisplay');
        const roomIdText = document.getElementById('roomIdText');
        
        roomIdText.innerHTML = `<strong>Room ID:</strong> ${data.roomId}<br><strong>Password:</strong> ${data.password}`;
        roomIdDisplay.style.display = 'block';
        
        // Auto-fill the form
        document.getElementById('customRoomInput').value = data.roomId;
        document.getElementById('passwordInput').value = data.password;
        document.getElementById('roomSelect').value = 'custom';
        
        showToast('Private room created! Share the info with friends.');
    });

    // Room and user event handlers
    socket.on('room-joined', handleRoomJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('chat-message', handleChatMessage);
    socket.on('user-status-update', handleUserStatusUpdate);
    socket.on('user-screen-share-start', handleUserScreenShareStart);
    socket.on('user-screen-share-stop', handleUserScreenShareStop);
    
    // WebRTC signaling handlers for group voice
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
    socket.on('user-disconnected', handleUserDisconnected);
    
    // Error handling
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showToast(error.message || 'Connection error occurred');
        
        // Add error message to chat
        addChatMessage('System', error.message || 'An error occurred', true, true);
    });

    updateConnectionStatus('connecting');
}

// Join room function
async function joinRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const roomValue = document.getElementById('roomSelect').value;
    const password = document.getElementById('passwordInput').value.trim();
    const customRoom = document.getElementById('customRoomInput').value.trim();

    if (!username) {
        showToast('Please enter your name');
        return;
    }

    if (!roomValue) {
        showToast('Please select a room');
        return;
    }

    let finalRoom = roomValue;
    let finalPassword = null;

    if (roomValue === 'custom') {
        if (customRoom) {
            finalRoom = customRoom;
        } else {
            showToast('Please enter a custom room ID or create a new room');
            return;
        }
        
        if (!password) {
            showToast('Please enter the room password');
            return;
        }
        finalPassword = password;
    }

    try {
        updateConnectionStatus('connecting');
        
        // Get user media for group voice chat
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }, 
            video: false 
        });

        currentUser = {
            id: generateId(),
            name: username,
            room: finalRoom
        };
        currentRoom = finalRoom;

        socket.emit('join-room', {
            userId: currentUser.id,
            username: username,
            room: finalRoom,
            password: finalPassword
        });
        
    } catch (error) {
        console.error('Error joining room:', error);
        showToast('Could not access microphone. Please check permissions.');
        updateConnectionStatus('disconnected');
    }
}

// Handle room joined
function handleRoomJoined(data) {
    const roomNames = {
        'general': '🏠 General Chat',
        'gaming': '🎮 Gaming',
        'study': '📚 Study Group',
        'music': '🎵 Music & Chill',
        'private': '🔒 Private Room'
    };

    const roomName = roomNames[data.room] || `🔐 ${data.room}`;
    const lockIcon = data.isPasswordProtected ? '🔐 ' : '';

    document.getElementById('roomTitle').textContent = `Room: ${lockIcon}${roomName}`;
    document.getElementById('roomSubtitle').textContent = `${data.users.length} user(s) connected`;
    
    updateUsersList(data.users);
    
    // Clear chat and show message history
    clearChat();
    if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
            addChatMessage(msg.username, msg.message, msg.isSystem);
        });
    }
    
    // Start group voice chat
    startGroupVoiceChat(data.users);
    
    // Update UI
    document.getElementById('joinForm').style.display = 'none';
    document.getElementById('passwordSection').style.display = 'none';
    document.getElementById('roomIdDisplay').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('contentArea').style.display = 'flex';
    document.getElementById('voiceControls').style.display = 'block';
    document.getElementById('volumeControls').style.display = 'block';
    document.getElementById('micBtn').disabled = false;
    document.getElementById('screenBtn').disabled = false;
    document.getElementById('leaveBtn').disabled = false;

    // Show mobile nav on mobile devices
    if (window.innerWidth <= 767) {
        document.getElementById('mobileNav').style.display = 'block';
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('mainContent').classList.add('mobile-active');
        isMobileView = true;
    }

    playNotificationSound('join');
    updateConnectionStatus('connected');
    showToast('Joined voice channel!');
}

// Handle user events
function handleUserJoined(data) {
    console.log('User joined:', data);
    addChatMessage('System', `${data.username} joined the room`, true);
    playNotificationSound('join');
    showToast(`${data.username} joined`);
    
    // Update user count in subtitle
    const currentCount = document.getElementById('roomSubtitle').textContent;
    const newCount = parseInt(currentCount.match(/\d+/)[0]) + 1;
    document.getElementById('roomSubtitle').textContent = `${newCount} user(s) connected`;
    
    // Add user to the list
    addUserToList(data);
    
    // Connect to new user for voice chat
    if (isInVoiceChat) {
        connectToUser(data);
        if (isScreenSharing) {
            setupScreenShareConnection(data);
        }
    }
}

function handleUserLeft(data) {
    console.log('User left:', data);
    
    // Clean up voice connection
    if (peerConnections[data.userId]) {
        peerConnections[data.userId].close();
        delete peerConnections[data.userId];
    }
    
    // Clean up screen share connection
    if (screenPeerConnections[data.userId]) {
        screenPeerConnections[data.userId].close();
        delete screenPeerConnections[data.userId];
    }
    
    connectedUsers.delete(data.userId);
    removeVoiceElement(data.userId);
    removeScreenShareElement(`screen-${data.userId}`);
    
    // Remove user from list
    const userElement = document.getElementById(`user-${data.userId}`);
    if (userElement) {
        userElement.remove();
    }
    
    // Update user count
    const currentCount = document.getElementById('roomSubtitle').textContent;
    const newCount = Math.max(1, parseInt(currentCount.match(/\d+/)[0]) - 1);
    document.getElementById('roomSubtitle').textContent = `${newCount} user(s) connected`;
    
    addChatMessage('System', `${data.username} left the room`, true);
    playNotificationSound('leave');
    showToast(`${data.username} left`);
}

function handleUserStatusUpdate(data) {
    const { userId, username, isMuted, isScreenSharing, isInCall } = data;
    console.log(`${username} status: muted=${isMuted}, sharing=${isScreenSharing}`);
    updateUserStatus(userId, { isMuted, isScreenSharing, isInCall });
}

function handleUserScreenShareStart(data) {
    console.log(`${data.username} started screen sharing`);
    showToast(`${data.username} is sharing their screen`);
    
    // Set up screen share connection if not already done
    const user = findUserById(data.userId);
    if (user) {
        setupScreenShareConnection(user);
    }
}

function handleUserScreenShareStop(data) {
    console.log(`${data.username} stopped screen sharing`);
    showToast(`${data.username} stopped sharing`);
    removeScreenShareElement(`screen-${data.userId}`);
}
// WebRTC Voice Chat Functions
async function startGroupVoiceChat(users) {
    if (!localStream) return;
    
    isInVoiceChat = true;
    
    // Add yourself to the voice chat
    addVoiceElement('local', 'You', null, true);
    
    // Connect to all other users in the room
    for (const user of users) {
        if (user.id !== currentUser.id) {
            await connectToUser(user);
        }
    }
}

async function connectToUser(user) {
    if (peerConnections[user.id]) return; // Already connected
    
    try {
        console.log(`Connecting to ${user.username}...`);
        
        const peerConnection = new RTCPeerConnection(ICE_SERVERS);
        peerConnections[user.id] = peerConnection;
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            addVoiceElement(user.id, user.username, remoteStream, false);
            connectedUsers.add(user.id);
            console.log(`Now hearing ${user.username}`);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: user.id,
                    candidate: event.candidate,
                    senderId: currentUser.id
                });
            }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('webrtc-offer', {
            targetUserId: user.id,
            offer: offer,
            callerId: currentUser.id,
            isScreenShare: false
        });
        
    } catch (error) {
        console.error(`Error connecting to ${user.username}:`, error);
    }
}

// Enhanced screen sharing with WebRTC
async function setupScreenShareConnection(user) {
    if (screenPeerConnections[user.id]) return;
    
    try {
        console.log(`Setting up screen share connection to ${user.username}...`);
        
        const peerConnection = new RTCPeerConnection(ICE_SERVERS);
        screenPeerConnections[user.id] = peerConnection;
        
        // Add screen stream if sharing
        if (screenStream) {
            screenStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, screenStream);
            });
        }
        
        // Handle incoming screen stream
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            addScreenShareElement(`screen-${user.id}`, `${user.username}'s Screen`, remoteStream);
            console.log(`Receiving screen share from ${user.username}`);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: user.id,
                    candidate: event.candidate,
                    senderId: currentUser.id
                });
            }
        };
        
        // Create and send offer for screen share
        if (screenStream) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            socket.emit('webrtc-offer', {
                targetUserId: user.id,
                offer: offer,
                callerId: currentUser.id,
                isScreenShare: true
            });
        }
        
    } catch (error) {
        console.error(`Error setting up screen share with ${user.username}:`, error);
    }
}

// WebRTC Signal Handlers
async function handleWebRTCOffer(data) {
    try {
        console.log('Received WebRTC offer from:', data.callerId, 'Screen share:', data.isScreenShare);
        
        const { offer, callerId, isScreenShare } = data;
        const connections = isScreenShare ? screenPeerConnections : peerConnections;
        
        // Create peer connection
        const peerConnection = new RTCPeerConnection(ICE_SERVERS);
        connections[callerId] = peerConnection;
        
        // Add local stream (voice or screen)
        const streamToAdd = isScreenShare ? screenStream : localStream;
        if (streamToAdd) {
            streamToAdd.getTracks().forEach(track => {
                peerConnection.addTrack(track, streamToAdd);
            });
        }
        
        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            const user = findUserById(callerId);
            if (user) {
                if (isScreenShare) {
                    addScreenShareElement(`screen-${callerId}`, `${user.username}'s Screen`, remoteStream);
                } else {
                    addVoiceElement(callerId, user.username, remoteStream, false);
                    connectedUsers.add(callerId);
                }
                console.log(`Now ${isScreenShare ? 'seeing screen from' : 'hearing'} ${user.username}`);
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: callerId,
                    candidate: event.candidate,
                    senderId: currentUser.id
                });
            }
        };
        
        // Set remote description and create answer
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
            targetUserId: callerId,
            answer: answer,
            answererId: currentUser.id,
            isScreenShare: isScreenShare
        });
        
    } catch (error) {
        console.error('Error handling WebRTC offer:', error);
    }
}

async function handleWebRTCAnswer(data) {
    try {
        console.log('Received WebRTC answer from:', data.answererId, 'Screen share:', data.isScreenShare);
        
        const { answer, answererId, isScreenShare } = data;
        const connections = isScreenShare ? screenPeerConnections : peerConnections;
        const peerConnection = connections[answererId];
        
        if (peerConnection) {
            await peerConnection.setRemoteDescription(answer);
            console.log(`Connected to ${answererId} for ${isScreenShare ? 'screen share' : 'voice'}`);
        }
        
    } catch (error) {
        console.error('Error handling WebRTC answer:', error);
    }
}

async function handleWebRTCIceCandidate(data) {
    try {
        const { candidate, senderId } = data;
        
        // Try both voice and screen connections
        const voicePeer = peerConnections[senderId];
        const screenPeer = screenPeerConnections[senderId];
        
        if (voicePeer) {
            await voicePeer.addIceCandidate(candidate);
        }
        if (screenPeer) {
            await screenPeer.addIceCandidate(candidate);
        }
        
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

function handleUserDisconnected(data) {
    const { userId } = data;
    
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    
    if (screenPeerConnections[userId]) {
        screenPeerConnections[userId].close();
        delete screenPeerConnections[userId];
    }
    
    connectedUsers.delete(userId);
    removeVoiceElement(userId);
    removeScreenShareElement(`screen-${userId}`);
}

function findUserById(userId) {
    const userElement = document.getElementById(`user-${userId}`);
    if (userElement) {
        const userName = userElement.querySelector('.user-name').textContent;
        return { id: userId, username: userName };
    }
    return null;
}

function cleanupVoiceChat() {
    // Close all peer connections
    Object.keys(peerConnections).forEach(userId => {
        peerConnections[userId].close();
        removeVoiceElement(userId);
    });
    
    Object.keys(screenPeerConnections).forEach(userId => {
        screenPeerConnections[userId].close();
        removeScreenShareElement(`screen-${userId}`);
    });
    
    peerConnections = {};
    screenPeerConnections = {};
    connectedUsers.clear();
    isInVoiceChat = false;
}
// UI Control Functions
function toggleMic() {
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isMuted = !isMuted;
        audioTrack.enabled = !isMuted;
        
        const micBtn = document.getElementById('micBtn');
        if (isMuted) {
            micBtn.textContent = '🔇 Muted';
            micBtn.className = 'btn btn-danger';
            playNotificationSound('muted');
            showToast('Microphone muted');
        } else {
            micBtn.textContent = '🎤 Mic';
            micBtn.className = 'btn btn-success';
            playNotificationSound('unmuted');
            showToast('Microphone unmuted');
        }

        // Notify server of status change
        if (socket && currentUser) {
            socket.emit('user-status', {
                isMuted: isMuted,
                isScreenSharing: isScreenSharing
            });
        }
    }
}

// STEP 1: Enhanced Screen Share Implementation
// Add this to your app.js to replace the existing toggleScreenShare function

async function toggleScreenShare() {
    console.log('Toggle screen share clicked, current state:', isScreenSharing);
    
    try {
        if (!isScreenSharing) {
            console.log('Starting screen share...');
            
            // Request screen share with specific constraints
            screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: {
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 15, max: 30 } // Lower framerate for better performance
                }, 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            
            console.log('Screen stream obtained:', screenStream);
            
            // Add your own screen to the UI immediately
            addScreenShareElement('screen-local', 'Your Screen Share', screenStream);
            
            // Update button state
            const screenBtn = document.getElementById('screenBtn');
            screenBtn.textContent = '⏹️ Stop Share';
            screenBtn.className = 'btn btn-danger';
            isScreenSharing = true;
            
            // Play notification
            playNotificationSound('screen_start');
            showToast('Screen sharing started');

            console.log('Notifying server about screen share start...');
            // Notify server that you started screen sharing
            if (socket && currentUser) {
                socket.emit('screen-share-start', {
                    userId: currentUser.id,
                    username: currentUser.name
                });
            }

            // Set up WebRTC connections for screen sharing with all connected users
            console.log('Setting up screen share connections with users:', Object.keys(peerConnections));
            
            for (const userId in peerConnections) {
                await setupScreenShareWithUser(userId);
            }

            // Handle when user stops sharing (X button or ESC)
            screenStream.getVideoTracks()[0].onended = () => {
                console.log('Screen share ended by user');
                stopScreenShare();
            };

            // Update user status
            socket.emit('user-status', {
                isMuted: isMuted,
                isScreenSharing: true
            });

        } else {
            console.log('Stopping screen share...');
            stopScreenShare();
        }
    } catch (error) {
        console.error('Error with screen sharing:', error);
        
        if (error.name === 'NotAllowedError') {
            showToast('Screen sharing permission denied');
        } else if (error.name === 'NotSupportedError') {
            showToast('Screen sharing not supported on this browser');
        } else {
            showToast('Could not start screen sharing: ' + error.message);
        }
        
        playNotificationSound('error');
        
        // Reset button state on error
        const screenBtn = document.getElementById('screenBtn');
        screenBtn.textContent = '📺 Screen';
        screenBtn.className = 'btn btn-primary';
        isScreenSharing = false;
    }
}

// STEP 2: Enhanced Screen Share WebRTC Setup
async function setupScreenShareWithUser(userId) {
    if (!screenStream) {
        console.log('No screen stream available for user:', userId);
        return;
    }

    console.log('Setting up screen share connection with user:', userId);

    try {
        // Create a new peer connection specifically for screen sharing
        const screenPeerConnection = new RTCPeerConnection(ICE_SERVERS);
        screenPeerConnections[userId] = screenPeerConnection;

        // Add screen stream tracks to the connection
        screenStream.getTracks().forEach(track => {
            console.log('Adding screen track to peer connection:', track.kind);
            screenPeerConnection.addTrack(track, screenStream);
        });

        // Handle incoming screen stream from remote user
        screenPeerConnection.ontrack = (event) => {
            console.log('Received screen track from user:', userId);
            const [remoteScreenStream] = event.streams;
            
            // Find user info
            const user = findUserById(userId);
            const userName = user ? user.username : `User ${userId}`;
            
            // Display the remote screen share
            addScreenShareElement(`screen-${userId}`, `${userName}'s Screen`, remoteScreenStream);
        };

        // Handle ICE candidates for screen sharing
        screenPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending screen share ICE candidate to:', userId);
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: userId,
                    candidate: event.candidate,
                    senderId: currentUser.id,
                    isScreenShare: true
                });
            }
        };

        // Create and send offer for screen sharing
        const offer = await screenPeerConnection.createOffer();
        await screenPeerConnection.setLocalDescription(offer);

        console.log('Sending screen share offer to user:', userId);
        socket.emit('webrtc-offer', {
            targetUserId: userId,
            offer: offer,
            callerId: currentUser.id,
            isScreenShare: true
        });

    } catch (error) {
        console.error('Error setting up screen share with user:', userId, error);
    }
}

// STEP 3: Enhanced Stop Screen Share
function stopScreenShare() {
    console.log('Stopping screen share...');
    
    if (screenStream) {
        // Stop all tracks
        screenStream.getTracks().forEach(track => {
            console.log('Stopping screen track:', track.kind);
            track.stop();
        });
        screenStream = null;
    }
    
    // Close all screen share peer connections
    Object.keys(screenPeerConnections).forEach(userId => {
        console.log('Closing screen share connection with:', userId);
        screenPeerConnections[userId].close();
        delete screenPeerConnections[userId];
    });
    
    // Remove your screen share from UI
    removeScreenShareElement('screen-local');
    
    // Reset button
    const screenBtn = document.getElementById('screenBtn');
    screenBtn.textContent = '📺 Screen';
    screenBtn.className = 'btn btn-primary';
    isScreenSharing = false;
    
    // Notifications
    playNotificationSound('screen_stop');
    showToast('Screen sharing stopped');

    // Notify server
    if (socket && currentUser) {
        socket.emit('screen-share-stop', {
            userId: currentUser.id,
            username: currentUser.name
        });

        socket.emit('user-status', {
            isMuted: isMuted,
            isScreenSharing: false
        });
    }
}

// STEP 4: Enhanced Screen Share Element Creation
function addScreenShareElement(id, label, stream) {
    console.log('Adding screen share element:', id, label);
    
    const videoGrid = document.getElementById('videoGrid');

    // Remove existing screen share if any
    removeScreenShareElement(id);

    const container = document.createElement('div');
    container.className = 'video-container screen-share-container';
    container.id = `video-${id}`;
    container.style.minHeight = '300px'; // Ensure reasonable size

    const video = document.createElement('video');
    video.className = 'video-element';
    video.autoplay = true;
    video.muted = true; // Prevent feedback
    video.playsInline = true; // Important for mobile
    video.controls = false;
    
    // Apply volume setting
    video.volume = outputVolumeLevel / 100;
    
    if (stream) {
        video.srcObject = stream;
        
        // Debug: Log when video starts playing
        video.onloadedmetadata = () => {
            console.log('Screen share video loaded:', {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration
            });
        };
        
        video.onplay = () => {
            console.log('Screen share video started playing');
        };
        
        video.onerror = (error) => {
            console.error('Screen share video error:', error);
        };
    }

    // Create container content
    container.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; min-height: 250px;">
            ${video.outerHTML}
            <div class="video-label" style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 4px; color: white; font-size: 12px;">
                📺 ${label}
            </div>
        </div>
    `;

    videoGrid.appendChild(container);
    
    // Get the actual video element from the container
    const actualVideo = container.querySelector('video');
    if (stream && actualVideo) {
        actualVideo.srcObject = stream;
    }

    showToast(`Screen sharing: ${label}`);
}

// STEP 5: Debug Function - Add this to test screen sharing
function debugScreenShare() {
    console.log('=== SCREEN SHARE DEBUG INFO ===');
    console.log('isScreenSharing:', isScreenSharing);
    console.log('screenStream:', screenStream);
    console.log('screenPeerConnections:', screenPeerConnections);
    console.log('Browser supports getDisplayMedia:', !!navigator.mediaDevices?.getDisplayMedia);
    console.log('Current user:', currentUser);
    console.log('Socket connected:', socket?.connected);
    console.log('Peer connections:', Object.keys(peerConnections));
    
    // Test browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.error('❌ getDisplayMedia not supported');
        showToast('Screen sharing not supported in this browser');
        return false;
    }
    
    console.log('✅ Browser supports screen sharing');
    return true;
}

// STEP 6: Enhanced WebRTC Offer Handler for Screen Sharing
async function handleWebRTCOfferEnhanced(data) {
    try {
        console.log('Received WebRTC offer:', {
            from: data.callerId,
            isScreenShare: data.isScreenShare,
            callerName: data.callerName
        });
        
        const { offer, callerId, isScreenShare, callerName } = data;
        
        // Choose the right connection map
        const connections = isScreenShare ? screenPeerConnections : peerConnections;
        
        // Create peer connection
        const peerConnection = new RTCPeerConnection(ICE_SERVERS);
        connections[callerId] = peerConnection;
        
        // Add local stream (voice or screen)
        const streamToAdd = isScreenShare ? screenStream : localStream;
        if (streamToAdd) {
            streamToAdd.getTracks().forEach(track => {
                console.log(`Adding ${isScreenShare ? 'screen' : 'voice'} track:`, track.kind);
                peerConnection.addTrack(track, streamToAdd);
            });
        }
        
        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            console.log(`Received ${isScreenShare ? 'screen' : 'voice'} track from:`, callerName);
            const [remoteStream] = event.streams;
            
            if (isScreenShare) {
                addScreenShareElement(`screen-${callerId}`, `${callerName}'s Screen`, remoteStream);
            } else {
                addVoiceElement(callerId, callerName, remoteStream, false);
                connectedUsers.add(callerId);
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: callerId,
                    candidate: event.candidate,
                    senderId: currentUser.id,
                    isScreenShare: isScreenShare
                });
            }
        };
        
        // Set remote description and create answer
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
            targetUserId: callerId,
            answer: answer,
            answererId: currentUser.id,
            isScreenShare: isScreenShare
        });
        
        console.log(`✅ ${isScreenShare ? 'Screen share' : 'Voice'} connection established with:`, callerName);
        
    } catch (error) {
        console.error('Error handling WebRTC offer:', error);
    }
}

// STEP 7: Browser Compatibility Check
function checkScreenShareSupport() {
    const support = {
        getDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
        webRTC: !!window.RTCPeerConnection,
        browser: getBrowserInfo()
    };
    
    console.log('Screen share support:', support);
    return support;
}

function getBrowserInfo() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
}

// Call this when page loads to check compatibility
document.addEventListener('DOMContentLoaded', () => {
    checkScreenShareSupport();
});

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    // Clean up screen share connections
    Object.keys(screenPeerConnections).forEach(userId => {
        screenPeerConnections[userId].close();
        delete screenPeerConnections[userId];
    });
    
    removeScreenShareElement('screen-local');
    
    document.getElementById('screenBtn').textContent = '📺 Screen';
    document.getElementById('screenBtn').className = 'btn btn-primary';
    isScreenSharing = false;
    playNotificationSound('screen_stop');
    showToast('Screen sharing stopped');

    // Notify server
    socket.emit('screen-share-stop', {});

    // Notify server of status change
    if (socket && currentUser) {
        socket.emit('user-status', {
            isMuted: isMuted,
            isScreenSharing: isScreenSharing
        });
    }
}

function leaveRoom() {
    if (currentUser && currentRoom) {
        socket.emit('leave-room', {
            userId: currentUser.id,
            room: currentRoom
        });
    }

    playNotificationSound('leave');
    showToast('Left the room');

    // Clean up streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    stopScreenShare();

    // Clean up voice chat
    cleanupVoiceChat();

    // Reset UI
    document.getElementById('joinForm').style.display = 'block';
    document.getElementById('welcomeScreen').style.display = 'block';
    document.getElementById('contentArea').style.display = 'none';
    document.getElementById('voiceControls').style.display = 'none';
    document.getElementById('volumeControls').style.display = 'none';
    document.getElementById('micBtn').disabled = true;
    document.getElementById('screenBtn').disabled = true;
    document.getElementById('leaveBtn').disabled = true;
    document.getElementById('roomTitle').textContent = 'Welcome to MemoChat';
    document.getElementById('roomSubtitle').textContent = 'Enter your name to get started';

    // Hide mobile nav
    document.getElementById('mobileNav').style.display = 'none';
    
    // Reset mobile view
    if (window.innerWidth <= 767) {
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('mainContent').classList.remove('mobile-active');
        isMobileView = false;
    }

    clearVideoGrid();
    clearUsersList();
    clearChat();
    updateConnectionStatus('connected');

    currentUser = null;
    currentRoom = null;
}

// Audio feedback system
function playNotificationSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const frequencies = {
            'join': [440, 554, 659],
            'leave': [659, 554, 440],
            'muted': [330],
            'unmuted': [440],
            'screen_start': [523, 659],
            'screen_stop': [659, 523],
            'message_sent': [880],
            'message_received': [660],
            'error': [220, 220, 220]
        };

        const freqs = frequencies[type] || [440];
        
        freqs.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            }, index * 100);
        });
    } catch (error) {
        console.log('Audio notification not available');
    }
}

// Element Management Functions
function addVoiceElement(userId, userName, stream, isLocal = false) {
    const videoGrid = document.getElementById('videoGrid');
    
    // Clear welcome message if this is the first user
    const welcomeMsg = videoGrid.querySelector('[style*="display: flex"]');
    if (welcomeMsg && welcomeMsg.style.display !== 'none') {
        welcomeMsg.style.display = 'none';
    }

    // Remove existing element if any
    removeVoiceElement(userId);

    const container = document.createElement('div');
    container.className = 'video-container';
    container.id = `voice-${userId}`;

    if (isLocal || !stream) {
        // Audio-only visualization
        container.innerHTML = `
            <div class="video-element" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2);">
                <div style="text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">${isLocal ? '🎤' : '🔊'}</div>
                    <div style="font-weight: 600; font-size: 14px;">${userName}</div>
                    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">${isLocal ? 'You' : 'Speaking'}</div>
                </div>
            </div>
            <div class="video-label">${userName}</div>
        `;
    } else {
        // Create hidden audio element for remote stream
        const audioElement = document.createElement('audio');
        audioElement.id = `audio-${userId}`;
        audioElement.srcObject = stream;
        audioElement.autoplay = true;
        audioElement.volume = outputVolumeLevel / 100;
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);

        // Visual representation
        container.innerHTML = `
            <div class="video-element" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #43b581, #369968);">
                <div style="text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🔊</div>
                    <div style="font-weight: 600; font-size: 14px;">${userName}</div>
                    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Connected</div>
                </div>
            </div>
            <div class="video-label">${userName}</div>
        `;
    }

    videoGrid.appendChild(container);
}

function removeVoiceElement(userId) {
    const voiceElement = document.getElementById(`voice-${userId}`);
    if (voiceElement) {
        voiceElement.remove();
    }
    
    const audioElement = document.getElementById(`audio-${userId}`);
    if (audioElement) {
        audioElement.remove();
    }
}

function addScreenShareElement(id, label, stream) {
    const videoGrid = document.getElementById('videoGrid');

    // Remove existing screen share if any
    removeScreenShareElement(id);

    const container = document.createElement('div');
    container.className = 'video-container screen-share-container';
    container.id = `video-${id}`;

    const video = document.createElement('video');
    video.className = 'video-element';
    video.autoplay = true;
    video.muted = true;
    video.volume = outputVolumeLevel / 100;
    if (stream) video.srcObject = stream;

    container.appendChild(video);
    container.innerHTML += `<div class="video-label">📺 ${label}</div>`;

    videoGrid.appendChild(container);

    showToast(`Screen sharing: ${label}`);
}

function removeScreenShareElement(id) {
    const screenElement = document.getElementById(`video-${id}`);
    if (screenElement) {
        screenElement.remove();
    }
}

// Apply volume settings to new audio elements
function applyVolumeSettings() {
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach(element => {
        element.volume = outputVolumeLevel / 100;
    });
}

// Periodically apply volume settings to ensure all elements have correct volume
setInterval(applyVolumeSettings, 1000);
// Chat Functions
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message || !currentUser || !socket) return;

    // Spam protection
    if (!checkSpamProtection()) {
        addChatMessage('System', 'You are sending messages too quickly. Please slow down.', true, true);
        return;
    }

    socket.emit('chat-message', {
        message: message
    });

    chatInput.value = '';
}

function handleChatMessage(data) {
    const { username, message, isSystem } = data;
    addChatMessage(username, message, isSystem);
    
    // Play sound only for messages from others
    if (currentUser && data.userId !== currentUser.id) {
        playNotificationSound('message_received');
    }
}

function addChatMessage(author, content, isSystem = false, isError = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    if (isError) {
        messageDiv.className = 'message error-message';
    } else {
        messageDiv.className = isSystem ? 'message system-message' : 'message';
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-author">
            ${author}
            <span class="message-time">${timeString}</span>
        </div>
        <div class="message-content">${escapeHtml(content)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Remove old messages if too many (keep last 100)
    while (chatMessages.children.length > 100) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message system-message">
            <div class="message-author">System</div>
            <div class="message-content">Welcome! Join a room to start chatting.</div>
        </div>
    `;
}

// User Management Functions
function addUserToList(userData) {
    const usersList = document.getElementById('usersList');
    
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = userData.userId;
    userItem.id = `user-${userData.userId}`;
    
    userItem.innerHTML = `
        <div class="user-avatar">${userData.username[0].toUpperCase()}</div>
        <div class="user-info">
            <div class="user-name">${userData.username}</div>
            <div class="user-status">Voice connected</div>
        </div>
        <div class="status-indicator status-online"></div>
    `;
    
    usersList.appendChild(userItem);
}

function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.userId = user.id;
        userItem.id = `user-${user.id}`;
        
        userItem.innerHTML = `
            <div class="user-avatar">${user.username[0].toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${user.username}${user.id === currentUser.id ? ' (You)' : ''}</div>
                <div class="user-status">Voice connected</div>
            </div>
            <div class="status-indicator status-online"></div>
        `;
        usersList.appendChild(userItem);
    });
}

function clearUsersList() {
    document.getElementById('usersList').innerHTML = `
        <div style="text-align: center; opacity: 0.6; margin-top: 30px;">
            Join a room to see other users
        </div>
    `;
}

function updateUserStatus(userId, status) {
    const userElement = document.getElementById(`user-${userId}`);
    if (!userElement) return;
    
    const statusIndicator = userElement.querySelector('.status-indicator');
    const userStatus = userElement.querySelector('.user-status');
    
    if (status.isMuted) {
        statusIndicator.className = 'status-indicator status-muted';
        userStatus.textContent = 'Muted';
    } else if (status.isScreenSharing) {
        statusIndicator.className = 'status-indicator status-speaking';
        userStatus.textContent = 'Sharing screen';
    } else {
        statusIndicator.className = 'status-indicator status-online';
        userStatus.textContent = 'Voice connected';
    }
}

function clearVideoGrid() {
    const videoGrid = document.getElementById('videoGrid');
    videoGrid.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 200px; opacity: 0.6;">
            <div style="text-align: center;">
                <h3 style="font-size: 16px; margin-bottom: 10px;">🎙️ Group Voice Chat Ready</h3>
                <p style="font-size: 13px;">Join a room to start talking with friends</p>
                <p style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                    ✨ Enhanced Features: Volume controls, Password protection, Spam protection
                </p>
            </div>
        </div>
    `;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);

// Handle enter key in inputs
document.getElementById('usernameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') joinRoom();
});

document.addEventListener('keypress', function(e) {
    if (e.target.id === 'chatInput' && e.key === 'Enter') {
        sendMessage();
    }
    if (e.target.id === 'privateUsername' && e.key === 'Enter') {
        createPrivateRoom();
    }
    if (e.target.id === 'privatePassword' && e.key === 'Enter') {
        createPrivateRoom();
    }
    if (e.target.id === 'passwordInput' && e.key === 'Enter') {
        joinRoom();
    }
});

// Handle window resize for mobile responsiveness
window.addEventListener('resize', function() {
    if (window.innerWidth > 767) {
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('mainContent').classList.remove('mobile-active');
        document.getElementById('mobileNav').style.display = 'none';
        isMobileView = false;
    } else if (currentUser) {
        document.getElementById('mobileNav').style.display = 'block';
        if (!isMobileView) {
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('mainContent').classList.add('mobile-active');
            isMobileView = true;
        }
    }
});
