# 📝 MemoChat

A real-time voice chat and screen sharing application built with Node.js, Socket.IO, and WebRTC.

![MemoChat Demo](https://img.shields.io/badge/Status-Live-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v18+-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7-red)

## ✨ Features

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
- Modern web browser

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

1. **Enter your name** in the sidebar
2. **Choose a room:**
   - 🏠 **General Chat** - Open discussions
   - 🎮 **Gaming** - For gamers
   - 📚 **Study Group** - Quiet study sessions
   - 🎵 **Music & Chill** - Music listening parties
   - 🔒 **Private Room** - Private conversations
3. **Click "Join Voice Chat"**
4. **Start talking!** Use the controls to mute/unmute or share your screen

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Real-time:** Socket.IO
- **Voice/Video:** WebRTC
- **Security:** Helmet, CORS, Rate Limiting
- **Frontend:** HTML5, CSS3, Vanilla JavaScript

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/rooms` | GET | List all active rooms |
| `/api/room/:name` | GET | Get specific room info |

## 🔌 Socket Events

### Client → Server
- `join-room` - Join a voice chat room
- `leave-room` - Leave current room  
- `chat-message` - Send text message
- `user-status` - Update mute/screen share status
- `offer/answer/ice-candidate` - WebRTC signaling

### Server → Client
- `room-joined` - Successfully joined room
- `user-joined/left` - User presence updates
- `chat-message` - New message received
- `user-status-update` - Status changes

## 🔧 Configuration

Create a `.env` file:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚢 Deployment

### Railway (Recommended)
1. Connect your GitHub repository
2. Deploy automatically
3. Get your live URL

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

- Voice chat requires WebRTC peer connections (signaling implemented)
- Screen sharing detection works, video streaming in development
- Mobile browser compatibility varies

## 🔮 Future Features

- [ ] File sharing in chat
- [ ] Voice recording and playback
- [ ] Custom room creation
- [ ] User profiles and avatars
- [ ] Mobile app (React Native)
- [ ] End-to-end encryption

## 📞 Support

Having issues? 
- Check the [Issues](https://github.com/izzethannn/memochat-backend/issues) page
- Create a new issue with details
- Join our [Discord](https://discord.gg/your-link) for community support

## 🙏 Acknowledgments

- Socket.IO team for real-time capabilities
- WebRTC community for voice chat foundations
- Railway for easy deployment
- All contributors and testers

---

**Made with ❤️ for seamless communication**

⭐ **Star this repo if you found it helpful!** ⭐
