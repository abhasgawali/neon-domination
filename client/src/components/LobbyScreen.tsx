import { useState, useEffect } from 'react';
import { socket } from '../services/socket';
import { useToastStore } from './Toast';
import clsx from 'clsx';

interface LobbyScreenProps {
  gameState: any;
  playerId: string;
  onTimerExpired: () => void;
}

export function LobbyScreen({ gameState, playerId, onTimerExpired }: LobbyScreenProps) {
  const { addToast } = useToastStore();
  const [lobbyTimer, setLobbyTimer] = useState(15);
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    // Reset timer when game state changes
    if (gameState?.status === 'waiting') {
      setLobbyTimer(15);
      setTimerExpired(false);
    }
  }, [gameState?.status]);

  useEffect(() => {
    if (gameState?.status === 'waiting' && !timerExpired) {
      const interval = setInterval(() => {
        setLobbyTimer((prev) => {
          if (prev <= 1) {
            setTimerExpired(true);
            onTimerExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameState?.status, timerExpired, onTimerExpired]);

  useEffect(() => {
    const handleTimerExpired = () => {
      setTimerExpired(true);
      setLobbyTimer(0);
    };

    socket.on('lobbyTimerExpired', handleTimerExpired);

    return () => {
      socket.off('lobbyTimerExpired', handleTimerExpired);
    };
  }, []);

  const handleStartWithBots = () => {
    socket.emit('startGameWithBots');
    addToast('Starting game with bots...', 'info');
  };

  const handleStartSolo = () => {
    socket.emit('startGameSolo');
    addToast('Starting solo game...', 'info');
  };

  const playerCount = Object.keys(gameState?.players || {}).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md">
      <div className="glass-panel p-8 rounded-3xl max-w-md w-full text-center border-2 border-slate-700">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">
          WAITING FOR PLAYERS
        </h2>

        <div className="mb-6">
          <div className="text-6xl font-mono font-black text-yellow-400 mb-2">
            {lobbyTimer}s
          </div>
          <div className="text-slate-400 text-sm">Time remaining to find players</div>
        </div>

        <div className="mb-6">
          <div className="text-2xl font-bold text-white mb-2">
            {playerCount} {playerCount === 1 ? 'Player' : 'Players'}
          </div>
          <div className="space-y-2">
            {Object.values(gameState?.players || {}).map((player: any) => (
              <div
                key={player.id}
                className={clsx(
                  "px-4 py-2 rounded-xl flex items-center justify-center gap-2",
                  player.id === playerId
                    ? "bg-cyan-500/20 border-2 border-cyan-400"
                    : "bg-slate-800 border border-slate-700"
                )}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: player.color, boxShadow: `0 0 8px ${player.color}` }}
                />
                <span className="font-bold text-white">{player.name}</span>
                {player.id === playerId && (
                  <span className="text-xs text-cyan-400">(You)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {timerExpired && (
          <div className="space-y-3 animate-bounce-in">
            <div className="text-slate-300 mb-4">
              No other players joined. Choose an option:
            </div>
            <button
              onClick={handleStartWithBots}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-bold text-white text-lg hover:scale-105 transition-transform"
            >
              🤖 PLAY WITH BOTS
            </button>
            <button
              onClick={handleStartSolo}
              className="w-full py-4 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl font-bold text-white text-lg hover:scale-105 transition-transform"
            >
              🎮 PLAY SOLO
            </button>
          </div>
        )}

        {!timerExpired && (
          <div className="text-slate-400 text-sm">
            Waiting for other players to join...
          </div>
        )}
      </div>
    </div>
  );
}
