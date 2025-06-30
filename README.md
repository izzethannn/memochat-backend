# 📝 MemoChat v2.0

A real-time voice chat and screen sharing application built with Node.js, Socket.IO, and WebRTC. Now with enhanced security, volume controls, and spam protection!

![MemoChat Demo](https://img.shields.io/badge/Status-Live-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v18+-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7-red)

## ✨ New Features in v2.0

### 🔐 **Password Protection**
- Create private rooms with custom passwords
- Secure room access with 4+ character passwords
- Share room credentials safely with friends

### 🔊 **Volume Controls**
- **Input Volume Slider**: Adjust your microphone sensitivity
- **Output Volume Slider**: Control how loud you hear others
- Real-time volume adjustment for all audio streams
- Individual volume control for each participant

### 🛡️ **Spam Protection**
- Rate limiting: Max 20 messages per minute per user
- Duplicate message detection
- IP-based request limiting
- Smart message similarity detection

### 📺 **Enhanced Screen Sharing**
- **Full WebRTC Implementation**: Peer-to-peer screen sharing
- **High Quality**: Up to 1080p at 30fps
- **Audio Included**: Share system audio with your screen
- **Multiple Screens**: Support for multiple users sharing simultaneously
- **Visual Indicators**: Glowing borders for active screen shares

## 🎯 Core Features

- 🎤 **Real-time Voice Chat** - Crystal clear audio communication
- 💬 **Text Messaging** - Instant chat with message history
- 📺 **Screen Sharing** - Share your screen with participants
- 🏠 **Multiple Rooms** - Gaming, Study, Music, and Private rooms
- 👥 **User Management** - See who's online, muted, or sharing
- 🔊 **Audio Notifications** - Sound feedback for all actions
- 🛡️ **Security** - Rate limiting and input validation
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

3. **Start the server**
```bash
npm start
```

4. **Open MemoChat**
   - Server runs on `http://localhost:3001`
   - Open the HTML file in your browser
   - Allow microphone access
   - Join a room and start chatting!

## 🌐 Demo

Try the live demo: [Your Railway URL here]

## 🎯 How to Use

### Basic Usage
1. **Enter your name** in the sidebar
2. **Choose a room type:**
   - 🏠 **General Chat** - Open discussions
   - 🎮 **Gaming** - For gamers
   - 📚 **Study Group** - Quiet study sessions
   - 🎵 **Music & Chill** - Music listening parties
   - 🔒 **Private Room** - Basic private conversations
   - 🔐 **Password Protected** - Secure private rooms
3. **Click "Join Voice Chat"**
4. **Adjust volumes** using the sliders in the sidebar
5. **Start talking!** Use the controls to mute/unmute or share your screen

### Creating Password-Protected Rooms
1. **Select "Password Protected"** from the room dropdown
2. **Click "Create Password Protected Room"**
3. **Enter your name and set a password** (minimum 4 characters)
4. **Click "Create Room"**
5. **Share the Room ID and Password** with friends
6. **Copy room info** using the copy button for easy sharing

### Joining Password-Protected Rooms
1. **Select "Password Protected"** from the room dropdown
2. **Enter the Room ID** in the custom room field
3. **Enter the password** provided by the room creator
4. **Click "Join Protected Room"**

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
- **Real-time:** Socket.IO
- **Voice/Video:** WebRTC with STUN servers
- **Security:** Helmet, CORS, Rate Limiting, Password Protection
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Audio Processing:** Web Audio API

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/rooms` | GET | List all active rooms (with protection status) |
| `/api/room/:name` | GET | Get specific room info |

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

## 🔧 Configuration

Create a `.env` file:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

## 🛡️ Security Features

### Rate Limiting
- **API Requests**: 100 requests per 15 minutes per IP
- **Chat Messages**: 20 messages per minute per user
- **Connection Attempts**: Limited by IP

### Spam Protection
- **Message Frequency**: Prevents rapid message sending
- **Duplicate Detection**: Flags repetitive messages
- **Content Filtering**: Basic content sanitization
- **User Throttling**: Temporary restrictions for spammers

### Password Protection
- **Minimum Length**: 4 characters required
- **Room Isolation**: Password-protected rooms are isolated
- **Secure Transmission**: Passwords sent over secure connections

## 🚢 Deployment

### Railway (Recommended)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically
4. Get your live URL

### Other Platforms
- **Render:** Free tier available
- **Heroku:** Paid hosting
- **Google Cloud:** Student credits available

## 🧪 Testing

```bash
# Test the backend
node test_server.js

# Run with development auto-restart
npm run dev

# Test volume controls
# - Join a room and adjust sliders
# - Verify audio level changes

# Test password protection
# - Create a private room
# - Try joining with wrong password
# - Verify access control
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
- Password rooms persist until server restart

## 🔮 Future Features

- [ ] **Real Input Volume Control** using Web Audio API
- [ ] **User Profiles** with avatars and preferences
- [ ] **Room Persistence** with database storage
- [ ] **File Sharing** in chat
- [ ] **Voice Recording** and playback
- [ ] **Mobile App** (React Native)
- [ ] **End-to-end Encryption** for private rooms
- [ ] **Admin Controls** for room management
- [ ] **Custom Themes** and UI customization

## 🆕 Version 2.0 Changelog

### Added
- 🔐 Password-protected private rooms
- 🔊 Input/Output volume sliders
- 🛡️ Advanced spam protection
- 📺 Full WebRTC screen sharing implementation
- 🎨 Enhanced UI with volume controls
- 📋 Room info copy functionality
- 🔔 Improved error messaging
- 📱 Better mobile responsiveness

### Improved
- 🚀 Better WebRTC connection handling
- 🎯 More robust error handling
- 🛡️ Enhanced security measures
- 📊 Better rate limiting
- 🎨 Updated visual design

### Fixed
- 🐛 Screen sharing connection issues
- 🔧 Mobile view navigation
- 📱 Responsive design improvements
- 🔊 Audio element management

## 📞 Support

Having issues? 
- Check the [Issues](https://github.com/izzethannn/memochat-backend/issues) page
- Create a new issue with details
- Join our [Discord](https://discord.gg/your-link) for community support

## 🙏 Acknowledgments

- Socket.IO team for real-time capabilities
- WebRTC community for voice/video foundations
- Railway for easy deployment
- All contributors and testers
- Beta testers who provided feedback on v2.0 features

---

**Made with ❤️ for seamless communication**

⭐ **Star this repo if you found the new features helpful!** ⭐

## 🚀 Upgrade from v1.0

If you're upgrading from v1.0:

1. **Update dependencies**: `npm install`
2. **New environment variables**: Check `.env` example
3. **Database changes**: Room structure updated for passwords
4. **Frontend changes**: New UI elements and controls
5. **API changes**: New endpoints for room creation

### Migration Notes
- Existing rooms will work without passwords
- Volume controls are automatically enabled
- Spam protection is enabled by default
- Screen sharing now uses peer-to-peer connections
