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

  // FX Refs
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
      if(myTiles.length > 0 && myTiles[0].shieldExpiresAt > Date.now()) {
         setImmuneTimer(Math.ceil((myTiles[0].shieldExpiresAt - Date.now())/1000));
      } else {
         setImmuneTimer(0);
      }
    });

    socket.on('tileEffect', (tileId, type) => {
      playSound(type === 'mine' ? 'blast' : type);
      const el = tileRefs.current.get(tileId);
      if (el) {
        if(type === 'blast' || type === 'mine') {
            el.classList.add('animate-blast', 'animate-shake');
            setTimeout(() => el.classList.remove('animate-blast', 'animate-shake'), 400);
            
            // Shake entire board on bomb blast
            if (type === 'mine' && boardRef.current) {
              boardRef.current.classList.add('animate-board-shake');
              setTimeout(() => {
                boardRef.current?.classList.remove('animate-board-shake');
              }, 500);
            }
        } else if(type === 'shield') {
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

    // Ensure socket is connected before emitting
    if (!socket.connected) {
      socket.connect();
      // Wait for connection
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

    // If targetRoomId is passed, join that. If roomCode state is set, use that. Otherwise, auto-match.
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
    // LOGIN SCREEN
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 relative">
        <ToastContainer />
        <HowToPlayModal />
        
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6 font-['Orbitron']">
            NEON DOMINION
          </h1>
          <input
            type="text"
            placeholder="ENTER COMMANDER NAME"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-center text-xl mb-4 focus:border-yellow-400 outline-none"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isConnecting) {
                handleJoin();
              }
            }}
            maxLength={12}
          />
          
          <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="ROOM CODE (OPTIONAL)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-center text-lg focus:border-cyan-400 outline-none uppercase"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isConnecting) {
                    handleJoin();
                  }
                }}
                maxLength={6}
              />
          </div>

          <div className="flex flex-col gap-3">
              <button
                onClick={() => handleJoin()}
                disabled={isConnecting}
                className={clsx(
                  "w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-slate-900 text-xl transition-transform",
                  isConnecting ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                )}
              >
                {isConnecting ? 'CONNECTING...' : (roomCode ? "JOIN SPECIFIC ROOM" : "QUICK PLAY / CREATE")}
              </button>
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

  // Show lobby screen if game is waiting (only if we're in a room)
  if (isInGame && gameState?.status === 'waiting') {
    return (
      <div className="h-screen w-screen bg-slate-900">
        <ToastContainer />
        <LobbyScreen
          gameState={gameState}
          playerId={playerId!}
          onTimerExpired={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-slate-900">
      <ToastContainer />
      
      {/* HUD TOP - Fixed positioning with proper margins */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between z-50 pointer-events-none">
        
        {/* Timer & Info */}
        <div className="flex flex-col gap-2">
           <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-6 pointer-events-auto">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 font-bold tracking-widest">TIME</div>
                <div className="text-3xl font-mono font-black">{Math.floor(gameState.timeRemaining)}s</div>
              </div>
              <div className="h-8 w-px bg-slate-700"></div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400 font-bold tracking-widest">ENERGY</div>
                <div className="text-3xl font-mono font-black text-yellow-400">{me?.energy || 0}</div>
              </div>
           </div>
           
           {/* Room Code Display - Clickable to Copy */}
           <button
             onClick={copyRoomCode}
             className="glass-panel px-4 py-2 rounded-xl border border-slate-700 text-slate-300 flex items-center gap-2 pointer-events-auto hover:border-cyan-400 hover:text-cyan-400 transition-colors group"
           >
               <span className="text-[10px] font-bold tracking-widest">ROOM:</span>
               <span className="font-mono text-xl text-white group-hover:text-cyan-400">{gameState.roomId}</span>
               <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
           </button>

           {immuneTimer > 0 && (
              <div className="glass-panel px-4 py-2 rounded-xl border border-cyan-400 text-cyan-400 font-bold animate-pulse flex items-center gap-2">
                  <span>🛡️</span> <span>SHIELD ACTIVE: {immuneTimer}s</span>
              </div>
           )}
        </div>

        {/* Leaderboard */}
        <div className="glass-panel p-4 rounded-2xl min-w-[200px] max-w-[250px] pointer-events-auto">
          <div className="text-[10px] text-slate-400 font-bold tracking-widest mb-2">LEADERBOARD</div>
          {Object.values(gameState.players)
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div key={p.id} className={clsx("flex justify-between items-center mb-1", p.id === playerId ? "text-white font-bold bg-white/10 rounded px-2" : "text-slate-400 px-2")}>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 5px ${p.color}` }}></div>
                   <span className="text-sm truncate">{p.name}</span>
                </div>
                <span className="text-sm font-bold">{p.score}</span>
              </div>
            ))}
        </div>
      </div>

      {/* GAME GRID - With proper margins to avoid overlap */}
      <div className="flex-1 flex items-center justify-center z-10 pt-32 pb-32 px-4">
        <div 
           ref={(el) => { boardRef.current = el; }}
           className="grid gap-1.5 bg-slate-800/50 p-3 rounded-3xl border border-slate-700 shadow-2xl"
           style={{ 
             gridTemplateColumns: `repeat(12, 50px)`,
             gridTemplateRows: `repeat(8, 50px)`,
             width: 'fit-content',
             height: 'fit-content'
           }}
        >
          {gameState.grid.map((tile) => {
            const owner = tile.ownerId ? gameState.players[tile.ownerId] : null;
            const isMine = tile.ownerId === playerId && tile.hasMine;
            const isShielded = tile.shieldExpiresAt > Date.now();
            
            return (
              <div
                key={tile.id}
                ref={(el) => { if(el) tileRefs.current.set(tile.id, el); }}
                onClick={() => handleTileClick(tile.id)}
                className={clsx(
                  "relative rounded-md border-2 transition-all cursor-pointer overflow-hidden",
                  "w-[50px] h-[50px]",
                  owner ? "border-white/30" : "bg-slate-800 border-slate-700 hover:border-slate-500",
                  isShielded && "animate-shield-pulse border-dashed !border-2",
                  isMine && "after:content-['💣'] after:absolute after:bottom-0.5 after:right-0.5 after:text-xs"
                )}
                style={{
                  backgroundColor: owner?.color,
                  boxShadow: owner ? `0 0 15px ${owner.color}60` : 'none'
                }}
              >
                 {isShielded && (
                    <div className="absolute inset-0 flex items-center justify-center text-lg opacity-80">🛡️</div>
                 )}
                 {isMine && (
                    <div className="absolute inset-1 border border-dashed border-red-500 rounded-full opacity-50 animate-spin-slow"></div>
                 )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SUN LAYER */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {suns.map((sun) => (
           <div
             key={sun.id}
             className="absolute w-16 h-16 rounded-full bg-yellow-400 border-4 border-yellow-200 shadow-[0_0_30px_#fbbf24] flex items-center justify-center text-yellow-900 font-bold cursor-pointer pointer-events-auto animate-float-down hover:scale-110 active:scale-95 transition-transform"
             style={{ left: `${sun.left}%` }}
             onPointerDown={() => collectSun(sun.id)}
           >
             +25
           </div>
        ))}
      </div>

      {/* CONTROLS - Fixed bottom with proper spacing */}
      <div className="absolute bottom-4 left-0 w-full flex justify-center gap-4 z-50 pointer-events-none px-4">
        <button
          onClick={() => setActiveMode('conquer')}
          className={clsx(
             "pointer-events-auto w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all",
             activeMode === 'conquer' ? "bg-slate-700 border-white scale-110 shadow-lg" : "bg-slate-800 border-slate-600 opacity-70 hover:opacity-100"
          )}
        >
          <span className="text-2xl mb-0.5">⚔️</span>
          <span className="text-[10px] font-bold text-slate-300">ATTACK</span>
          <span className="text-[9px] text-yellow-500">10⚡</span>
        </button>

        <button
          onClick={activateShield}
          disabled={me.energy < 100}
          className={clsx(
            "pointer-events-auto w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all",
            me.energy < 100 
              ? "bg-slate-800 border-slate-600 opacity-30 cursor-not-allowed" 
              : "bg-slate-800 border-slate-600 opacity-70 hover:opacity-100 active:scale-95"
          )}
        >
          <span className="text-2xl mb-0.5">🛡️</span>
          <span className="text-[10px] font-bold text-slate-300">WALL</span>
          <span className="text-[9px] text-yellow-500">100⚡</span>
        </button>

        <button
          onClick={() => setActiveMode('mine')}
          className={clsx(
             "pointer-events-auto w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all",
             activeMode === 'mine' ? "bg-slate-700 border-white scale-110 shadow-lg" : "bg-slate-800 border-slate-600 opacity-70 hover:opacity-100"
          )}
        >
          <span className="text-2xl mb-0.5">💣</span>
          <span className="text-[10px] font-bold text-slate-300">BOMB</span>
          <span className="text-[9px] text-yellow-500">60⚡</span>
        </button>
      </div>

      {/* GAME OVER MODAL */}
      {gameState.status === 'ended' && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <div className="bg-slate-900 p-10 rounded-3xl border border-slate-700 text-center max-w-md w-full animate-bounce-in">
                <h2 className="text-4xl font-black mb-4 text-white">
                   {gameState.winnerId === me.name ? <span className="text-yellow-400">VICTORY</span> : <span className="text-red-500">DEFEAT</span>}
                </h2>
                <div className="text-6xl mb-6">🏆</div>
                <div className="text-xl text-slate-300 mb-8">Winner: {gameState.winnerId}</div>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  REPLAY MISSION
                </button>
            </div>
         </div>
      )}

    </div>
  );
}
