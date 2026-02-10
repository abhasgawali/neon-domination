export interface Player {
  id: string;
  name: string;
  color: string;
  energy: number;
  score: number;
  lastActionTimestamp: number;
}

export interface Tile {
  id: number;
  ownerId: string | null;
  shieldExpiresAt: number;
  hasMine: boolean;
}

export interface GameState {
  roomId: string;
  players: Record<string, Player>;
  grid: Tile[];
  status: 'waiting' | 'playing' | 'ended';
  timeRemaining: number;
  winnerId: null | string;
}

export interface ServerToClientEvents {
  gameStateUpdate: (state: GameState) => void;
  tileEffect: (tileId: number, type: 'blast' | 'shield' | 'mine') => void;
  spawnSun: (id: string, xPercent: number) => void;
  error: (msg: string) => void;
  joinedRoom: (roomId: string, playerId: string) => void;
  gameOver: (winnerId: string) => void;
  lobbyTimerExpired: () => void;
}

export interface ClientToServerEvents {
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