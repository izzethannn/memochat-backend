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
let audioContext = null;
let gainNode = null;
let isLoggedIn = false;

// WebRTC variables for group voice chat
let peerConnections = {};
let screenPeerConnections = {};
let screenShareConnections = {}; // Separate connections for screen sharing
let connectedUsers = new Set();
let lastMessageTime = 0;
let messageCount = 0;

// ENHANCED ICE SERVERS with TURN servers for better connectivity
const ICE_SERVERS = {
    iceServers: [
        // STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // Free TURN servers for better connectivity
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    iceCandidatePoolSize: 10
};

// Login System Functions
function showLoginForm() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showToast('Please enter both username and password');
        return;
    }

    if (username.length < 3) {
        showToast('Username must be at least 3 characters');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters');
        return;
    }

    try {
        // Show loading state
        const loginBtn = document.getElementById('loginBtn');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        // Send login request to server
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Store auth token
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('username', username);
            
            isLoggedIn = true;
            currentUser = {
                id: data.userId,
                name: username,
                token: data.token
            };

            // Pre-fill username in main form
            document.getElementById('usernameInput').value = username;
            
            showMainApp();
            showToast('Login successful!');
            
            // Initialize socket connection after login
            await initializeApp();
        } else {
            showToast(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.');
    } finally {
        // Reset button state
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
    }
}

async function handleRegister() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showToast('Please enter both username and password');
        return;
    }

    if (username.length < 3) {
        showToast('Username must be at least 3 characters');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters');
        return;
    }

    try {
        // Show loading state
        const registerBtn = document.getElementById('registerBtn');
        const originalText = registerBtn.textContent;
        registerBtn.textContent = 'Creating account...';
        registerBtn.disabled = true;

        // Send register request to server
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Account created successfully! Please login.');
            // Auto-login after successful registration
            setTimeout(() => handleLogin(), 1000);
        } else {
            showToast(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.');
    } finally {
        // Reset button state
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.textContent = 'Create Account';
        registerBtn.disabled = false;
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    isLoggedIn = false;
    
    // Clean up current session
    if (currentRoom) {
        leaveRoom();
    }
    
    // Disconnect socket
    if (socket) {
        socket.disconnect();
    }
    
    currentUser = null;
    showLoginForm();
    showToast('Logged out successfully');
}

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        // Verify token with server
        fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                isLoggedIn = true;
                currentUser = {
                    id: data.userId,
                    name: username,
                    token: token
                };
                document.getElementById('usernameInput').value = username;
                showMainApp();
                initializeApp();
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('username');
                showLoginForm();
            }
        })
        .catch(() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            showLoginForm();
        });
    } else {
        showLoginForm();
    }
}

// FIXED: Initialize Web Audio Context for input volume control
async function initializeAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        if (localStream) {
            const source = audioContext.createMediaStreamSource(localStream);
            gainNode = audioContext.createGain();
            const destination = audioContext.createMediaStreamDestination();
            
            source.connect(gainNode);
            gainNode.connect(destination);
            
            // Replace the original stream with the processed one
            const audioTrack = destination.stream.getAudioTracks()[0];
            const videoTracks = localStream.getVideoTracks();
            
            // Create new stream with processed audio
            const processedStream = new MediaStream([audioTrack, ...videoTracks]);
            
            // Update all peer connections with the new stream
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                if (sender) {
                    sender.replaceTrack(audioTrack);
                }
            });
            
            localStream = processedStream;
            console.log('✅ Audio context initialized for input volume control');
        }
    } catch (error) {
        console.warn('⚠️ Could not initialize audio context:', error);
    }
}

// Helper function to process queued ICE candidates
async function processQueuedCandidates(peerConnection, senderId, isScreenShare) {
    if (!peerConnection.pendingIceCandidates || peerConnection.pendingIceCandidates.length === 0) {
        return;
    }
    
    console.log(`📦 Processing ${peerConnection.pendingIceCandidates.length} queued ICE candidates for ${senderId}`);
    
    const candidates = [...peerConnection.pendingIceCandidates];
    peerConnection.pendingIceCandidates = [];
    
    for (const candidate of candidates) {
        try {
            if (peerConnection.remoteDescription && peerConnection.signalingState !== 'closed') {
                await peerConnection.addIceCandidate(candidate);
                console.log(`✅ Added queued ${isScreenShare ? 'screen' : 'voice'} ICE candidate for ${senderId}`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to add queued ICE candidate for ${senderId}:`, error.message);
        }
    }
    
    // Clear timeout
    if (peerConnection.candidateTimeout) {
        clearTimeout(peerConnection.candidateTimeout);
        delete peerConnection.candidateTimeout;
    }
}

// FIXED ICE Candidate Handler with proper validation and queueing
async function handleWebRTCIceCandidate(data) {
    try {
        const { candidate, senderId, isScreenShare } = data;
        
        console.log(`🧊 Received ICE candidate from ${senderId} (${isScreenShare ? 'screen' : 'voice'})`);
        
        // Get the correct peer connection based on type
        let peerConnection = null;
        
        if (isScreenShare) {
            peerConnection = screenShareConnections[senderId] || screenPeerConnections[senderId];
        } else {
            peerConnection = peerConnections[senderId];
        }
        
        if (!peerConnection) {
            console.warn(`⚠️ No peer connection found for ICE candidate from ${senderId} (${isScreenShare ? 'screen' : 'voice'})`);
            return;
        }
        
        // CRITICAL: Check if the peer connection is in a valid state
        if (peerConnection.signalingState === 'closed') {
            console.warn(`⚠️ Peer connection is closed, ignoring ICE candidate from ${senderId}`);
            return;
        }
        
        // Check if remote description is set AND connection is stable
        if (peerConnection.remoteDescription && 
            (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-remote-offer')) {
            try {
                await peerConnection.addIceCandidate(candidate);
                console.log(`✅ Added ${isScreenShare ? 'screen share' : 'voice'} ICE candidate from ${senderId}`);
            } catch (error) {
                console.warn(`⚠️ Failed to add ICE candidate from ${senderId}:`, error.message);
                // Don't throw - this is expected during connection renegotiation
            }
        } else {
            console.warn(`⚠️ Remote description not ready for ${senderId}, queuing ICE candidate`);
            console.log(`Signaling state: ${peerConnection.signalingState}, Remote desc: ${!!peerConnection.remoteDescription}`);
            
            // Queue the candidate for later
            if (!peerConnection.pendingIceCandidates) {
                peerConnection.pendingIceCandidates = [];
            }
            peerConnection.pendingIceCandidates.push(candidate);
            
            // Set a timeout to process queued candidates if remote description takes too long
            if (!peerConnection.candidateTimeout) {
                peerConnection.candidateTimeout = setTimeout(() => {
                    console.log(`⏰ Timeout processing queued candidates for ${senderId}`);
                    processQueuedCandidates(peerConnection, senderId, isScreenShare);
                }, 5000);
            }
        }
        
    } catch (error) {
        console.error('❌ Error handling ICE candidate:', error);
        // Don't throw the error to prevent crashes
    }
}

// ENHANCED WebRTC Offer Handler with better error handling
async function handleWebRTCOffer(data) {
    try {
        console.log('📥 Received WebRTC offer:', {
            from: data.callerId,
            callerName: data.callerName,
            isScreenShare: data.isScreenShare
        });
        
        const { offer, callerId, isScreenShare, callerName } = data;
        
        // Check if we already have a connection for this user and type
        const existingConnection = isScreenShare ? 
            (screenShareConnections[callerId] || screenPeerConnections[callerId]) : 
            peerConnections[callerId];
            
        if (existingConnection) {
            console.log(`🔄 Closing existing ${isScreenShare ? 'screen' : 'voice'} connection for ${callerName}`);
            
            // Clean up existing connection properly
            existingConnection.close();
            
            // Clean up queued candidates and timeouts
            if (existingConnection.pendingIceCandidates) {
                delete existingConnection.pendingIceCandidates;
            }
            if (existingConnection.candidateTimeout) {
                clearTimeout(existingConnection.candidateTimeout);
                delete existingConnection.candidateTimeout;
            }
            
            // Remove from appropriate collection
            if (isScreenShare) {
                delete screenShareConnections[callerId];
                delete screenPeerConnections[callerId];
            } else {
                delete peerConnections[callerId];
            }
        }
        
        // Create new peer connection with enhanced configuration
        const peerConnection = new RTCPeerConnection({
            ...ICE_SERVERS,
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require'
        });
        
        // Store in appropriate connection object
        if (isScreenShare) {
            screenPeerConnections[callerId] = peerConnection;
            console.log(`📺 Created screen share receiver connection for ${callerName}`);
        } else {
            peerConnections[callerId] = peerConnection;
            console.log(`🎤 Created voice connection for ${callerName}`);
        }
        
        // Add local stream only if we have one and it's not screen share receive
        if (!isScreenShare && localStream) {
            localStream.getTracks().forEach(track => {
                console.log(`➕ Adding local ${track.kind} track`);
                peerConnection.addTrack(track, localStream);
            });
        }
        
        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            console.log(`📥 Received ${isScreenShare ? 'screen' : 'voice'} track from ${callerName}`);
            const [remoteStream] = event.streams;
            
            if (isScreenShare) {
                console.log('🖥️ Displaying remote screen share');
                // FIXED: Use unique IDs to prevent conflicts
                addScreenShareElement(`screen-${callerId}-${Date.now()}`, `${callerName}'s Screen`, remoteStream);
                
                // Verify the stream has video
                const videoTracks = remoteStream.getVideoTracks();
                console.log(`Screen share has ${videoTracks.length} video tracks`);
                videoTracks.forEach((track, i) => {
                    console.log(`Video track ${i}:`, {
                        enabled: track.enabled,
                        readyState: track.readyState
                    });
                });
            } else {
                console.log('🔊 Setting up voice connection');
                addVoiceElement(callerId, callerName, remoteStream, false);
                connectedUsers.add(callerId);
            }
        };
        
        // Handle ICE candidates with queueing
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: callerId,
                    candidate: event.candidate,
                    senderId: currentUser.id,
                    isScreenShare: isScreenShare
                });
            } else {
                console.log(`✅ ICE gathering complete for ${isScreenShare ? 'screen' : 'voice'} with ${callerName}`);
            }
        };
        
        // Enhanced connection state monitoring
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log(`🔄 ${isScreenShare ? 'Screen' : 'Voice'} connection state with ${callerName}:`, state);
            
            if (state === 'failed' || state === 'closed') {
                console.log(`💔 Connection ${state} with ${callerName}, cleaning up`);
                cleanupPeerConnection(peerConnection, callerId, isScreenShare);
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            console.log(`🧊 ICE connection state with ${callerName}:`, state);
            
            if (state === 'failed') {
                console.log(`❌ ICE connection failed with ${callerName}, attempting restart`);
                peerConnection.restartIce();
            }
        };
        
        // Set remote description and create answer
        await peerConnection.setRemoteDescription(offer);
        
        // Process any queued ICE candidates after setting remote description
        await processQueuedCandidates(peerConnection, callerId, isScreenShare);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
            targetUserId: callerId,
            answer: answer,
            answererId: currentUser.id,
            isScreenShare: isScreenShare
        });
        
        console.log(`✅ ${isScreenShare ? 'Screen share' : 'Voice'} answer sent to ${callerName}`);
        
    } catch (error) {
        console.error('❌ Error handling WebRTC offer:', error);
        showToast('Connection error occurred');
    }
}

// ENHANCED WebRTC Answer Handler
async function handleWebRTCAnswer(data) {
    try {
        console.log('📥 Received WebRTC answer:', {
            from: data.answererId,
            answererName: data.answererName,
            isScreenShare: data.isScreenShare
        });
        
        const { answer, answererId, isScreenShare, answererName } = data;
        
        // Get the correct peer connection
        const peerConnection = isScreenShare ? 
            screenShareConnections[answererId] || screenPeerConnections[answererId] : 
            peerConnections[answererId];
        
        if (peerConnection) {
            await peerConnection.setRemoteDescription(answer);
            
            // Process any queued ICE candidates after setting remote description
            await processQueuedCandidates(peerConnection, answererId, isScreenShare);
            
            console.log(`✅ ${isScreenShare ? 'Screen share' : 'Voice'} connection established with ${answererName}`);
        } else {
            console.error(`❌ No peer connection found for answer from ${answererId} (${isScreenShare ? 'screen' : 'voice'})`);
        }
        
    } catch (error) {
        console.error('❌ Error handling WebRTC answer:', error);
    }
}

// Helper function to clean up peer connections
function cleanupPeerConnection(peerConnection, userId, isScreenShare) {
    try {
        // Clear timeouts and queued candidates
        if (peerConnection.candidateTimeout) {
            clearTimeout(peerConnection.candidateTimeout);
            delete peerConnection.candidateTimeout;
        }
        if (peerConnection.pendingIceCandidates) {
            delete peerConnection.pendingIceCandidates;
        }
        
        // FIXED: Only remove specific screen share elements, not all
        if (isScreenShare) {
            // Remove all screen share elements for this user
            const elements = document.querySelectorAll(`[id^="video-screen-${userId}"]`);
            elements.forEach(el => el.remove());
        } else {
            removeVoiceElement(userId);
        }
        
        // Remove from connection objects
        if (isScreenShare) {
            delete screenShareConnections[userId];
            delete screenPeerConnections[userId];
        } else {
            delete peerConnections[userId];
        }
        
        connectedUsers.delete(userId);
        
    } catch (error) {
        console.error('Error cleaning up peer connection:', error);
    }
}

// ENHANCED Screen Share Setup with better connection handling
async function setupScreenShareWithUser(userId) {
    if (!screenStream) {
        console.log('❌ No screen stream available for user:', userId);
        return;
    }

    console.log('🔗 Setting up screen share connection with user:', userId);

    try {
        // Close any existing screen share connection
        if (screenShareConnections[userId]) {
            console.log('🔄 Closing existing screen share connection');
            cleanupPeerConnection(screenShareConnections[userId], userId, true);
        }
        
        // Create a completely separate peer connection for screen sharing
        const screenPeerConnection = new RTCPeerConnection({
            ...ICE_SERVERS,
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require'
        });
        
        // Store in separate object
        screenShareConnections[userId] = screenPeerConnection;

        // Add screen stream tracks to this connection
        screenStream.getTracks().forEach(track => {
            console.log(`➕ Adding screen ${track.kind} track to connection with ${userId}`);
            screenPeerConnection.addTrack(track, screenStream);
        });

        // Handle ICE candidates
        screenPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`🧊 Sending screen share ICE candidate to ${userId}`);
                socket.emit('webrtc-ice-candidate', {
                    targetUserId: userId,
                    candidate: event.candidate,
                    senderId: currentUser.id,
                    isScreenShare: true
                });
            } else {
                console.log(`✅ ICE gathering complete for screen share with ${userId}`);
            }
        };

        // Enhanced connection monitoring
        screenPeerConnection.onconnectionstatechange = () => {
            const state = screenPeerConnection.connectionState;
            console.log(`🔄 Screen share connection state with ${userId}:`, state);
            
            if (state === 'failed') {
                console.log(`❌ Screen share connection failed with ${userId}`);
                showToast('Screen share connection failed');
                cleanupPeerConnection(screenPeerConnection, userId, true);
            }
        };

        screenPeerConnection.oniceconnectionstatechange = () => {
            const state = screenPeerConnection.iceConnectionState;
            console.log(`🧊 Screen share ICE state with ${userId}:`, state);
            
            if (state === 'failed') {
                console.log(`❌ Screen share ICE failed with ${userId}, restarting`);
                screenPeerConnection.restartIce();
            }
        };

        // Create offer specifically for screen sharing
        console.log(`📤 Creating screen share offer for ${userId}`);
        const offer = await screenPeerConnection.createOffer({
            offerToReceiveVideo: false,
            offerToReceiveAudio: false
        });
        
        await screenPeerConnection.setLocalDescription(offer);

        // Send offer with screen share flag
        socket.emit('webrtc-offer', {
            targetUserId: userId,
            offer: offer,
            callerId: currentUser.id,
            isScreenShare: true
        });

        console.log(`✅ Screen share offer sent to ${userId}`);

    } catch (error) {
        console.error(`❌ Error setting up screen share with ${userId}:`, error);
        showToast('Failed to set up screen sharing connection');
    }
}

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

// FIXED: Volume controls with Web Audio API
function updateInputVolume(value) {
    inputVolumeLevel = value;
    document.getElementById('inputVolumeValue').textContent = value + '%';
    
    // Apply gain to the audio context if available
    if (gainNode) {
        gainNode.gain.setValueAtTime(value / 100, audioContext.currentTime);
        console.log(`🎤 Input volume set to ${value}%`);
    } else {
        console.log(`🎤 Input volume display set to ${value}% (Web Audio not available)`);
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
    
    console.log(`🔊 Output volume set to ${value}%`);
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
    if (!isLoggedIn) {
        console.log('User not logged in, skipping socket initialization');
        return;
    }

    // Connect to the backend server with auth token
    socket = io('https://memochat-backend-production.up.railway.app', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: {
            token: currentUser.token
        }
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
    
    // WebRTC signaling handlers
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
    socket.on('user-disconnected', handleUserDisconnected);
    
    // Error handling
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showToast(error.message || 'Connection error occurred');
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

        // Initialize audio context for input volume control
        await initializeAudioContext();

        // Update current user info
        currentUser.room = finalRoom;
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
            setTimeout(() => setupScreenShareWithUser(data.userId), 1000);
        }
    }
}

function handleUserLeft(data) {
    console.log('User left:', data);
    
    // Clean up voice connection
    if (peerConnections[data.userId]) {
        cleanupPeerConnection(peerConnections[data.userId], data.userId, false);
    }
    
    // Clean up screen share connections
    if (screenPeerConnections[data.userId]) {
        cleanupPeerConnection(screenPeerConnections[data.userId], data.userId, true);
    }
    
    if (screenShareConnections[data.userId]) {
        cleanupPeerConnection(screenShareConnections[data.userId], data.userId, true);
    }
    
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
}

function handleUserScreenShareStop(data) {
    console.log(`${data.username} stopped screen sharing`);
    showToast(`${data.username} stopped sharing`);
    // FIXED: Only remove screen shares from the specific user
    const elements = document.querySelectorAll(`[id^="video-screen-${data.userId}"]`);
    elements.forEach(el => el.remove());
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
        
        const peerConnection = new RTCPeerConnection({
            ...ICE_SERVERS,
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require'
        });
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
                    senderId: currentUser.id,
                    isScreenShare: false
                });
            }
        };
        
        // Enhanced connection state monitoring
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log(`🔄 Voice connection state with ${user.username}:`, state);
            
            if (state === 'failed' || state === 'closed') {
                console.log(`💔 Voice connection ${state} with ${user.username}, cleaning up`);
                cleanupPeerConnection(peerConnection, user.id, false);
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            console.log(`🧊 Voice ICE connection state with ${user.username}:`, state);
            
            if (state === 'failed') {
                console.log(`❌ Voice ICE connection failed with ${user.username}, attempting restart`);
                peerConnection.restartIce();
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

function handleUserDisconnected(data) {
    const { userId } = data;
    
    if (peerConnections[userId]) {
        cleanupPeerConnection(peerConnections[userId], userId, false);
    }
    
    if (screenPeerConnections[userId]) {
        cleanupPeerConnection(screenPeerConnections[userId], userId, true);
    }
    
    if (screenShareConnections[userId]) {
        cleanupPeerConnection(screenShareConnections[userId], userId, true);
    }
}

function findUserById(userId) {
    const userElement = document.getElementById(`user-${userId}`);
    if (userElement) {
        const userName = userElement.querySelector('.user-name').textContent;
        return { id: userId, username: userName };
    }
    return null;
}

// ENHANCED cleanup function
function cleanupVoiceChat() {
    console.log('🧹 Cleaning up all connections...');
    
    // Close all peer connections
    Object.keys(peerConnections).forEach(userId => {
        console.log(`🔌 Closing voice connection with ${userId}`);
        try {
            cleanupPeerConnection(peerConnections[userId], userId, false);
        } catch (error) {
            console.warn('Error closing voice connection:', error);
        }
    });
    
    Object.keys(screenPeerConnections).forEach(userId => {
        console.log(`🔌 Closing screen peer connection with ${userId}`);
        try {
            cleanupPeerConnection(screenPeerConnections[userId], userId, true);
        } catch (error) {
            console.warn('Error closing screen peer connection:', error);
        }
    });
    
    Object.keys(screenShareConnections).forEach(userId => {
        console.log(`🔌 Closing screen share connection with ${userId}`);
        try {
            cleanupPeerConnection(screenShareConnections[userId], userId, true);
        } catch (error) {
            console.warn('Error closing screen share connection:', error);
        }
    });
    
    peerConnections = {};
    screenPeerConnections = {};
    screenShareConnections = {};
    connectedUsers.clear();
    isInVoiceChat = false;
    
    console.log('✅ Connection cleanup complete');
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

// FIXED Screen Share Toggle
async function toggleScreenShare() {
    console.log('🎬 Screen share toggle clicked, current state:', isScreenSharing);
    
    try {
        if (!isScreenSharing) {
            console.log('🚀 Starting screen share...');
            
            // Get screen stream
            screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 15, max: 30 }
                }, 
                audio: true
            });
            
            console.log('✅ Screen stream obtained');
            console.log('Video tracks:', screenStream.getVideoTracks().length);
            console.log('Audio tracks:', screenStream.getAudioTracks().length);
            
            // Add to local display
            addScreenShareElement('screen-local', 'Your Screen Share', screenStream);
            
            // Update UI
            const screenBtn = document.getElementById('screenBtn');
            screenBtn.textContent = '⏹️ Stop Share';
            screenBtn.className = 'btn btn-danger';
            isScreenSharing = true;
            
            showToast('Screen sharing started');
            playNotificationSound('screen_start');

            // Notify server
            if (socket && currentUser) {
                socket.emit('screen-share-start', {
                    userId: currentUser.id,
                    username: currentUser.name
                });
            }

            // Connect to ALL users in the room for screen sharing
            console.log('🔗 Connecting screen share to all users...');
            console.log('Voice connections:', Object.keys(peerConnections));
            
            // Wait a bit for server notification to propagate
            setTimeout(async () => {
                for (const userId in peerConnections) {
                    console.log(`📤 Setting up screen share with ${userId}`);
                    await setupScreenShareWithUser(userId);
                }
            }, 500);

            // Handle stream ending
            screenStream.getVideoTracks()[0].onended = () => {
                console.log('🛑 Screen share ended by user');
                stopScreenShare();
            };

            // Update status
            socket.emit('user-status', {
                isMuted: isMuted,
                isScreenSharing: true
            });

        } else {
            stopScreenShare();
        }
    } catch (error) {
        console.error('❌ Screen share error:', error);
        showToast('Screen sharing failed: ' + error.message);
        
        // Reset UI on error
        const screenBtn = document.getElementById('screenBtn');
        screenBtn.textContent = '📺 Screen';
        screenBtn.className = 'btn btn-primary';
        isScreenSharing = false;
    }
}

// Enhanced Stop Screen Share
function stopScreenShare() {
    console.log('🛑 Stopping screen share');
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => {
            console.log(`⏹️ Stopping ${track.kind} track`);
            track.stop();
        });
        screenStream = null;
    }
    
    // Close all screen share connections
    Object.keys(screenShareConnections).forEach(userId => {
        console.log(`🔌 Closing screen share connection with ${userId}`);
        cleanupPeerConnection(screenShareConnections[userId], userId, true);
    });
    
    Object.keys(screenPeerConnections).forEach(userId => {
        console.log(`🔌 Closing screen peer connection with ${userId}`);
        cleanupPeerConnection(screenPeerConnections[userId], userId, true);
    });
    
    // Remove UI elements - FIXED: Only remove your own screen share
    removeScreenShareElement('screen-local');
    
    // Reset button
    const screenBtn = document.getElementById('screenBtn');
    screenBtn.textContent = '📺 Screen';
    screenBtn.className = 'btn btn-primary';
    isScreenSharing = false;
    
    showToast('Screen sharing stopped');
    playNotificationSound('screen_stop');

    // Notify server
    if (socket && currentUser) {
        socket.emit('screen-share-stop', {});
        socket.emit('user-status', {
            isMuted: isMuted,
            isScreenSharing: false
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

    // Clean up audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        gainNode = null;
    }

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

    currentRoom = null;
}

// Audio feedback system
function playNotificationSound(type) {
    try {
        const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
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
                const oscillator = tempAudioContext.createOscillator();
                const gainNode = tempAudioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(tempAudioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, tempAudioContext.currentTime);
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0, tempAudioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, tempAudioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, tempAudioContext.currentTime + 0.2);
                
                oscillator.start(tempAudioContext.currentTime);
                oscillator.stop(tempAudioContext.currentTime + 0.2);
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
    console.log('🖼️ Adding screen share element:', id, label);
    
    const videoGrid = document.getElementById('videoGrid');

    // Remove existing screen share if any
    removeScreenShareElement(id);

    const container = document.createElement('div');
    container.className = 'video-container screen-share-container';
    container.id = `video-${id}`;
    container.style.minHeight = '300px';
    container.style.border = '2px solid #faa61a';

    // Create video element
    const video = document.createElement('video');
    video.className = 'video-element';
    video.autoplay = true;
    video.muted = true; // Prevent audio feedback
    video.playsInline = true; // Important for mobile
    video.controls = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain'; // Show entire screen, don't crop
    video.style.backgroundColor = '#000'; // Black background instead of grey
    
    // Apply volume setting
    video.volume = outputVolumeLevel / 100;
    
    if (stream) {
        video.srcObject = stream;
        
        // Enhanced debug logging
        video.onloadedmetadata = () => {
            console.log('📺 Screen share video metadata loaded:', {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration,
                readyState: video.readyState
            });
            
            // Force play after metadata is loaded
            video.play().then(() => {
                console.log('▶️ Screen share video playing successfully');
            }).catch(err => {
                console.error('❌ Error playing screen share video:', err);
            });
        };
        
        video.onplay = () => {
            console.log('▶️ Screen share video started playing');
        };
        
        video.onerror = (error) => {
            console.error('❌ Screen share video error:', error);
        };
        
        // Check if stream has active tracks
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
            const track = videoTracks[0];
            console.log('📹 Video track info:', {
                kind: track.kind,
                enabled: track.enabled,
                readyState: track.readyState,
                settings: track.getSettings()
            });
        }
    }

    // Create the container HTML
    container.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; min-height: 300px; background: #000;">
            <div class="video-label" style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 4px; color: white; font-size: 12px; z-index: 10;">
                📺 ${label}
            </div>
        </div>
    `;

    // Add the video element to the container
    const videoContainer = container.querySelector('div');
    videoContainer.appendChild(video);

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
                    ✨ Enhanced Features: Volume controls, Password protection, Screen sharing
                </p>
            </div>
        </div>
    `;
}

// Debug function to check connections
function debugConnections() {
    console.log('=== ENHANCED CONNECTION DEBUG ===');
    console.log('Voice connections:', Object.keys(peerConnections));
    console.log('Screen share connections (new):', Object.keys(screenShareConnections));
    console.log('Screen peer connections (old):', Object.keys(screenPeerConnections));
    console.log('Connected users:', Array.from(connectedUsers));
    console.log('Is screen sharing:', isScreenSharing);
    console.log('Screen stream:', screenStream);
    console.log('Current user:', currentUser);
    console.log('Audio context:', audioContext);
    console.log('Gain node:', gainNode);
    
    // Check connection states
    Object.entries(peerConnections).forEach(([userId, pc]) => {
        console.log(`Voice connection ${userId}:`, {
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            signalingState: pc.signalingState
        });
    });
    
    Object.entries(screenShareConnections).forEach(([userId, pc]) => {
        console.log(`Screen connection ${userId}:`, {
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            signalingState: pc.signalingState
        });
    });
    
    if (screenStream) {
        console.log('Screen stream tracks:');
        screenStream.getTracks().forEach((track, index) => {
            console.log(`Track ${index}:`, {
                kind: track.kind,
                enabled: track.enabled,
                readyState: track.readyState,
                settings: track.getSettings()
            });
        });
    }
}

// Connection health monitoring
function startConnectionHealthMonitoring() {
    setInterval(() => {
        const allConnections = [
            ...Object.values(peerConnections),
            ...Object.values(screenShareConnections),
            ...Object.values(screenPeerConnections)
        ];
        
        allConnections.forEach((pc, index) => {
            if (pc.connectionState === 'failed') {
                console.warn(`🚨 Connection ${index} is in failed state, attempting restart`);
                try {
                    pc.restartIce();
                } catch (error) {
                    console.error('Failed to restart ICE:', error);
                }
            }
        });
    }, 30000); // Check every 30 seconds
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    startConnectionHealthMonitoring();
});

// Handle enter key in inputs
document.addEventListener('keypress', function(e) {
    if (e.target.id === 'loginUsername' && e.key === 'Enter') {
        handleLogin();
    }
    if (e.target.id === 'loginPassword' && e.key === 'Enter') {
        handleLogin();
    }
    if (e.target.id === 'usernameInput' && e.key === 'Enter') {
        joinRoom();
    }
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
        if (document.getElementById('mobileNav')) {
            document.getElementById('mobileNav').style.display = 'none';
        }
        isMobileView = false;
    } else if (currentUser && currentRoom) {
        if (document.getElementById('mobileNav')) {
            document.getElementById('mobileNav').style.display = 'block';
        }
        if (!isMobileView) {
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('mainContent').classList.add('mobile-active');
            isMobileView = true;
        }
    }
});

// Periodically apply volume settings to ensure all elements have correct volume
setInterval(applyVolumeSettings, 1000);
