import { useEffect, useState, useRef } from 'react';
import { socket } from './services/socket';
import { useGameStore } from './store/useGameStore';
import { useToastStore } from './components/Toast';
import { HowToPlayModal } from './components/HowToPlayModal';
import { LobbyScreen } from './components/LobbyScreen';
import { ToastContainer } from './components/Toast';
import clsx from 'clsx';

// Audio Context Helper
const playSound = (type: 'sun' | 'attack' | 'mine' | 'shield' | 'blast') => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  if (type === 'sun') {
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  } else if (type === 'attack') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);
  } else if (type === 'shield') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
  } else if (type === 'mine') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
    gain.gain.setValueAtTime(0.3, now);
  } else if (type === 'blast') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.1);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(now + 0.6);
};

export default function App() {
  const { gameState, playerId, setRoomInfo, updateGameState, setConnected } = useGameStore();
  const { addToast } = useToastStore();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isInGame, setIsInGame] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeMode, setActiveMode] = useState<'conquer' | 'mine'>('conquer');
  const [suns, setSuns] = useState<{ id: string; left: number }[]>([]);
  const [immuneTimer, setImmuneTimer] = useState(0);


  const tileRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Socket Listeners
    socket.on('connect', () => {
      console.log('Connected to server!');
      setConnected(true);
      setIsConnecting(false);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
      addToast('Disconnected from server', 'error');
    });

    socket.on('connect_error', () => {
      setIsConnecting(false);
      addToast('Failed to connect to server', 'error');
    });

    socket.on('joinedRoom', (roomId, pid) => {
      console.log('Joined room:', roomId, 'as player:', pid);
      setRoomInfo(roomId, pid);
      setIsInGame(true);
      setIsConnecting(false);
      addToast(`Joined room ${roomId}`, 'success');
    });

    socket.on('gameStateUpdate', (state) => {
      updateGameState(state);
      // Check for shield expiry to update UI timer
      const myTiles = state.grid.filter(t => t.ownerId === playerId);
      if (myTiles.length > 0 && myTiles[0].shieldExpiresAt > Date.now()) {
        setImmuneTimer(Math.ceil((myTiles[0].shieldExpiresAt - Date.now()) / 1000));
      } else {
        setImmuneTimer(0);
      }
    });

    socket.on('tileEffect', (tileId, type) => {
      playSound(type === 'mine' ? 'blast' : type);
      const el = tileRefs.current.get(tileId);
      if (el) {
        if (type === 'blast' || type === 'mine') {
          el.classList.add('animate-blast', 'animate-shake');
          setTimeout(() => el.classList.remove('animate-blast', 'animate-shake'), 400);

          // Shake entire board on bomb blast
          if (type === 'mine' && boardRef.current) {
            boardRef.current.classList.add('animate-board-shake');
            setTimeout(() => {
              boardRef.current?.classList.remove('animate-board-shake');
            }, 500);
          }
        } else if (type === 'shield') {
          el.style.transform = "scale(0.9)";
          setTimeout(() => el.style.transform = "", 100);
        }
      }
    });

    socket.on('spawnSun', (id, x) => {
      setSuns(prev => [...prev, { id, left: x }]);
    });

    socket.on('error', (msg) => {
      addToast(msg, 'error');
      // Shake board on rule violation
      if (boardRef.current) {
        boardRef.current.classList.add('animate-board-shake');
        setTimeout(() => {
          boardRef.current?.classList.remove('animate-board-shake');
        }, 500);
      }
    });

    socket.on('gameOver', (winnerId) => {
      addToast(`Game Over! Winner: ${winnerId}`, 'info');
    });

    // Timer interval for UI countdown
    const timerInterval = setInterval(() => {
      setImmuneTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('joinedRoom');
      socket.off('gameStateUpdate');
      socket.off('tileEffect');
      socket.off('spawnSun');
      socket.off('error');
      socket.off('gameOver');
      clearInterval(timerInterval);
    };
  }, [playerId, setRoomInfo, updateGameState, setConnected, addToast]);

  const handleJoin = async (targetRoomId?: string) => {
    if (!playerName.trim()) {
      addToast('Please enter a commander name', 'error');
      return;
    }

    setIsConnecting(true);


    if (!socket.connected) {
      socket.connect();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        socket.once('connect_error', () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        });
      }).catch(() => {
        setIsConnecting(false);
        addToast('Failed to connect to server', 'error');
        return;
      });
    }


    const roomToJoin = targetRoomId || (roomCode.trim() || undefined);
    socket.emit('joinGame', playerName.trim(), roomToJoin);
  };

  const handleTileClick = (tileId: number) => {
    if (!gameState || !playerId) return;
    socket.emit('interactTile', tileId, activeMode);
  };

  const collectSun = (id: string) => {
    playSound('sun');
    socket.emit('collectSun', id);
    setSuns(prev => prev.filter(s => s.id !== id));
  };

  const activateShield = () => {
    socket.emit('activateGlobalShield');
  };

  const copyRoomCode = () => {
    if (gameState?.roomId) {
      navigator.clipboard.writeText(gameState.roomId);
      addToast('Room code copied!', 'success');
    }
  };

  if (!isInGame || !gameState) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
        <ToastContainer />
        <HowToPlayModal />

        <div className="absolute inset-0 z-0">
          <div className="absolute top-[10%] left-[10%] w-[30vw] h-[30vw] bg-cyan-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[30vw] h-[30vw] bg-rose-500/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="glass-panel p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] max-w-[90vw] sm:max-w-md w-full text-center relative z-10 border border-white/10 shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6 sm:mb-8 font-['Orbitron']">
            NEON DOMINION
          </h1>
          <div className="space-y-3 sm:space-y-4">
            <input
              type="text"
              placeholder="ENTER COMMANDER NAME"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-4 text-white text-center text-lg sm:text-xl focus:border-cyan-400 outline-none transition-all font-mono"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isConnecting) {
                  handleJoin();
                }
              }}
              maxLength={12}
            />

            <input
              type="text"
              placeholder="ROOM CODE (OPTIONAL)"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-4 text-white text-center text-base sm:text-lg focus:border-cyan-400 outline-none uppercase transition-all font-mono"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isConnecting) {
                  handleJoin();
                }
              }}
              maxLength={6}
            />

            <button
              onClick={() => handleJoin()}
              disabled={isConnecting}
              className={clsx(
                "w-full py-3 sm:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-slate-900 text-base sm:text-xl transition-all transform active:scale-95",
                isConnecting ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
              )}
            >
              {isConnecting ? 'CONNECTING...' : (roomCode ? "JOIN SPECIFIC ROOM" : "QUICK PLAY / CREATE")}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-[10px] text-slate-500 font-mono">v1.0.4-prod // Secure Connection protocol active</p>
          </div>
        </div>
      </div>
    );
  }

  const me = gameState.players[playerId!];
  if (!me) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading game state...</div>
      </div>
    );
  }


  if (isInGame && gameState?.status === 'waiting') {
    return (
      <div className="h-screen w-screen bg-slate-900">
        <ToastContainer />
        <LobbyScreen
          gameState={gameState}
          playerId={playerId!}
          onTimerExpired={() => { }}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-slate-900">
      <ToastContainer />

      {/* MOBILE ORIENTATION LOCK - PORTRAIT ONLY */}
      <div className="landscape-lock-overlay">
        <div className="w-20 h-20 mb-6 text-cyan-400 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
        </div>
        <h2 className="text-xl font-black mb-2 tracking-tighter uppercase font-['Orbitron']">Command Center Offline</h2>
        <p className="text-slate-400 text-sm max-w-[200px] leading-tight">Rotate to landscape to establish neural link.</p>
      </div>

      <div className="absolute top-0 left-0 w-full p-2 sm:p-4 flex justify-between z-50 pointer-events-none">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <div className="glass-panel px-3 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-6 pointer-events-auto">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 font-bold tracking-widest leading-none mb-0.5">TIME</div>
              <div className={`text-xl sm:text-3xl font-mono font-black ${gameState.timeRemaining < 30 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                {Math.floor(gameState.timeRemaining)}s
              </div>
            </div>
            <div className="h-6 sm:h-8 w-px bg-slate-700"></div>
            <div className="text-center">
              <div className="text-[10px] text-slate-400 font-bold tracking-widest leading-none mb-0.5">ENERGY</div>
              <div className="text-xl sm:text-3xl font-mono font-black text-cyan-400">{me?.energy || 0}</div>
            </div>
          </div>

          <button
            onClick={copyRoomCode}
            className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-slate-700 text-slate-300 flex items-center gap-2 pointer-events-auto hover:border-cyan-400 hover:text-cyan-400 transition-colors group text-[10px] sm:text-xs"
          >
            <span className="font-bold tracking-widest opacity-60">ROOM:</span>
            <span className="font-mono text-sm sm:text-xl text-white group-hover:text-cyan-400">{gameState.roomId}</span>
          </button>

          {immuneTimer > 0 && (
            <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-cyan-400 text-cyan-400 font-bold animate-pulse flex items-center gap-2 text-[10px] sm:text-xs">
              <span>🛡️</span> <span>SHIELD ACTIVE: {immuneTimer}s</span>
            </div>
          )}
        </div>

        <div className="glass-panel p-2 sm:p-4 rounded-xl sm:rounded-2xl min-w-[120px] sm:min-w-[200px] max-w-[250px] pointer-events-auto overflow-hidden">
          <div className="text-[10px] text-slate-400 font-bold tracking-widest mb-1 sm:mb-2">LEADERBOARD</div>
          <div className="space-y-0.5 sm:space-y-1 max-h-[100px] sm:max-h-none overflow-y-auto">
            {Object.values(gameState.players)
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <div key={p.id} className={clsx("flex justify-between items-center", p.id === playerId ? "text-white font-bold bg-white/10 rounded px-1.5" : "text-slate-400 px-1.5")}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 5px ${p.color}` }}></div>
                    <span className="text-[10px] sm:text-sm truncate max-w-[60px] sm:max-w-[100px]">{p.name}</span>
                  </div>
                  <span className="text-[10px] sm:text-sm font-bold font-mono">{p.score}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center z-10 p-4 pt-20 pb-24 sm:pt-32 sm:pb-32">
        <div
          ref={(el) => { boardRef.current = el; }}
          className="game-grid p-1.5 sm:p-3 bg-slate-800/10 rounded-2xl sm:rounded-3xl border border-slate-700/30 shadow-2xl backdrop-blur-sm"
        >
          {gameState.grid.map((tile) => {
            const owner = tile.ownerId ? gameState.players[tile.ownerId] : null;
            const isMine = tile.ownerId === playerId && tile.hasMine;
            const isShielded = tile.shieldExpiresAt > Date.now();

            return (
              <div
                key={tile.id}
                ref={(el) => { if (el) tileRefs.current.set(tile.id, el); }}
                onClick={() => handleTileClick(tile.id)}
                className={clsx(
                  "tile relative rounded sm:rounded-lg border-[1px] sm:border-2 transition-all cursor-pointer overflow-hidden group",
                  owner ? "border-white/20" : "bg-slate-900/40 border-slate-700 hover:border-slate-500",
                  isShielded && "animate-shield-pulse border-dashed !border-2"
                )}
                style={{
                  backgroundColor: owner ? `${owner.color}44` : undefined,
                  borderColor: owner?.color,
                  boxShadow: owner ? `0 0 10px ${owner.color}30` : 'none'
                }}
              >
                {owner && (
                  <div className="absolute inset-x-0 bottom-0 h-1 sm:h-1.5 opacity-50" style={{ backgroundColor: owner.color }}></div>
                )}
                {isShielded && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-lg opacity-80">🛡️</div>
                )}
                {isMine && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full animate-ping opacity-60"></div>
                    <div className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-400 rounded-full"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {suns.map((sun) => (
          <div
            key={sun.id}
            className="absolute w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-yellow-400 border-2 sm:border-4 border-yellow-200 shadow-[0_0_20px_#fbbf24] flex items-center justify-center text-yellow-900 font-bold cursor-pointer pointer-events-auto animate-float-down hover:scale-110 active:scale-95 transition-transform"
            style={{ left: `${sun.left}%` }}
            onPointerDown={() => collectSun(sun.id)}
          >
            <span className="text-[10px] sm:text-base">+25</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 sm:bottom-4 left-0 w-full flex justify-center gap-2 sm:gap-4 z-50 pointer-events-none px-2 sm:px-4">
        <button
          onClick={() => setActiveMode('conquer')}
          className={clsx(
            "pointer-events-auto w-16 h-16 sm:w-24 sm:h-24 rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-90",
            activeMode === 'conquer' ? "bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]" : "bg-slate-800/80 border-slate-700 opacity-70 hover:opacity-100"
          )}
        >
          <span className="text-xl sm:text-3xl mb-0.5 sm:mb-1">⚔️</span>
          <span className="text-[8px] sm:text-[10px] font-black text-slate-300 tracking-tighter sm:tracking-normal uppercase">Capture</span>
          <span className="text-[8px] sm:text-[10px] font-mono text-cyan-400">10⚡</span>
        </button>

        <button
          onClick={activateShield}
          disabled={me.energy < 100}
          className={clsx(
            "pointer-events-auto w-16 h-16 sm:w-24 sm:h-24 rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:grayscale",
            me.energy >= 100 ? "bg-slate-800/80 border-slate-700 opacity-70 hover:opacity-100" : "bg-slate-900/50 border-slate-800"
          )}
        >
          <span className="text-xl sm:text-3xl mb-0.5 sm:mb-1">🛡️</span>
          <span className="text-[8px] sm:text-[10px] font-black text-slate-300 tracking-tighter sm:tracking-normal uppercase">Shield</span>
          <span className="text-[8px] sm:text-[10px] font-mono text-white">100⚡</span>
        </button>

        <button
          onClick={() => setActiveMode('mine')}
          className={clsx(
            "pointer-events-auto w-16 h-16 sm:w-24 sm:h-24 rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-90",
            activeMode === 'mine' ? "bg-rose-500/20 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "bg-slate-800/80 border-slate-700 opacity-70 hover:opacity-100"
          )}
        >
          <span className="text-xl sm:text-3xl mb-0.5 sm:mb-1">💣</span>
          <span className="text-[8px] sm:text-[10px] font-black text-slate-300 tracking-tighter sm:tracking-normal uppercase">Trap</span>
          <span className="text-[8px] sm:text-[10px] font-mono text-rose-400">60⚡</span>
        </button>
      </div>

      {gameState.status === 'ended' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-slate-700 text-center max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-2xl sm:text-4xl font-black mb-2 text-white italic tracking-tighter uppercase font-['Orbitron']">
              {gameState.winnerId === me.name ? <span className="text-cyan-400">Mission Success</span> : <span className="text-rose-500">Mission Failed</span>}
            </h2>
            <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">🏆</div>
            <div className="text-lg sm:text-xl text-slate-300 mb-6 sm:mb-8 font-mono">Winner: {gameState.winnerId}</div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 sm:py-4 bg-white text-slate-900 font-bold rounded-lg sm:rounded-xl hover:bg-cyan-400 hover:text-white transition-all transform active:scale-95"
            >
              REBOOT CORE
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
