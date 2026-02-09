import { create } from 'zustand';
import { GameState } from '../../../shared/types';

interface GameStore {
  isConnected: boolean;
  roomId: string | null;
  playerId: string | null;
  gameState: GameState | null;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setRoomInfo: (roomId: string, playerId: string) => void;
  updateGameState: (state: GameState) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  isConnected: false,
  roomId: null,
  playerId: null,
  gameState: null,

  setConnected: (connected) => set({ isConnected: connected }),
  setRoomInfo: (roomId, playerId) => set({ roomId, playerId }),
  updateGameState: (state) => set({ gameState: state }),
  reset: () => set({ roomId: null, playerId: null, gameState: null }),
}));