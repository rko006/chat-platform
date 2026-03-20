# ChatFlow — Production-Ready Real-Time Chat Platform

A full-featured messaging application similar to Instagram DMs and WhatsApp, built with modern technologies.

---

## Features

**Messaging**
- Private 1-on-1 messaging
- Group chats with admin controls
- Message replies, edit, and delete (for everyone / for me)
- Message reactions (emoji)
- Message forwarding
- Full-text message search
- Pin messages and conversations
- Archive conversations

**Media**
- Image, video, audio, and file sharing (up to 50MB)
- In-line image lightbox
- Audio player with waveform progress
- Drag-and-drop file upload

**Real-Time**
- WebSocket-powered live messaging via Socket.IO
- Typing indicators with debounce
- Online/offline presence
- Message delivered and seen receipts

**UI/UX**
- Dark mode toggle (system preference + manual)
- Mobile-responsive (full-screen on mobile, split-panel on desktop)
- Unread message counters
- Optimistic UI (messages appear instantly)
- Infinite scroll pagination for message history

**Security**
- JWT authentication with refresh token rotation
- bcrypt password hashing (12 rounds)
- Rate limiting on all API endpoints (stricter on auth)
- Helmet security headers
- CORS protection
- Input validation on all endpoints
- Optional client-side E2E encryption (Web Crypto API / ECDH + AES-GCM)

**Infrastructure**
- Redis caching for sessions, online status, conversation lists
- AWS S3-compatible file storage (supports MinIO locally)
- Firebase Cloud Messaging push notifications
- MongoDB with proper indexes for performance
- Docker + Docker Compose for all services
- Winston structured logging

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| State | Zustand + React Context |
| Real-time | Socket.IO (client + server) |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB 7 + Mongoose |
| Cache | Redis 7 |
| File Storage | AWS S3 / MinIO |
| Auth | JWT + bcrypt |
| Notifications | Firebase Cloud Messaging |
| Deployment | Docker, Nginx, Docker Compose |

---

## Project Structure

```
chat-platform/
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatSidebar/  # Conversation list, search, new chat modal
│   │   │   ├── Conversation/ # Message area with infinite scroll
│   │   │   ├── MessageBubble/# Messages with reactions, replies, context menu
│   │   │   ├── MessageInput/ # Rich input: emoji, file upload, voice
│   │   │   ├── TypingIndicator/
│   │   │   ├── EmojiPicker/
│   │   │   ├── FileUploader/
│   │   │   └── common/       # Avatar, LoadingScreen
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ChatContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Chat.tsx
│   │   ├── services/
│   │   │   ├── api.ts        # Axios client with token refresh
│   │   │   └── socket.ts     # Socket.IO client
│   │   ├── types/index.ts
│   │   └── utils/
│   │       ├── formatDate.ts
│   │       └── encryption.ts # E2E encryption helpers
│   ├── Dockerfile
│   └── nginx.conf
│
├── server/                   # Node.js backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts   # MongoDB connection
│   │   │   └── redis.ts      # Redis + cache helpers + online status
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── chatController.ts
│   │   │   ├── messageController.ts
│   │   │   └── userController.ts
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Conversation.ts
│   │   │   └── Message.ts
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── chatRoutes.ts
│   │   │   ├── messageRoutes.ts
│   │   │   ├── userRoutes.ts
│   │   │   └── mediaRoutes.ts
│   │   ├── services/
│   │   │   └── notificationService.ts
│   │   ├── socket/
│   │   │   └── socketServer.ts  # All real-time event handlers
│   │   ├── utils/
│   │   │   └── logger.ts
│   │   └── server.ts
│   └── Dockerfile
│
├── scripts/
│   └── mongo-init.js
├── docker-compose.yml        # Production compose
├── docker-compose.dev.yml    # Development overrides
└── package.json              # Root monorepo scripts
```

---

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
# 1. Clone and enter directory
git clone https://github.com/yourname/chat-platform.git
cd chat-platform

# 2. Create environment file
cp server/.env.example server/.env
# Edit server/.env with your values

# 3. Start all services (MongoDB, Redis, MinIO, server, client)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 4. Open http://localhost:3000
```

### Option 2: Manual Setup

**Prerequisites:** Node.js 20+, MongoDB, Redis

```bash
# Install all dependencies
npm run install:all

# Copy and configure environment
cp server/.env.example server/.env
# Edit server/.env

# Start both server and client with hot reload
npm run dev
```

Server runs on **http://localhost:5000**
Client runs on **http://localhost:3000**

---

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in:

| Variable | Description | Required |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Yes |
| `JWT_REFRESH_SECRET` | Refresh token secret | Yes |
| `AWS_ACCESS_KEY_ID` | AWS/MinIO access key | For media |
| `AWS_SECRET_ACCESS_KEY` | AWS/MinIO secret key | For media |
| `AWS_BUCKET_NAME` | S3 bucket name | For media |
| `FIREBASE_PROJECT_ID` | Firebase project | For push notifications |

---

## API Reference

### Auth
```
POST /api/auth/register     Register new user
POST /api/auth/login        Login
POST /api/auth/logout       Logout (requires auth)
POST /api/auth/refresh      Refresh access token
GET  /api/auth/me           Get current user
PATCH /api/auth/fcm-token   Update push notification token
```

### Conversations
```
GET    /api/chats                    List conversations
POST   /api/chats/direct             Create/get direct conversation
POST   /api/chats/group              Create group
GET    /api/chats/:id                Get conversation by ID
PATCH  /api/chats/:id/pin            Pin/unpin
PATCH  /api/chats/:id/archive        Archive/unarchive
POST   /api/chats/:id/members        Add group members
DELETE /api/chats/:id/leave          Leave group
```

### Messages
```
GET    /api/messages/:conversationId  Get messages (paginated)
POST   /api/messages/send             Send message
PATCH  /api/messages/:id              Edit message
DELETE /api/messages/:id              Delete message
POST   /api/messages/:id/react        Add/remove reaction
POST   /api/messages/:id/forward      Forward message
GET    /api/messages/search           Full-text search
POST   /api/messages/conversations/:id/seen  Mark as seen
PATCH  /api/messages/:id/pin          Pin/unpin message
```

### Users
```
GET   /api/users/search           Search users
GET   /api/users/:id              Get user profile
PATCH /api/users/me/profile       Update profile
PATCH /api/users/me/password      Change password
PATCH /api/users/me/notifications Update notification settings
PATCH /api/users/:id/block        Block/unblock user
```

### Media
```
POST   /api/media/upload   Upload file (multipart/form-data)
DELETE /api/media/delete   Delete uploaded file
```

---

## Socket.IO Events

### Client → Server
```
join_conversation       { conversationId }
leave_conversation      { conversationId }
send_message            { conversationId, text, messageType, ... }
typing                  { conversationId }
stop_typing             { conversationId }
message_seen            { conversationId, messageIds[] }
add_reaction            { messageId, emoji, conversationId }
remove_reaction         { messageId, conversationId }
edit_message            { messageId, text, conversationId }
delete_message          { messageId, conversationId, deleteFor }
```

### Server → Client
```
receive_message         Message object
message_sent            { messageId, tempId }
message_delivered       { messageId, userId }
messages_seen           { conversationId, messageIds[], seenBy }
typing                  { userId, username, conversationId }
stop_typing             { userId, conversationId }
user_online             { userId }
user_offline            { userId, lastSeen }
reaction_updated        { messageId, reactions[] }
message_edited          { messageId, text, editedAt }
message_deleted         { messageId, conversationId, deleteFor }
```

---

## Deployment

### Frontend → Vercel
```bash
cd client
npm run build
# Deploy dist/ to Vercel
```

### Backend → Render / Railway
- Set all environment variables in dashboard
- Use `npm start` as start command

### Full Stack → Docker
```bash
# Production
docker-compose up -d --build

# View logs
docker-compose logs -f server

# Scale server (if using load balancer + Redis adapter)
docker-compose up -d --scale server=3
```

---

## Performance

- **Redis caching**: Conversation lists cached 30s, invalidated on mutations
- **Pagination**: Messages load 30 at a time with cursor-based pagination
- **Socket rooms**: Each conversation is a Socket.IO room — messages only sent to relevant clients
- **MongoDB indexes**: All query patterns indexed (conversationId + createdAt, senderId, text search)
- **Optimistic UI**: Messages appear instantly in UI before server confirmation
- **Image lazy loading**: Images load as they scroll into view

---

## Security

- Passwords hashed with bcrypt (12 salt rounds)
- JWT access tokens expire in 7 days; refresh tokens in 30 days
- Refresh token rotation — old token invalidated on every refresh
- Auth rate limiting: 10 attempts per 15 minutes
- All routes require valid JWT except register/login
- File uploads validated by MIME type, capped at 50MB
- Uploaded files namespaced by user ID (no cross-user deletion)
- Helmet sets 9 security headers including CSP
- CORS restricted to configured CLIENT_URL

---

## License

MIT — use freely for personal and commercial projects.
