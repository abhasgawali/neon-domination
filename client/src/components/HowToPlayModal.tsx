import { useState } from 'react';

export function HowToPlayModal() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-slate-800/90 border border-slate-600 rounded-xl text-slate-300 hover:text-white hover:border-slate-400 transition-colors text-sm font-bold"
      >
        ❓ HOW TO PLAY
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            HOW TO PLAY
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 text-slate-300">
          <section>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">🎯 OBJECTIVE</h3>
            <p>Control the most tiles when the 3-minute timer ends. Expand your territory, defend your tiles, and outsmart your opponents!</p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-cyan-400 mb-2">⚡ ENERGY SYSTEM</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Start with <strong className="text-yellow-400">50 Energy</strong></li>
              <li>Energy does <strong>NOT</strong> regenerate automatically</li>
              <li>Collect <strong className="text-yellow-400">Sun Orbs</strong> that spawn randomly for <strong>+25 Energy</strong> each</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-red-400 mb-2">⚔️ ATTACK (10 Energy)</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Click an enemy or neutral tile to attack</li>
              <li><strong>Rule:</strong> Must be adjacent (orthogonal) to your territory</li>
              <li><strong>Exception:</strong> If you have 0 tiles, you can attack any empty tile</li>
              <li>Successfully attacking a tile makes it yours</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-blue-400 mb-2">🛡️ GLOBAL FIREWALL (100 Energy)</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Makes <strong>ALL</strong> your tiles immune to attacks for <strong>15 seconds</strong></li>
              <li>Shielded tiles show a glowing border and shield icon</li>
              <li>Perfect for defending during a push!</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-purple-400 mb-2">💣 LOGIC BOMB (60 Energy)</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Place an invisible trap on <strong>your own tile</strong></li>
              <li>When an enemy attacks it:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>They lose <strong>30 Energy</strong></li>
                  <li>The tile explodes (becomes neutral)</li>
                  <li><strong>THE STEAL:</strong> Any of their tiles adjacent to the bomb become yours!</li>
                </ul>
              </li>
              <li>Strategic placement can turn the tide!</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-green-400 mb-2">🏆 WINNING</h3>
            <p>When the timer hits 0, the player with the most tiles wins. Ties go to the player with the most energy remaining.</p>
          </section>

          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-slate-900 hover:scale-105 transition-transform"
            >
              GOT IT!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
