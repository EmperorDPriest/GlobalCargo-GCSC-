# Global Cargo Shipping Company (GCSC)

A comprehensive web platform for Global Cargo Shipping Company, providing shipment tracking, live customer support chat, and administrative management tools. Built with a modern full-stack architecture featuring real-time communication capabilities.

## 🚀 Features

- **Shipment Tracking**: Real-time tracking and management of shipments with detailed status updates
- **Live Chat System**: Integrated customer support chat with Socket.IO for real-time messaging
- **Admin Dashboard**: Comprehensive administrative interface for managing shipments, chats, and users
- **Responsive Design**: Mobile-friendly frontend with 22+ public pages
- **Secure Authentication**: JWT-based authentication for admin access
- **Email Notifications**: Automated email services for customer communications
- **API Integration**: RESTful APIs for seamless third-party integrations

## 🛠 Tech Stack

### Backend
- **Node.js** (v18+)
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Nodemailer** - Email service

### Frontend
- **HTML5/CSS3** - Static pages
- **JavaScript (ES6+)** - Client-side logic
- **Socket.IO Client** - Real-time chat widget

### Deployment
- **Render** - Backend hosting
- **Netlify** - Frontend hosting

## 📋 Prerequisites

- Node.js (v18.0.0 or higher)
- MongoDB Atlas account (or local MongoDB instance)
- Git

## 🔧 Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd gcsc-main
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Frontend Setup:**
   - No installation required - static files
   - For development, use Live Server extension in VS Code

## ⚙️ Configuration

Create a `.env` file in the `backend/` directory with the following variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Random string (32+ characters) for JWT signing |
| `ADMIN_EMAIL` | Optional | Default admin email for seeding |
| `ADMIN_PASSWORD` | Optional | Default admin password for seeding |
| `FRONTEND_URL` | Optional | Frontend URL for CORS (production) |
| `PORT` | Optional | Server port (default: 5000) |

## 🚀 Running the Application

### Development
```bash
# Backend
cd backend
npm run dev

# Frontend
# Open frontend/index.html in browser or use Live Server
```

### Production
```bash
# Backend
cd backend
npm start

# Frontend: Deploy static files to Netlify or similar
```

## 📦 Deployment

### Backend (Render)
- Use the provided `render.yaml` configuration
- Set environment variables in Render dashboard
- Deploy from GitHub repository

### Frontend (Netlify)
- Connect repository to Netlify
- Set build command: (none - static)
- Publish directory: `frontend/`

## 📚 API Documentation

### Authentication
- `POST /api/auth/login` - Admin login

### Shipments
- `GET /api/shipments` - Get all shipments
- `POST /api/shipments` - Create shipment
- `GET /api/shipments/:id` - Get shipment details

### Chat
- `GET /api/chat/sessions` - Get chat sessions
- `POST /api/chat/message` - Send message

### Admin
- `GET /api/admin/dashboard` - Dashboard data
- `POST /api/admin/users` - Manage users

For detailed Socket.IO events, see the chat system documentation below.

## 💬 Chat System

### Socket Events

**Customer Events:**
- `customer_join_chat` - Join chat session
- `customer_send_message` - Send message
- `customer_typing` - Typing indicator

**Admin Events:**
- `admin_join_chat` - Join admin room
- `admin_send_message` - Send message to customer
- `admin_assign_chat` - Assign chat to admin

**Real-time Updates:**
- `receive_message` - New message notification
- `chat_status_update` - Chat status changes
- `typing_indicator` - Typing status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Contact

Global Cargo Shipping Company
- Website: [globalcargo360.com](https://globalcargo360.com)
- Email: info@globalcargo360.com

---

**Version:** 5.2.0
**Last Updated:** March 2026
| emit | `admin_send_message` | `{ sessionId, message }` |
| emit | `admin_typing` | `{ sessionId, isTyping }` |
| emit | `admin_assign_chat` | `{ sessionId }` |
| emit | `admin_close_chat` | `{ sessionId }` |
| emit | `admin_reopen_chat` | `{ sessionId }` |
| emit | `message_read` | `{ sessionId }` |

---

## Chat REST API

All endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/chats` | All sessions (no messages) |
| GET | `/api/chats/stats` | `{ waiting, active, closed, total }` |
| GET | `/api/chats/:sessionId` | Full session + messages |
| PATCH | `/api/chats/:sessionId/status` | Update status |
| PATCH | `/api/chats/:sessionId/assign` | Assign to current admin |
| DELETE | `/api/chats/:sessionId` | Delete closed session |

---

## Deployment

### Backend — Render / Railway / Fly.io
Set all environment variables in the dashboard. Start command: `npm start`.

### Frontend — Netlify
Drag & drop the `frontend/` folder. The `netlify.toml` is already configured.

Update `frontend/config.js` with your deployed backend URL:
```js
API_BASE_URL: 'https://your-api.onrender.com/api',
SOCKET_URL:   'https://your-api.onrender.com',
```
