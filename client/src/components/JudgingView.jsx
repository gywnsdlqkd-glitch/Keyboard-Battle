export default function JudgingView({
  players,
  spectators,
  voteCount,
  votedProfiles,
  isVoting,
  voteTimeLeft,
  canVote = false,
  myVote = null,
  onVote = null,
}) {
  const allVoterNicknames = new Set([...votedProfiles[0], ...votedProfiles[1]].map(v => v.nickname))
  const nonVoters = spectators.filter(s => !allVoterNicknames.has(s.nickname))

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6">
      <div className="text-center">
        <div className="text-6xl mb-3 animate-bounce">⚖️</div>
        <h2 className="text-2xl font-black text-yellow-400 mb-1">AI 판정 중...</h2>
        <p className="text-gray-500 text-sm">AI가 배틀 로그를 분석하고 있습니다</p>
        <div className="flex justify-center gap-1 mt-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-blue-400 font-black text-sm">🗳️ 관람자 투표</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">총 {spectators.length}명 관람</span>
            {isVoting && (
              <span className={`text-sm font-black tabular-nums ${voteTimeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
                {voteTimeLeft}s
              </span>
            )}
          </div>
        </div>

        {(() => {
          const total = voteCount[0] + voteCount[1]
          const pct0 = total > 0 ? Math.round(voteCount[0] / total * 100) : 50
          const pct1 = 100 - pct0
          return (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-yellow-400 font-bold truncate max-w-[45%]">{players[0]} {pct0}%</span>
                <span className="text-red-400 font-bold truncate max-w-[45%]">{pct1}% {players[1]}</span>
              </div>
              <div className="flex rounded-full overflow-hidden h-2">
                <div className="bg-yellow-400 transition-all duration-500" style={{ width: `${pct0}%` }} />
                <div className="bg-red-400 transition-all duration-500" style={{ width: `${pct1}%` }} />
              </div>
            </div>
          )
        })()}

        <div className="flex gap-3 mb-3">
          {[0, 1].map(pidx => (
            <div key={pidx} className="flex-1 text-center">
              <p className={`font-bold text-xs mb-2 truncate ${pidx === 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {players[pidx]}
              </p>
              <div className="flex flex-wrap justify-center gap-1 min-h-8">
                {votedProfiles[pidx].map((p, i) => (
                  <div key={i} title={p.nickname} className={`w-8 h-8 rounded-full border-2 overflow-hidden bg-gray-700 flex items-center justify-center ${pidx === 0 ? 'border-yellow-400/40' : 'border-red-400/40'}`}>
                    {p.photoURL
                      ? <img src={p.photoURL} alt={p.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="text-xs">👤</span>}
                  </div>
                ))}
              </div>
              <p className={`font-black text-lg mt-2 ${pidx === 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {voteCount[pidx]}표
              </p>
            </div>
          ))}
        </div>

        {nonVoters.length > 0 && (
          <div className="border-t border-gray-800 pt-2 mt-1">
            <p className="text-xs text-gray-600 mb-1">미투표</p>
            <div className="flex flex-wrap gap-1">
              {nonVoters.map((s, i) => (
                <div key={i} title={s.nickname} className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 opacity-30 flex items-center justify-center">
                  {s.photoURL
                    ? <img src={s.photoURL} alt={s.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <span className="text-xs">👤</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {canVote && onVote && (
          <div className={`flex gap-3 ${nonVoters.length > 0 ? 'mt-3' : 'mt-1'}`}>
            <button
              onClick={() => onVote(0)}
              className={`flex-1 active:scale-95 font-black py-3 rounded-xl text-sm transition ${myVote === 0 ? 'bg-yellow-400 text-black' : 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/40'}`}
            >
              {players[0]}{myVote === 0 && ' ✓'}
            </button>
            <button
              onClick={() => onVote(1)}
              className={`flex-1 active:scale-95 font-black py-3 rounded-xl text-sm transition ${myVote === 1 ? 'bg-red-400 text-black' : 'bg-red-400/20 text-red-400 hover:bg-red-400/40'}`}
            >
              {players[1]}{myVote === 1 && ' ✓'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
