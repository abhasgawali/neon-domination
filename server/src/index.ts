import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../../shared/types';
import { GameManager } from './gameManager';

const app = express();

// CORS configuration - allow localhost for dev and production URLs from env
const getAllowedOrigins = (): string[] => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .map(origin => origin.replace(/\/$/, '')); // Remove trailing slashes
  }
  return ["http://localhost:5173", "http://localhost:3000"];
};

const allowedOrigins = getAllowedOrigins();

// Log allowed origins in production for debugging
if (process.env.NODE_ENV === 'production') {
  console.log('Allowed CORS origins:', allowedOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const httpServer = createServer(app);

// Initialize Socket.io with Shared Types
// CORS configuration for Socket.io - must match Express CORS

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`Socket.io CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize Game Logic
const gameManager = new GameManager(io);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Join Game
  socket.on("joinGame", (name: string, roomId?: string) => {
    gameManager.handlePlayerJoin(socket, name, roomId);
  });

  // 2. Tile Interactions (Conquer / Mine)
  socket.on("interactTile", (tileId, action) => {
    gameManager.handleTileInteraction(socket, tileId, action);
  });

  // 3. Sun Collection
  socket.on("collectSun", (sunId) => {
    gameManager.handleSunCollection(socket, sunId);
  });

  // 4. Global Shield
  socket.on("activateGlobalShield", () => {
    gameManager.handleGlobalShield(socket);
  });

  // 5. Start Game Options
  socket.on("startGameWithBots", () => {
    gameManager.handleStartGameWithBots(socket);
  });

  socket.on("startGameSolo", () => {
    gameManager.handleStartGameSolo(socket);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    gameManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Neon Dominion Server running on port ${PORT}`);
});