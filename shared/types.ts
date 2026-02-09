// ================= USER & PLAYER =================

export interface Player {
  id: string;          // Socket ID
  name: string;        // "Commander X"
  color: string;       // Hex Code
  energy: number;      // Current resource
  score: number;       // Tiles owned
  lastActionTimestamp: number; // ANTI-SPAM: Timestamp of last move
}

// ================= GAME BOARD =================

export interface Tile {
  id: number;             // Index 0 to 95
  ownerId: string | null; // Socket ID of owner
  shieldExpiresAt: number;// Timestamp (0 if no shield)
  hasMine: boolean;       // Is there a hidden trap?
}

export interface GameState {
  roomId: string;
  players: Record<string, Player>; // Map of socketId -> Player
  grid: Tile[];
  status: 'waiting' | 'playing' | 'ended';
  timeRemaining: number; // Seconds
  winnerId: null | string;
}

// ================= SOCKET EVENTS =================

export interface ServerToClientEvents {
  // Broadcasts
  gameStateUpdate: (state: GameState) => void;
  
  // Visual FX
  tileEffect: (tileId: number, type: 'blast' | 'shield' | 'mine') => void;
  spawnSun: (id: string, xPercent: number) => void; 
  
  // Direct Messages
  error: (msg: string) => void;
  joinedRoom: (roomId: string, playerId: string) => void;
  gameOver: (winnerId: string) => void;
  lobbyTimerExpired: () => void;
}

export interface ClientToServerEvents {
  // Updated to accept an optional roomId
  joinGame: (name: string, roomId?: string) => void;
  interactTile: (tileId: number, action: 'conquer' | 'mine') => void;
  collectSun: (sunId: string) => void;
  activateGlobalShield: () => void;
  startGameWithBots: () => void;
  startGameSolo: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  roomId: string;
}