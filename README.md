# Neon Dominion

A production-ready multiplayer real-time strategy game built with TypeScript, React, Express, and Socket.io.

## 🏗️ Project Structure

```
neon-dominion/
├── client/          # React + Vite frontend
├── server/          # Express + Socket.io backend
└── shared/          # Shared TypeScript types
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- TypeScript knowledge

### Installation

1. **Install Shared Dependencies:**
   ```bash
   cd neon-dominion/shared
   npm install
   ```

2. **Install Server Dependencies:**
   ```bash
   cd ../server
   npm install
   cp .env.example .env
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Running the Application

**Terminal 1 - Start the Server:**
```bash
cd neon-dominion/server
npm run dev
```

The server will start on `http://localhost:3000`

**Terminal 2 - Start the Client:**
```bash
cd neon-dominion/client
npm run dev
```

The client will start on `http://localhost:5173`

## 📦 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.io Client** - Real-time communication
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Socket.io** - WebSocket server
- **TypeScript** - Type safety
- **UUID** - Unique ID generation

### Shared
- **TypeScript** - Shared type definitions

## 🎮 Game Features

- **Real-time Multiplayer** - Play with up to 4 players
- **Energy Management** - Strategic resource management
- **Click Cooldowns** - Anti-cheat protection
- **Tile Claiming** - Expand your territory
- **Combat System** - Attack enemy tiles
- **Shields** - Protect your tiles temporarily
- **Mines** - Strategic defense placement

## 🛠️ Development

### Type Checking

```bash
# Check all projects
cd neon-dominion/shared && npm run typecheck
cd ../server && npm run typecheck
cd ../client && npm run typecheck
```

### Building

```bash
# Build server
cd neon-dominion/server
npm run build

# Build client
cd neon-dominion/client
npm run build
```

## 📝 Environment Variables

### Server (.env)
```
PORT=3000
NODE_ENV=development
```

### Client
Create a `.env` file in the client folder:
```
VITE_SERVER_URL=http://localhost:3000
```

## 🏛️ Architecture

### Game Manager
The `GameManager` class handles:
- Room management (in-memory)
- Player actions with validation
- Energy consumption
- Action cooldowns (500ms minimum)
- Game state synchronization

### State Management
- **Zustand Store** - Centralized game state
- **Socket Service** - Singleton for Socket.io connection
- **Real-time Updates** - Automatic state synchronization

## 🔒 Security Features

- Action cooldown system (prevents spam)
- Energy validation (prevents cheating)
- Server-side game logic validation
- Timestamp-based anti-cheat checks

## 📄 License

ISC
