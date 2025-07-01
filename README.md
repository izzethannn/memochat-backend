# 📝 MemoChat v2.1

A real-time voice chat and screen sharing application built with Node.js, Socket.IO, and WebRTC. Now with enhanced security, user authentication, volume controls, and advanced spam protection!

![MemoChat Demo](https://img.shields.io/badge/Status-Live-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v18+-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7-red)
![Security](https://img.shields.io/badge/Security-Enhanced-green)

## ✨ New Features in v2.1

### 🔐 **Enhanced Authentication System**
- **User Registration & Login**: Secure account creation with JWT tokens
- **Strong Password Requirements**: 8+ characters with mixed case, numbers, and symbols
- **Advanced Username Validation**: 3-15 characters with smart restrictions
- **Math CAPTCHA Protection**: Dynamic anti-bot verification system
- **Session Management**: Persistent login with token verification

### 🛡️ **Advanced Security Features**
- **Password Strength Validation**: Real-time feedback on password requirements
- **CAPTCHA System**: Math problems prevent automated registrations
- **Reserved Username Protection**: Blocks system/admin usernames
- **Enhanced Input Sanitization**: Comprehensive validation for all user inputs
- **Rate Limiting**: Multi-layer protection against abuse

### 🔊 **Volume Controls**
- **Input Volume Slider**: Adjust your microphone sensitivity
- **Output Volume Slider**: Control how loud you hear others
- **Real-time volume adjustment** for all audio streams
- **Individual volume control** for each participant

### 📺 **Enhanced Screen Sharing**
- **Full WebRTC Implementation**: Peer-to-peer screen sharing
- **High Quality**: Up to 1080p at 30fps
- **Audio Included**: Share system audio with your screen
- **Multiple Screens**: Support for multiple users sharing simultaneously
- **Visual Indicators**: Glowing borders for active screen shares

### 🏠 **Room Management**
- **Password-Protected Rooms**: Create secure private spaces
- **Room ID System**: Custom room identifiers
- **Copy Room Info**: Easy sharing with clipboard integration
- **Multiple Room Types**: Gaming, Study, Music, and Private rooms

## 🎯 Core Features

- 🔐 **Secure Authentication** - Registration, login, and session management
- 🎤 **Real-time Voice Chat** - Crystal clear audio communication
- 💬 **Text Messaging** - Instant chat with message history
- 📺 **Screen Sharing** - Share your screen with participants
- 🏠 **Multiple Rooms** - Gaming, Study, Music, and Private rooms
- 👥 **User Management** - See who's online, muted, or sharing
- 🔊 **Audio Notifications** - Sound feedback for all actions
- 🛡️ **Advanced Security** - Multi-layer protection and validation
- 📱 **Responsive Design** - Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm 8+
- Modern web browser with WebRTC support

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/izzethannn/memochat-backend.git
cd memochat-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment** (create `.env` file)
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
BCRYPT_ROUNDS=10
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

4. **Start the server**
```bash
npm start
```

5. **Open MemoChat**
   - Server runs on `http://localhost:3001`
   - Create an account or login
   - Allow microphone access
   - Join a room and start chatting!

## 🌐 Demo

Try the live demo: [Your Railway URL here]

## 🎯 How to Use

### Getting Started
1. **Create Account**: Register with a secure username and password
2. **Solve CAPTCHA**: Complete the math question to verify you're human
3. **Login**: Access your account with your credentials
4. **Choose Room**: Select from various room types or create a private one

### Account Requirements
- **Username**: 3-15 characters, letters/numbers/underscore/hyphen only
- **Password**: 8+ characters with uppercase, lowercase, number, and special character
- **CAPTCHA**: Solve the math question to prevent spam

### Room Types
- 🏠 **General Chat** - Open discussions
- 🎮 **Gaming** - For gamers
- 📚 **Study Group** - Quiet study sessions
- 🎵 **Music & Chill** - Music listening parties
- 🔒 **Private Room** - Basic private conversations
- 🔐 **Password Protected** - Secure private rooms with custom passwords

### Creating Password-Protected Rooms
1. **Select "Password Protected"** from the room dropdown
2. **Click "Create Password Protected Room"**
3. **Enter your name and set a password** (minimum 4 characters)
4. **Click "Create Room"**
5. **Share the Room ID and Password** with friends
6. **Copy room info** using the copy button for easy sharing

### Volume Controls
- **Input Volume**: Controls your microphone sensitivity (visual indicator)
- **Output Volume**: Controls how loud you hear others (affects all audio streams)
- **Real-time Adjustment**: Changes apply immediately to all connections

### Screen Sharing
1. **Click the "Screen" button** in the main controls
2. **Select the screen/window** you want to share
3. **Include system audio** if desired
4. **Click "Share"** to start broadcasting
5. **Click "Stop"** to end screen sharing

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Authentication:** JWT, bcrypt
- **Real-time:** Socket.IO
- **Voice/Video:** WebRTC with STUN servers
- **Security:** Helmet, CORS, Rate Limiting, CAPTCHA, Password Protection
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Audio Processing:** Web Audio API

## 📡 API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/register` | POST | Create new user account | No |
| `/api/auth/login` | POST | Login to existing account | No |
| `/api/auth/verify` | POST | Verify JWT token | Yes |
| `/api/auth/logout` | POST | Logout and invalidate token | Yes |
| `/api/health` | GET | Server health check | No |
| `/api/rooms` | GET | List all active rooms | No |
| `/api/room/:name` | GET | Get specific room info | No |

## 🔌 Socket Events

### Client → Server
- `join-room` - Join a voice chat room (with optional password)
- `create-private-room` - Create a password-protected room
- `leave-room` - Leave current room  
- `chat-message` - Send text message (with spam protection)
- `user-status` - Update mute/screen share status
- `screen-share-start/stop` - Screen sharing events
- `offer/answer/ice-candidate` - WebRTC signaling

### Server → Client
- `private-room-created` - Room creation confirmation
- `room-joined` - Successfully joined room
- `user-joined/left` - User presence updates
- `chat-message` - New message received
- `user-status-update` - Status changes
- `user-screen-share-start/stop` - Screen sharing notifications

## 🛡️ Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure session management with 24-hour expiry
- **Password Hashing**: bcrypt with configurable salt rounds
- **Token Verification**: Server-side validation for all authenticated requests
- **Session Cleanup**: Automatic cleanup of expired sessions

### Password Security
- **Strength Requirements**: 8+ characters with mixed complexity
- **Real-time Validation**: Instant feedback on password strength
- **Secure Storage**: Hashed passwords with salt
- **No Password Exposure**: Passwords never logged or transmitted in plain text

### CAPTCHA Protection
- **Dynamic Math Problems**: Addition, subtraction, multiplication
- **Auto-refresh**: New questions generated on errors
- **Visual Feedback**: Clear success/failure indicators
- **Spam Prevention**: Blocks automated registration attempts

### Username Validation
- **Length Requirements**: 3-15 characters enforced
- **Character Restrictions**: Alphanumeric + underscore/hyphen only
- **Reserved Words**: Blocks admin, system, root, etc.
- **Format Rules**: Cannot be all numbers or start with numbers

### Rate Limiting
- **API Requests**: 100 requests per 15 minutes per IP
- **Authentication**: 5 auth attempts per 15 minutes per IP
- **Chat Messages**: 20 messages per minute per user
- **Connection Attempts**: Limited by IP address

### Spam Protection
- **Message Frequency**: Prevents rapid message sending
- **Duplicate Detection**: Flags repetitive messages
- **Content Filtering**: Basic content sanitization
- **User Throttling**: Temporary restrictions for spammers
- **Similarity Detection**: Advanced duplicate message detection

### Room Security
- **Password Protection**: Minimum 4 characters for private rooms
- **Room Isolation**: Password-protected rooms are isolated
- **Secure Transmission**: All data encrypted in transit
- **Access Control**: Users must authenticate to join protected rooms

## 🚢 Deployment

### Railway (Recommended)
1. Connect your GitHub repository
2. Set environment variables including `JWT_SECRET`
3. Deploy automatically
4. Get your live URL

### Environment Variables for Production
```env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

### Other Platforms
- **Render:** Free tier available with persistent storage
- **Heroku:** Paid hosting with add-ons
- **Google Cloud:** Student credits available
- **DigitalOcean:** App platform deployment

## 🧪 Testing

```bash
# Test the backend
node test_server.js

# Run with development auto-restart
npm run dev

# Test authentication system
# - Create new account with various passwords
# - Test CAPTCHA functionality
# - Verify token persistence

# Test security features
# - Try weak passwords (should fail)
# - Test reserved usernames (should fail)
# - Attempt rapid message sending (should throttle)

# Test room functionality
# - Create password-protected rooms
# - Try joining with wrong password
# - Verify access control works
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- Input volume slider is visual only (Web Audio API needed for real-time gain control)
- Mobile browser screen sharing support varies
- Password rooms persist until server restart (database integration planned)

## 🔮 Future Features

- [ ] **Database Integration** for persistent user accounts and rooms
- [ ] **Real Input Volume Control** using Web Audio API
- [ ] **User Profiles** with avatars and preferences
- [ ] **Friend System** and private messaging
- [ ] **File Sharing** in chat with security scanning
- [ ] **Voice Recording** and playback features
- [ ] **Mobile App** (React Native)
- [ ] **End-to-end Encryption** for private rooms
- [ ] **Admin Panel** for user and room management
- [ ] **Custom Themes** and UI customization
- [ ] **Two-Factor Authentication** for enhanced security
- [ ] **Audit Logs** for security monitoring

## 🆕 Version 2.1 Changelog

### 🔐 Security Enhancements Added
- **User Authentication System**: Complete registration and login flow
- **JWT Token Management**: Secure session handling with auto-expiry
- **Enhanced Password Validation**: 8+ character requirements with complexity rules
- **Math CAPTCHA System**: Dynamic anti-bot protection
- **Advanced Username Validation**: Comprehensive rules and reserved word protection
- **Session Persistence**: Users stay logged in across browser sessions

### 🎨 UI/UX Improvements
- **Enhanced Login Screen**: Professional authentication interface
- **Real-time Validation**: Instant feedback on form inputs
- **CAPTCHA Integration**: Seamless math problem verification
- **Better Error Messages**: Clear, specific validation feedback
- **Security Indicators**: Visual feedback for password strength

### 🛡️ Security Hardening
- **Rate Limiting Enhancement**: Multiple layers of protection
- **Input Sanitization**: Advanced validation for all user inputs
- **Token Verification**: Server-side authentication for all operations
- **Session Security**: Automatic cleanup and token management

### 🐛 Bug Fixes from v2.0
- **Screen sharing connection stability** improved
- **Mobile responsive design** enhanced
- **Audio element management** optimized
- **WebRTC connection handling** more robust

## 📞 Support

Having issues? 
- Check the [Issues](https://github.com/izzethannn/memochat-backend/issues) page
- Create a new issue with details
- Join our [Discord](https://discord.gg/your-link) for community support

## 🔒 Security Disclosure

If you discover a security vulnerability, please send an email to [security@yourproject.com]. All security vulnerabilities will be promptly addressed.

## 🙏 Acknowledgments

- Socket.IO team for real-time capabilities
- WebRTC community for voice/video foundations
- Railway for easy deployment
- JWT.io for authentication standards
- bcrypt team for secure password hashing
- All contributors and testers
- Security researchers who provided feedback

---

**Made with ❤️ for secure, seamless communication**

⭐ **Star this repo if you found the enhanced security features helpful!** ⭐

## 🚀 Upgrade from v2.0

If you're upgrading from v2.0 to v2.1:

### Required Changes
1. **Update app.js**: Replace with the new enhanced version
2. **Environment Variables**: Add `JWT_SECRET` and `BCRYPT_ROUNDS`
3. **Database Preparation**: Consider adding persistent storage for users
4. **Frontend Updates**: HTML includes new login screen and CAPTCHA elements

### Migration Steps
```bash
# 1. Backup your current version
cp app.js app.js.backup

# 2. Update app.js with new enhanced version
# 3. Update environment variables
echo "JWT_SECRET=your-32-character-secret-key-here" >> .env
echo "BCRYPT_ROUNDS=10" >> .env

# 4. Restart server
npm restart
```

### New User Experience
- Users will see a login screen on first visit
- Registration requires username/password + CAPTCHA
- Existing anonymous sessions will need to create accounts
- All features remain the same after authentication

### Compatibility Notes
- Existing rooms will continue to work
- Volume controls and screen sharing unchanged
- New authentication layer is required for access
- Mobile experience improved with responsive login
