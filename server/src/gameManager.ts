import { Server, Socket } from 'socket.io';
import { GameState, Player, Tile, ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

const GRID_ROWS = 8;
const GRID_COLS = 12;
const MAX_PLAYERS_PER_ROOM = 4;
const GAME_DURATION = 180;
const ACTION_COOLDOWN_MS = 100;

const COSTS = {
  conquer: 10,
  shield: 100,
  mine: 60
};

export class GameManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private rooms: Map<string, GameState> = new Map();
  private socketRoomMap: Map<string, string> = new Map();
  private activeSuns: Map<string, string[]> = new Map();
  private lobbyTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.startGameLoop();
  }

  private startGameLoop() {
    setInterval(() => {
      this.rooms.forEach((state, roomId) => {
        if (state.status === 'playing') {
          state.timeRemaining -= 0.1;

          if (Math.random() < 0.03) {
            const sunId = uuidv4();
            const xPos = Math.random() * 90;
            if (!this.activeSuns.has(roomId)) this.activeSuns.set(roomId, []);
            this.activeSuns.get(roomId)?.push(sunId);
            this.io.to(roomId).emit('spawnSun', sunId, xPos);
          }

          if (state.timeRemaining <= 0) {
            this.endGame(roomId);
          } else if (Math.floor(state.timeRemaining * 10) % 5 === 0) {
            this.io.to(roomId).emit('gameStateUpdate', state);
          }
        }
      });
    }, 100);
  }

  public handlePlayerJoin(socket: Socket, name: string, roomId?: string) {
    let targetRoomId: string | null | undefined = roomId;

    if (targetRoomId) {
      if (!this.rooms.has(targetRoomId)) {
        this.createRoom(targetRoomId);
      }
    } else {
      targetRoomId = this.findAvailableRoom();
      if (!targetRoomId) {
        targetRoomId = uuidv4().slice(0, 6).toUpperCase();
        this.createRoom(targetRoomId);
      }
    }

    const room = this.rooms.get(targetRoomId!)!;

    const players = Object.values(room.players);
    if (players.length >= MAX_PLAYERS_PER_ROOM) {
      const botId = Object.keys(room.players).find(pid => pid.startsWith('bot_'));
      if (botId) {
        room.grid.forEach(t => {
          if (t.ownerId === botId) {
            t.ownerId = null;
            t.hasMine = false;
            t.shieldExpiresAt = 0;
          }
        });
        delete room.players[botId];
      } else {
        socket.emit('error', 'Room is full!');
        return;
      }
    }

    const colors = ['#0ea5e9', '#ef4444', '#10b981', '#8b5cf6'];
    const takenColors = Object.values(room.players).map(p => p.color);
    const color = colors.find(c => !takenColors.includes(c)) || '#ffffff';

    const newPlayer: Player = {
      id: socket.id,
      name: name.substring(0, 12) || "Commander",
      color,
      energy: 50,
      score: 0,
      lastActionTimestamp: 0
    };

    room.players[socket.id] = newPlayer;
    this.socketRoomMap.set(socket.id, targetRoomId!);
    socket.join(targetRoomId!);

    const freeTiles = room.grid.filter(t => t.ownerId === null);
    if (freeTiles.length > 0) {
      const base = freeTiles[Math.floor(Math.random() * freeTiles.length)];
      base.ownerId = socket.id;
      newPlayer.score = 1;
    }

    socket.emit('joinedRoom', targetRoomId!, socket.id);
    this.io.to(targetRoomId!).emit('gameStateUpdate', room);

    if (room.status === 'waiting' && Object.keys(room.players).length === 1) {
      this.startLobbyTimer(targetRoomId!);
    } else if (Object.keys(room.players).length >= 2) {
      this.cancelLobbyTimer(targetRoomId!);
      if (room.status === 'waiting') {
        room.status = 'playing';
        this.io.to(targetRoomId!).emit('gameStateUpdate', room);
      }
    }
  }

  private startLobbyTimer(roomId: string) {
    this.cancelLobbyTimer(roomId);

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && room.status === 'waiting' && Object.keys(room.players).length === 1) {
        this.io.to(roomId).emit('lobbyTimerExpired');
      }
      this.lobbyTimers.delete(roomId);
    }, 15000);

    this.lobbyTimers.set(roomId, timer);
  }

  private cancelLobbyTimer(roomId: string) {
    const timer = this.lobbyTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.lobbyTimers.delete(roomId);
    }
  }

  public handleStartGameWithBots(socket: Socket) {
    const roomId = this.socketRoomMap.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return;

    this.cancelLobbyTimer(roomId);

    const botCount = Math.min(3, MAX_PLAYERS_PER_ROOM - Object.keys(room.players).length);
    const colors = ['#0ea5e9', '#ef4444', '#10b981', '#8b5cf6'];
    const takenColors = Object.values(room.players).map(p => p.color);
    const availableColors = colors.filter(c => !takenColors.includes(c));

    for (let i = 0; i < botCount; i++) {
      const botId = `bot_${roomId}_${i}`;
      const botColor = availableColors[i] || '#ffffff';

      const bot: Player = {
        id: botId,
        name: `Bot ${i + 1}`,
        color: botColor,
        energy: 50,
        score: 0,
        lastActionTimestamp: 0
      };

      room.players[botId] = bot;

      const freeTiles = room.grid.filter(t => t.ownerId === null);
      if (freeTiles.length > 0) {
        const base = freeTiles[Math.floor(Math.random() * freeTiles.length)];
        base.ownerId = botId;
        bot.score = 1;
      }
    }

    room.status = 'playing';
    this.io.to(roomId).emit('gameStateUpdate', room);
  }

  public handleStartGameSolo(socket: Socket) {
    const roomId = this.socketRoomMap.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return;

    this.cancelLobbyTimer(roomId);
    room.status = 'playing';
    this.io.to(roomId).emit('gameStateUpdate', room);
  }

  public handleTileInteraction(socket: Socket, tileId: number, action: 'conquer' | 'mine') {
    const roomId = this.socketRoomMap.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId)!;
    const player = room.players[socket.id];
    const tile = room.grid[tileId];

    if (!player || !tile) return;

    const now = Date.now();
    if (now - player.lastActionTimestamp < ACTION_COOLDOWN_MS) return;
    player.lastActionTimestamp = now;

    const cost = COSTS[action];
    if (player.energy < cost) {
      socket.emit('error', "Not enough energy!");
      return;
    }

    if (action === 'conquer') {
      if (tile.ownerId === player.id) {
        socket.emit('error', "You already own this tile!");
        return;
      }

      const neighbors = this.getNeighbors(tileId, room.grid);
      const hasBase = room.grid.some(t => t.ownerId === player.id);
      const isNeighbor = neighbors.some(n => n.ownerId === player.id);

      if (hasBase && !isNeighbor) {
        socket.emit('error', "Must be adjacent to your territory!");
        socket.emit('tileEffect', tileId, 'shield');
        return;
      }

      if (tile.shieldExpiresAt > Date.now()) {
        socket.emit('error', "Tile is shielded!");
        socket.emit('tileEffect', tileId, 'shield');
        return;
      }

      if (tile.hasMine && tile.ownerId !== null && tile.ownerId !== player.id) {
        const bombOwnerId = tile.ownerId;
        const bombOwner = room.players[bombOwnerId];

        const totalCost = cost + 30;
        if (player.energy < totalCost) {
          socket.emit('error', "Not enough energy! (Need 40 total: 10 attack + 30 mine penalty)");
          return;
        }

        player.energy -= totalCost;

        tile.hasMine = false;
        tile.ownerId = null;
        if (bombOwner) bombOwner.score--;

        this.io.to(roomId).emit('tileEffect', tileId, 'mine');

        neighbors.forEach(n => {
          if (n.ownerId === player.id) {
            n.ownerId = bombOwnerId;
            player.score--;
            if (bombOwner) {
              bombOwner.score++;
            }
            this.io.to(roomId).emit('tileEffect', n.id, 'blast');
          }
        });

        this.io.to(roomId).emit('gameStateUpdate', room);
        return;
      }

      player.energy -= cost;

      if (tile.ownerId && room.players[tile.ownerId]) {
        room.players[tile.ownerId].score--;
      }
      tile.ownerId = player.id;
      player.score++;
      tile.hasMine = false;

      this.io.to(roomId).emit('tileEffect', tileId, 'blast');
    } else if (action === 'mine') {
      if (tile.ownerId !== player.id) return;
      if (tile.hasMine) return;

      player.energy -= cost;
      tile.hasMine = true;
    }

    this.io.to(roomId).emit('gameStateUpdate', room);
  }

  public handleGlobalShield(socket: Socket) {
    const roomId = this.socketRoomMap.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId)!;
    const player = room.players[socket.id];

    if (player.energy < COSTS.shield) {
      socket.emit('error', "Not enough energy!");
      return;
    }

    player.energy -= COSTS.shield;
    const expiry = Date.now() + 15000;

    room.grid.forEach(t => {
      if (t.ownerId === player.id) {
        t.shieldExpiresAt = expiry;
      }
    });

    this.io.to(roomId).emit('gameStateUpdate', room);
  }

  public handleSunCollection(socket: Socket, sunId: string) {
    const roomId = this.socketRoomMap.get(socket.id);
    if (!roomId) return;

    const suns = this.activeSuns.get(roomId);
    if (suns && suns.includes(sunId)) {
      const player = this.rooms.get(roomId)!.players[socket.id];
      if (player) {
        player.energy += 25;
        this.activeSuns.set(roomId, suns.filter(id => id !== sunId));
        this.io.to(roomId).emit('gameStateUpdate', this.rooms.get(roomId)!);
      }
    }
  }

  private findAvailableRoom(): string | null {
    for (const [id, state] of this.rooms) {
      if (state.status !== 'ended') {
        const playerCount = Object.keys(state.players).length;
        const botCount = Object.keys(state.players).filter(pid => pid.startsWith('bot_')).length;

        if (playerCount < MAX_PLAYERS_PER_ROOM || botCount > 0) {
          return id;
        }
      }
    }
    return null;
  }

  private createRoom(id: string) {
    const grid: Tile[] = [];
    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
      grid.push({ id: i, ownerId: null, shieldExpiresAt: 0, hasMine: false });
    }

    this.rooms.set(id, {
      roomId: id,
      players: {},
      grid: grid,
      status: 'waiting',
      timeRemaining: GAME_DURATION,
      winnerId: null
    });
  }

  private getNeighbors(index: number, grid: Tile[]) {
    const r = Math.floor(index / GRID_COLS);
    const c = index % GRID_COLS;
    const neighbors: Tile[] = [];

    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    directions.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        neighbors.push(grid[nr * GRID_COLS + nc]);
      }
    });
    return neighbors;
  }

  private endGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.status = 'ended';
    room.timeRemaining = 0;

    let maxScore = -1;
    let maxEnergy = -1;
    let winnerId = "";

    Object.values(room.players).forEach(p => {
      if (p.score > maxScore || (p.score === maxScore && p.energy > maxEnergy)) {
        maxScore = p.score;
        maxEnergy = p.energy;
        winnerId = p.id;
      }
    });

    const winner = room.players[winnerId];
    room.winnerId = winner ? winner.name : "";

    this.io.to(roomId).emit('gameStateUpdate', room);
    this.io.to(roomId).emit('gameOver', room.winnerId || "");
  }

  public handleDisconnect(socket: Socket) {
    const roomId = this.socketRoomMap.get(socket.id);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        delete room.players[socket.id];
        this.socketRoomMap.delete(socket.id);

        if (Object.keys(room.players).length === 0) {
          this.rooms.delete(roomId);
          this.cancelLobbyTimer(roomId);
          this.activeSuns.delete(roomId);
        } else {
          this.io.to(roomId).emit('gameStateUpdate', room);
        }
      }
    }
  }
}