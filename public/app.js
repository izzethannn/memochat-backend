// Global variables
// Auto-detect backend URL based on environment
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'  // Local development
    : window.location.origin;  // Production (same origin) 
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

// Captcha variables
let captchaAnswer = 0;

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

// ===============================
// ENHANCEMENT 1: ROOM MEMBER COUNT IN TITLE
// ===============================

// Enhanced room title update function
function updateRoomTitle(roomName, userCount, isPasswordProtected = false) {
    const roomNames = {
        'general': '🏠 General Chat',
        'gaming': '🎮 Gaming',
        'study': '📚 Study Group',
        'music': '🎵 Music & Chill',
        'private': '🔒 Private Room'
    };

    const displayName = roomNames[roomName] || `🔐 ${roomName}`;
    const lockIcon = isPasswordProtected ? '🔐 ' : '';
    const memberText = userCount === 1 ? 'user' : 'users';

    // Update both title and page title
    document.getElementById('roomTitle').textContent = `${lockIcon}${displayName} (${userCount} ${memberText})`;
    document.title = `MemoChat - ${displayName} (${userCount})`;
}

// ===============================
// ENHANCEMENT 2: KEYBOARD SHORTCUTS
// ===============================

function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyDown);

    // Show keyboard shortcuts hint
    showToast('💡 Tip: CTRL+M to mute, CTRL+L to leave, CTRL+S for screen share', 4000);
}

function handleKeyDown(event) {
    // Don't trigger shortcuts when typing in inputs
    if (event.target.matches('input, textarea, [contenteditable]')) {
        // CTRL+ENTER to send message when in chat input
        if (event.key === 'Enter' && event.ctrlKey && event.target.id === 'chatInput') {
            event.preventDefault();
            sendMessage();
        }
        return;
    }

    switch (event.key) {
        case 'm':
            // CTRL+M to toggle mute
            if (event.ctrlKey && localStream) {
                event.preventDefault();
                toggleMic();
                showToast('🎤 CTRL+M mute toggled', 1000);
            }
            break;

        case 'l':
            // CTRL+L to leave room
            if (event.ctrlKey && currentRoom) {
                event.preventDefault();
                if (confirm('Leave the current room?')) {
                    leaveRoom();
                }
            }
            break;

        case 's':
            // CTRL+S for screen share
            if (event.ctrlKey && localStream) {
                event.preventDefault();
                toggleScreenShare();
            }
            break;
    }
}

// ===============================
// HELPER FUNCTIONS
// ===============================
function getUserColor(username) {
    // Generate consistent color for each username
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to HSL for better color variety
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 30); // 60-90% saturation
    const lightness = 45 + (Math.abs(hash) % 20);  // 45-65% lightness

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
function getCurrentUserCount() {
    return document.querySelectorAll('.user-item').length;
}

function getCurrentRoomName() {
    // Extract room name from current room variable or title
    return currentRoom || 'general';
}

function isCurrentRoomPasswordProtected() {
    return document.getElementById('roomTitle').textContent.includes('🔐');
}

// ===============================
// ENHANCED VALIDATION FUNCTIONS
// ===============================

// 1. STRONGER PASSWORD VALIDATION
function validatePassword(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push("at least 8 characters");
    }

    if (!/[A-Z]/.test(password)) {
        errors.push("one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
        errors.push("one lowercase letter");
    }

    if (!/\d/.test(password)) {
        errors.push("one number");
    }

    if (!/[!@#$%^&*(),.?":{}|<>-_]/.test(password)) {
        errors.push("one special character (!@#$%^&* etc.)");
    }

    if (errors.length > 0) {
        return `Password must contain: ${errors.join(", ")}`;
    }

    return null; // Valid password
}

// 2. MATH CAPTCHA SYSTEM
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1; // 1-10
    const num2 = Math.floor(Math.random() * 10) + 1; // 1-10
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    let question, answer;

    switch (operation) {
        case '+':
            question = `${num1} + ${num2}`;
            answer = num1 + num2;
            break;
        case '-':
            // Ensure positive result
            const larger = Math.max(num1, num2);
            const smaller = Math.min(num1, num2);
            question = `${larger} - ${smaller}`;
            answer = larger - smaller;
            break;
        case '*':
            // Use smaller numbers for multiplication
            const small1 = Math.floor(Math.random() * 5) + 1; // 1-5
            const small2 = Math.floor(Math.random() * 5) + 1; // 1-5
            question = `${small1} × ${small2}`;
            answer = small1 * small2;
            break;
    }

    captchaAnswer = answer;
    const captchaElement = document.getElementById('captchaQuestion');
    if (captchaElement) {
        captchaElement.textContent = question;
    }
    const answerElement = document.getElementById('captchaAnswer');
    if (answerElement) {
        answerElement.value = '';
    }
}

function validateCaptcha() {
    const captchaAnswerElement = document.getElementById('captchaAnswer');
    if (!captchaAnswerElement) return false;

    const userAnswer = parseInt(captchaAnswerElement.value);
    return userAnswer === captchaAnswer;
}

// 3. BETTER USERNAME VALIDATION
function validateUsername(username) {
    // Check length
    if (username.length < 3 || username.length > 15) {
        return "Username must be 3-15 characters long";
    }

    // Check valid characters (letters, numbers, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return "Username can only contain letters, numbers, underscore (_) and hyphen (-)";
    }

    // Cannot be all numbers
    if (/^[0-9]+$/.test(username)) {
        return "Username cannot be all numbers";
    }

    // Cannot start with number
    if (/^[0-9]/.test(username)) {
        return "Username cannot start with a number";
    }

    // Check for reserved words
    const reservedWords = ['admin', 'system', 'root', 'user', 'guest', 'test', 'null', 'undefined', 'memochat'];
    if (reservedWords.includes(username.toLowerCase())) {
        return "This username is reserved and cannot be used";
    }

    return null; // Valid username
}

// CAPTCHA REFRESH FUNCTION
function refreshCaptcha() {
    generateCaptcha();
    showToast('New math question generated');
}

// ===============================
// LOGIN SYSTEM FUNCTIONS
// ===============================

function showLoginForm() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    // Show global controls
    document.getElementById('logoutBtn').style.display = 'flex';
    document.getElementById('settingsBtn').style.display = 'flex';
}

// UPDATED REGISTRATION FUNCTION with enhanced validation
async function handleRegister() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    // Basic validation
    if (!username || !password) {
        showToast('Please enter both username and password');
        return;
    }

    // 1. VALIDATE USERNAME
    const usernameError = validateUsername(username);
    if (usernameError) {
        showToast(usernameError);
        return;
    }

    // 2. VALIDATE PASSWORD
    const passwordError = validatePassword(password);
    if (passwordError) {
        showToast(passwordError);
        return;
    }

    // 3. VALIDATE CAPTCHA
    if (!validateCaptcha()) {
        showToast('Incorrect answer to the math question. Please try again.');
        generateCaptcha(); // Generate new question
        return;
    }

    try {
        // Show loading state
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.textContent = 'Creating account...';
        registerBtn.disabled = true;

        // Call Railway backend directly
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Registration failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        showToast('Account created successfully! Please login.');

        // Clear form and generate new captcha
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        generateCaptcha();

        // Auto-focus login for convenience
        setTimeout(() => {
            document.getElementById('loginUsername').focus();
        }, 1000);

    } catch (error) {
        console.error('Registration error:', error);
        showToast(`Registration failed: ${error.message}`);
        generateCaptcha(); // Generate new captcha on error
    } finally {
        // Reset button state
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.textContent = 'Create Account';
        registerBtn.disabled = false;
    }
}

// UPDATED LOGIN FUNCTION with enhanced validation
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showToast('Please enter both username and password');
        return;
    }

    // Basic username validation (less strict for login)
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
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        console.log('Attempting login to:', `${BACKEND_URL}/api/auth/login`);

        // Call Railway backend directly
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        console.log('Login response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Login error response:', errorText);
            throw new Error(`Login failed: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log('Login successful');

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

    } catch (error) {
        console.error('Login error:', error);
        showToast(`Login failed: ${error.message}`);
    } finally {
        // Reset button state
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
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

    // Hide global controls
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('settingsBtn').style.display = 'none';

    showToast('Logged out successfully');
}

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');

    if (token && username) {
        // Verify token with server
        fetch(`${BACKEND_URL}/api/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Token verification failed');
                }
                return response.json();
            })
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

// ===============================
// AUDIO CONTEXT INITIALIZATION
// ===============================

// ENHANCED: Audio context with noise gate for click suppression
async function initializeAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        if (localStream) {
            const source = audioContext.createMediaStreamSource(localStream);

            gainNode = audioContext.createGain();

            // 1. High-pass filter (remove low rumbles)
            const highPassFilter = audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.setValueAtTime(100, audioContext.currentTime);

            // 2. Compressor for general noise reduction
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
            compressor.knee.setValueAtTime(30, audioContext.currentTime);
            compressor.ratio.setValueAtTime(12, audioContext.currentTime);
            compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
            compressor.release.setValueAtTime(0.25, audioContext.currentTime);

            // 3. Low-pass filter
            const lowPassFilter = audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.setValueAtTime(7000, audioContext.currentTime);

            // 4. NOISE GATE - This is the key part for click suppression!
            const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
            let gateOpen = false;
            let gateLevel = 0;
            const gateThreshold = currentSettings.gateThreshold;    // Use setting instead of hardcoded
            const attackTime = 10;         // How fast gate opens (ms)
            const releaseTime = currentSettings.releaseTime;       // Use setting instead of hardcoded

            scriptProcessor.onaudioprocess = function (audioProcessingEvent) {
                const inputBuffer = audioProcessingEvent.inputBuffer;
                const outputBuffer = audioProcessingEvent.outputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                const outputData = outputBuffer.getChannelData(0);

                for (let i = 0; i < inputData.length; i++) {
                    const sample = Math.abs(inputData[i]);

                    // Calculate average level over small window
                    const avgLevel = sample * 0.1 + gateLevel * 0.9;
                    gateLevel = avgLevel;

                    // Gate logic: open if sustained audio above threshold
                    if (avgLevel > gateThreshold) {
                        gateOpen = true;
                    } else if (avgLevel < gateThreshold * 0.3) {
                        gateOpen = false;
                    }

                    // Apply gate with smooth transitions
                    const targetGain = gateOpen ? 1.0 : 0.05; // 5% when closed
                    const currentGain = outputData[i - 1] ? Math.abs(outputData[i - 1] / inputData[i - 1]) : targetGain;
                    const smoothGain = currentGain * 0.95 + targetGain * 0.05;

                    outputData[i] = inputData[i] * smoothGain;
                }
            };

            const destination = audioContext.createMediaStreamDestination();

            // Connect the audio chain WITH noise gate
            source.connect(highPassFilter);
            highPassFilter.connect(compressor);
            compressor.connect(lowPassFilter);
            lowPassFilter.connect(scriptProcessor);    // ← NOISE GATE HERE
            scriptProcessor.connect(gainNode);         // ← THEN VOLUME CONTROL
            gainNode.connect(destination);

            // Replace stream
            const audioTrack = destination.stream.getAudioTracks()[0];
            const videoTracks = localStream.getVideoTracks();
            const processedStream = new MediaStream([audioTrack, ...videoTracks]);

            // Update peer connections
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                if (sender) {
                    sender.replaceTrack(audioTrack);
                }
            });

            localStream = processedStream;
            console.log('✅ Noise gate and audio processing active');
            showToast('🎤 Noise gate enabled - clicks should be suppressed!');
        }
    } catch (error) {
        console.warn('⚠️ Could not initialize enhanced audio context:', error);
        showToast('⚠️ Using basic noise reduction');
    }
}

// ===============================
// WEBRTC HELPER FUNCTIONS
// ===============================

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

// ===============================
// ROOM MANAGEMENT FUNCTIONS
// ===============================

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

// ===============================
// VOLUME CONTROL FUNCTIONS
// ===============================

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

// ===============================
// MOBILE VIEW MANAGEMENT
// ===============================

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

// ===============================
// UTILITY FUNCTIONS
// ===============================

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

// ===============================
// SOCKET INITIALIZATION
// ===============================

// Initialize app and socket connection
async function initializeApp() {
    if (!isLoggedIn) {
        console.log('User not logged in, skipping socket initialization');
        return;
    }

    // Connect to the backend server with auth token
    socket = io(BACKEND_URL, {
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
        // Setup friend system handlers
        setupFriendSystemHandlers();
        // Initialize friend system after socket connects
        if (isLoggedIn) {
            initFriendSystem();
        }
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

    // Room and user event handlers - USING ENHANCED VERSIONS
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

// ===============================
// ROOM JOINING FUNCTIONS
// ===============================

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

        // Get user media with selected microphone and enhanced settings
        const constraints = {
            audio: {
                deviceId: currentSettings.microphoneId ? { exact: currentSettings.microphoneId } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Initialize audio context for input volume control and noise reduction
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

// ===============================
// ENHANCED ROOM EVENT HANDLERS
// ===============================

// ENHANCED Handle room joined
function handleRoomJoined(data) {
    // Update room title with member count
    updateRoomTitle(data.room, data.users.length, data.isPasswordProtected);

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

    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts();
}

// ENHANCED Handle user events
function handleUserJoined(data) {
    console.log('User joined:', data);
    addChatMessage('System', `${data.username} joined the room`, true);
    playNotificationSound('join');
    showToast(`${data.username} joined`);

    // Update room title with new count
    const currentCount = getCurrentUserCount() + 1;
    const roomName = getCurrentRoomName();
    updateRoomTitle(roomName, currentCount, isCurrentRoomPasswordProtected());

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

    // Update room title with new count
    const currentCount = Math.max(1, getCurrentUserCount() - 1);
    const roomName = getCurrentRoomName();
    updateRoomTitle(roomName, currentCount, isCurrentRoomPasswordProtected());

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

// ===============================
// WEBRTC VOICE CHAT FUNCTIONS
// ===============================

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

// ===============================
// UI CONTROL FUNCTIONS
// ===============================

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

    if (isScreenSharing) {
        showToast('Screen sharing stopped');
        playNotificationSound('screen_stop');
        isScreenSharing = false;
    }

    // Notify server
    if (socket && currentUser) {
        socket.emit('screen-share-stop', {});
        socket.emit('user-status', {
            isMuted: isMuted,
            isScreenSharing: false
        });
    }
}

// ENHANCED Leave Room Function - FIXED FOR PROPER CLEANUP
function leaveRoom() {
    if (currentUser && currentRoom) {
        socket.emit('leave-room', {
            userId: currentUser.id,
            room: currentRoom
        });
    }

    playNotificationSound('leave');
    showToast('Left the room');

    // ENHANCED CLEANUP - Clean up streams MORE thoroughly
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false; // EXTRA: disable tracks
        });
        localStream = null;
    }

    stopScreenShare();

    // EXTRA: Reset mute state
    isMuted = false;
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        micBtn.textContent = '🎤 Mic';
        micBtn.className = 'btn btn-success';
    }

    // EXTRA: Reset all audio elements
    document.querySelectorAll('audio, video').forEach(element => {
        element.pause();
        element.srcObject = null;
        element.remove();
    });

    // Clean up audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        gainNode = null;
    }

    // Clean up voice chat
    cleanupVoiceChat();

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleKeyDown);


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

    // FIX: Show join form again and hide voice controls
    const joinForm = document.getElementById('joinForm');
    const voiceControls = document.getElementById('voiceControls');
    const contentArea = document.getElementById('contentArea');
    const welcomeScreen = document.getElementById('welcomeScreen');

    if (joinForm) joinForm.style.display = 'block';
    if (voiceControls) voiceControls.style.display = 'none';
    if (contentArea) contentArea.style.display = 'none';
    if (welcomeScreen) welcomeScreen.style.display = 'block';

    // Reset control buttons
    const leaveBtn = document.getElementById('leaveBtn');
    const screenBtn = document.getElementById('screenBtn');
    if (micBtn) micBtn.disabled = true;
    if (screenBtn) screenBtn.disabled = true;
    if (leaveBtn) leaveBtn.disabled = true;

    // Reset room selection
    const roomSelect = document.getElementById('roomSelect');
    if (roomSelect) roomSelect.value = '';

    currentRoom = null;
    isInVoiceChat = false;
}

// ===============================
// AUDIO FEEDBACK SYSTEM
// ===============================

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

// ===============================
// ELEMENT MANAGEMENT FUNCTIONS
// ===============================

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

// ===============================
// CHAT FUNCTIONS
// ===============================

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

    // Get user color (only for non-system messages)
    const userColor = isSystem ? '#43b581' : getUserColor(author);

    messageDiv.innerHTML = `
        <div class="message-author" style="color: ${userColor};">
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

// ===============================
// ENHANCED USER MANAGEMENT FUNCTIONS
// ===============================

// ENHANCED User Management Functions
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
    document.getElementById('usersList').innerHTML = '';
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

// Settings variables
let availableMicrophones = [];
let currentSettings = {
    microphoneId: null,
    gateThreshold: 0.02,
    releaseTime: 300
};
let testStream = null;
let audioLevelInterval = null;

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('memoChatSettings');
    if (saved) {
        currentSettings = { ...currentSettings, ...JSON.parse(saved) };
    }
}

// Save settings to localStorage
function saveSettingsToStorage() {
    localStorage.setItem('memoChatSettings', JSON.stringify(currentSettings));
}

// Open settings modal
async function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    await loadMicrophones();
    updateSettingsUI();
}

// Close settings modal
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
    if (testStream) {
        testStream.getTracks().forEach(track => track.stop());
        testStream = null;
    }
    if (audioLevelInterval) {
        clearInterval(audioLevelInterval);
        audioLevelInterval = null;
    }
}

// Load available microphones
async function loadMicrophones() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableMicrophones = devices.filter(device => device.kind === 'audioinput');

        const select = document.getElementById('microphoneSelect');
        select.innerHTML = '<option value="">Default Microphone</option>';

        availableMicrophones.forEach(mic => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.textContent = mic.label || `Microphone ${availableMicrophones.indexOf(mic) + 1}`;
            select.appendChild(option);
        });

        // Set current selection
        select.value = currentSettings.microphoneId || '';

    } catch (error) {
        console.error('Error loading microphones:', error);
        showToast('❌ Could not load microphone list');
    }
}

// Refresh device list
async function refreshDevices() {
    await loadMicrophones();
    showToast('🔄 Device list refreshed');
}

// Update settings UI with current values
function updateSettingsUI() {
    document.getElementById('sensitivitySlider').value = currentSettings.gateThreshold;
    document.getElementById('sensitivityValue').textContent = currentSettings.gateThreshold;

    document.getElementById('releaseTimeSlider').value = currentSettings.releaseTime;
    document.getElementById('releaseTimeValue').textContent = currentSettings.releaseTime + 'ms';

    // Add event listeners for real-time updates
    document.getElementById('sensitivitySlider').oninput = function () {
        document.getElementById('sensitivityValue').textContent = this.value;
    };

    document.getElementById('releaseTimeSlider').oninput = function () {
        document.getElementById('releaseTimeValue').textContent = this.value + 'ms';
    };
}

// Test microphone with audio level meter
async function testMicrophone() {
    const testBtn = document.getElementById('testMicBtn');
    const levelBar = document.getElementById('audioLevelBar');

    if (testStream) {
        // Stop testing
        testStream.getTracks().forEach(track => track.stop());
        testStream = null;
        clearInterval(audioLevelInterval);
        testBtn.textContent = '🎤 Test Microphone';
        testBtn.className = 'btn btn-success';
        levelBar.style.width = '0%';
        return;
    }

    try {
        const micId = document.getElementById('microphoneSelect').value;
        const constraints = {
            audio: {
                deviceId: micId ? { exact: micId } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };

        testStream = await navigator.mediaDevices.getUserMedia(constraints);
        testBtn.textContent = '⏹️ Stop Test';
        testBtn.className = 'btn btn-danger';

        // Create audio level monitoring
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(testStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        audioLevelInterval = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const percentage = Math.min(100, (average / 128) * 100);
            levelBar.style.width = percentage + '%';
        }, 100);

        showToast('🎤 Testing microphone - speak to see levels');

    } catch (error) {
        console.error('Error testing microphone:', error);
        showToast('❌ Could not access microphone');
    }
}

// Save settings and apply them
function saveSettings() {
    currentSettings.microphoneId = document.getElementById('microphoneSelect').value || null;
    currentSettings.gateThreshold = parseFloat(document.getElementById('sensitivitySlider').value);
    currentSettings.releaseTime = parseInt(document.getElementById('releaseTimeSlider').value);

    saveSettingsToStorage();

    // If in a room, restart audio with new settings
    if (currentRoom && localStream) {
        showToast('🔄 Applying new audio settings...');
        setTimeout(() => {
            initializeAudioContext();
        }, 500);
    }

    closeSettings();
    showToast('💾 Settings saved successfully!');
}

// Reset to default settings
function resetToDefaults() {
    currentSettings = {
        microphoneId: null,
        gateThreshold: 0.02,
        releaseTime: 300
    };
    updateSettingsUI();
    showToast('🔄 Settings reset to defaults');
}

// ===============================
// DEBUG AND MONITORING FUNCTIONS
// ===============================

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

// ===============================
// EVENT LISTENERS
// ===============================

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // ← ADD THIS LINE
    checkAuthStatus();
    startConnectionHealthMonitoring();

    // Generate initial captcha
    if (document.getElementById('captchaQuestion')) {
        generateCaptcha();
    }
});

// Handle enter key in inputs
document.addEventListener('keypress', function (e) {
    if (e.target.id === 'loginUsername' && e.key === 'Enter') {
        handleLogin();
    }
    if (e.target.id === 'loginPassword' && e.key === 'Enter') {
        handleLogin();
    }
    if (e.target.id === 'captchaAnswer' && e.key === 'Enter') {
        if (e.target.closest('#loginScreen')) {
            // Determine which button to trigger based on context
            const password = document.getElementById('loginPassword').value.trim();
            if (password.length >= 6) {
                handleLogin();
            } else {
                handleRegister();
            }
        }
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
window.addEventListener('resize', function () {
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

// ===============================
// PERIODIC MAINTENANCE
// ===============================

// Periodically apply volume settings to ensure all elements have correct volume
setInterval(applyVolumeSettings, 1000);

// Make debug function available globally for troubleshooting
window.debugConnections = debugConnections;
// ========== FRIEND SYSTEM JAVASCRIPT ==========

// Friend System Variables
let currentDMFriend = null;
let friendsList = [];
let unreadCounts = {};
let myInvitationCode = '';

// Initialize friend system after login
function initFriendSystem() {
    console.log('🔵 initFriendSystem() called');
    console.log('Socket exists:', !!socket);
    console.log('Socket connected:', socket?.connected);
    console.log('Current user:', currentUser);

    socket.emit('get-my-code');
    socket.emit('get-friends');
    socket.emit('get-pending-requests');
    socket.emit('get-unread-count');
    document.getElementById('friendsSection').style.display = 'block';
}

// Setup all friend system socket event handlers
// IMPORTANT: This must be called AFTER socket is created in initializeApp()
function setupFriendSystemHandlers() {
    // Get my invitation code
    socket.on('my-invitation-code', (data) => {
        myInvitationCode = data.code;
        document.getElementById('myInvitationCode').textContent = data.code;
    });

    // User found
    socket.on('user-found', (user) => {
        const resultDiv = document.getElementById('friendLookupResult');
        resultDiv.innerHTML = `
            <div class="friend-lookup-result">
                <span>👤 ${user.username}</span>
                <button class="btn btn-sm btn-success" onclick="sendFriendRequest(${user.id})">Add Friend</button>
            </div>
        `;
    });

    // User not found
    socket.on('user-not-found', (data) => {
        const resultDiv = document.getElementById('friendLookupResult');
        resultDiv.innerHTML = `<p style="color: var(--danger); font-size: 0.9rem;">${data.message}</p>`;
        setTimeout(() => {
            resultDiv.innerHTML = '';
        }, 3000);
    });

    // Friend request sent
    socket.on('friend-request-sent', () => {
        showToast('✅ Friend request sent!');
    });

    // Friend request received
    socket.on('friend-request-received', (data) => {
        showToast(`👋 Friend request from ${data.senderUsername}`);
        socket.emit('get-pending-requests');
    });

    // Display pending requests
    socket.on('pending-requests', (requests) => {
        const requestsDiv = document.getElementById('pendingRequests');
        if (requests.length === 0) {
            requestsDiv.innerHTML = '';
            return;
        }

        requestsDiv.innerHTML = '<h4>📬 Pending Requests</h4>';
        requests.forEach(req => {
            const div = document.createElement('div');
            div.className = 'friend-request-item';
            div.innerHTML = `
                <span>${req.sender_username}</span>
                <div>
                    <button class="btn btn-sm btn-success" onclick="acceptFriendRequest(${req.id})">✓</button>
                    <button class="btn btn-sm btn-danger" onclick="declineFriendRequest(${req.id})">✕</button>
                </div>
            `;
            requestsDiv.appendChild(div);
        });
    });

    // Friend added
    socket.on('friend-added', () => {
        showToast('✅ Friend added!');
        socket.emit('get-friends');
        socket.emit('get-pending-requests');
    });

    // Friend request accepted
    socket.on('friend-request-accepted', (data) => {
        showToast(`✅ ${data.username} accepted your friend request!`);
        socket.emit('get-friends');
    });

    // Refresh friends
    socket.on('refresh-friends', () => {
        socket.emit('get-friends');
    });

    // Display friends list
    socket.on('friends-list', (friends) => {
        friendsList = friends;
        const friendsDiv = document.getElementById('friendsList');

        if (friends.length === 0) {
            friendsDiv.innerHTML = '<p style="text-align: center; opacity: 0.6; margin-top: 20px;">No friends yet</p>';
            return;
        }

        friendsDiv.innerHTML = '<h4>👥 Friends</h4>';
        friends.forEach(friend => {
            const unreadCount = unreadCounts[friend.id] || 0;
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.onclick = () => openDM(friend);
            div.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span class="friend-status status-${friend.status || 'offline'}"></span>
                    <span>${friend.username}</span>
                </div>
                ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
            `;
            friendsDiv.appendChild(div);
        });
    });

    // DM sent
    socket.on('dm-sent', (data) => {
        const messagesDiv = document.getElementById('dmMessages');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'dm-message dm-sent';
        msgDiv.textContent = data.message;
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    // DM received
    socket.on('dm-received', (data) => {
        if (currentDMFriend && currentDMFriend.id === data.senderId) {
            const messagesDiv = document.getElementById('dmMessages');
            const msgDiv = document.createElement('div');
            msgDiv.className = 'dm-message dm-received';
            msgDiv.textContent = data.message;
            messagesDiv.appendChild(msgDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            socket.emit('mark-dm-read', { senderId: data.senderId });
        } else {
            unreadCounts[data.senderId] = (unreadCounts[data.senderId] || 0) + 1;
            socket.emit('get-friends');
            showToast(`💬 New message from ${data.senderUsername}`);
        }
    });

    // DM history
    socket.on('dm-history', (messages) => {
        const messagesDiv = document.getElementById('dmMessages');
        messagesDiv.innerHTML = '';

        if (messages.length === 0) {
            messagesDiv.innerHTML = '<p style="text-align: center; opacity: 0.6;">No messages yet. Say hi! 👋</p>';
            return;
        }

        messages.forEach(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const msgDiv = document.createElement('div');
            msgDiv.className = `dm-message ${isMe ? 'dm-sent' : 'dm-received'}`;
            msgDiv.textContent = msg.message;
            messagesDiv.appendChild(msgDiv);
        });

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    // Unread counts
    socket.on('unread-counts', (counts) => {
        unreadCounts = {};
        counts.forEach(item => {
            unreadCounts[item.sender_id] = parseInt(item.unread_count);
        });
        socket.emit('get-friends');
    });

    // DM marked as read
    socket.on('dm-marked-read', (data) => {
        if (unreadCounts[data.senderId]) {
            delete unreadCounts[data.senderId];
            socket.emit('get-friends');
        }
    });

    // Friend request declined
    socket.on('friend-request-declined', (data) => {
        socket.emit('get-pending-requests');
    });
}

// UI Functions (these don't use socket directly)
function copyMyCode() {
    navigator.clipboard.writeText(myInvitationCode);
    showToast('✅ Invitation code copied!');
}

function lookupFriend() {
    const code = document.getElementById('friendCodeInput').value.trim().toUpperCase();
    if (!code || code.length < 6) {
        showToast('⚠️ Please enter a valid code');
        return;
    }
    socket.emit('lookup-user-by-code', { invitationCode: code });
}

function sendFriendRequest(receiverId) {
    socket.emit('send-friend-request', { receiverId });
    document.getElementById('friendCodeInput').value = '';
    document.getElementById('friendLookupResult').innerHTML = '';
}

function acceptFriendRequest(requestId) {
    socket.emit('accept-friend-request', { requestId });
}

function declineFriendRequest(requestId) {
    socket.emit('decline-friend-request', { requestId });
}

function openDM(friend) {
    currentDMFriend = friend;
    document.getElementById('dmUsername').textContent = friend.username;
    document.getElementById('dmModal').style.display = 'flex';
    document.getElementById('dmMessages').innerHTML = '';

    socket.emit('get-dm-history', { friendId: friend.id });
    socket.emit('mark-dm-read', { senderId: friend.id });
}

function closeDM() {
    document.getElementById('dmModal').style.display = 'none';
    currentDMFriend = null;
    document.getElementById('dmInput').value = '';
}

function sendDM() {
    const input = document.getElementById('dmInput');
    const message = input.value.trim();

    if (!message || !currentDMFriend) return;

    socket.emit('send-dm', {
        receiverId: currentDMFriend.id,
        message
    });

    input.value = '';
}

// Event listeners for Enter key
document.addEventListener('DOMContentLoaded', () => {
    const dmInput = document.getElementById('dmInput');
    if (dmInput) {
        dmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendDM();
            }
        });
    }

    const friendCodeInput = document.getElementById('friendCodeInput');
    if (friendCodeInput) {
        friendCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                lookupFriend();
            }
        });
    }
});