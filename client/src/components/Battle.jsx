import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameTimer } from '../hooks/useGameTimer'
import { useBattleSocket } from '../hooks/useBattleSocket'
import { sounds } from '../utils/sounds'
import JudgingView from './JudgingView'
import { MAX_MSG_LENGTH } from '../constants'

export default function Battle() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('nickname')
  const topic = sessionStorage.getItem('topic')

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { timeLeft, voteTimeLeft, timerColor, resetTimer, startVoteTimer, stopVoteTimer, stopTimer, cleanup: cleanupTimer } = useGameTimer({ enableSounds: true })

  const {
    socket,
    myPlayerIndex, messages, setMessages,
    currentTurnIndex, players,
    turnCount, totalTurns,
    isJudging, timeoutMsg, opponentDisconnected, isOpponentTyping,
    voteCount, votedProfiles, isVoting,
    endTurnPending, spectators,
    handleEndTurn, cleanup: cleanupSocket,
  } = useBattleSocket({ roomId, nickname, navigate, resetTimer, startVoteTimer, stopVoteTimer, stopTimer })

  const isMyTurn = currentTurnIndex === myPlayerIndex
  const isLastTurn = turnCount + 1 >= totalTurns
  const progress = (turnCount / totalTurns) * 100

  useEffect(() => {
    const isFreshEntry = sessionStorage.getItem('freshBattleEntry') === 'true'
    sessionStorage.removeItem('freshBattleEntry')

    if (!isFreshEntry) {
      sessionStorage.removeItem('gameData')
      navigate('/')
      return
    }

    if (sessionStorage.getItem('gameResult')) {
      navigate(`/result/${roomId}`, { replace: true })
      return
    }

    sessionStorage.setItem('battleSession', JSON.stringify({ roomId, nickname }))

    const handleConnect = () => {
      const raw = sessionStorage.getItem('battleSession')
      if (!raw) return
      try {
        const { roomId: r, nickname: n } = JSON.parse(raw)
        socket.emit('rejoin-room', { roomId: r, nickname: n })
      } catch {}
    }
    socket.on('connect', handleConnect)

    const stored = sessionStorage.getItem('gameData')
    if (stored) {
      const gameData = JSON.parse(stored)
      resetTimer(gameData?.turnDuration)
    } else if (!nickname || !topic) {
      navigate('/')
    }

    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
      navigate('/')
    }
    window.addEventListener('popstate', onPop)

    return () => {
      socket.off('connect', handleConnect)
      window.removeEventListener('popstate', onPop)
      sessionStorage.removeItem('battleSession')
      cleanupTimer()
      cleanupSocket()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isMyTurn) {
      setTimeout(() => inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 300)
    }
  }, [isMyTurn])

  function handleSend(e) {
    e.preventDefault()
    if (!isMyTurn || !input.trim() || isJudging) return
    const text = input.trim()
    setMessages(prev => [...prev, { nickname, text, playerIndex: currentTurnIndex }])
    socket.emit('send-message', { text })
    sounds.messageSent()
    setInput('')
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    if (isMyTurn) socket.emit('typing')
  }

  if (isJudging) {
    return (
      <JudgingView
        players={players}
        spectators={spectators}
        voteCount={voteCount}
        votedProfiles={votedProfiles}
        isVoting={isVoting}
        voteTimeLeft={voteTimeLeft}
      />
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col max-w-lg mx-auto px-2 py-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">주제</span>
            <span className="text-sm font-bold text-yellow-400 line-clamp-1 break-all">"{topic}"</span>
          </div>
          <span className="text-xs text-gray-500">{turnCount}/{totalTurns}턴</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-3 flex items-center justify-between">
        <div className="flex gap-4">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${currentTurnIndex === i ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-sm font-bold ${currentTurnIndex === i ? 'text-white' : 'text-gray-500'}`}>{p}</span>
            </div>
          ))}
        </div>
        <div className={`text-2xl font-black tabular-nums ${timerColor}`}>{timeLeft}s</div>
      </div>

      {opponentDisconnected && (
        <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-3 py-2 mb-3 text-orange-300 text-sm text-center animate-pulse">
          ⚡ 상대방 연결 끊김 — 15초 안에 돌아오지 않으면 게임 종료
        </div>
      )}

      {timeoutMsg && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 mb-3 text-red-300 text-sm text-center">
          {timeoutMsg}
        </div>
      )}

      {spectators.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">👁 {spectators.length}명 관람 중</span>
          <div className="flex -space-x-2">
            {spectators.map((s, i) => (
              <div key={i} title={s.nickname} className="w-7 h-7 rounded-full border-2 border-gray-900 overflow-hidden bg-gray-700 flex items-center justify-center">
                {s.photoURL
                  ? <img src={s.photoURL} alt={s.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="text-xs text-gray-400">👤</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(voteCount[0] > 0 || voteCount[1] > 0) && (() => {
        const total = voteCount[0] + voteCount[1]
        const p0 = Math.round(voteCount[0] / total * 100)
        const p1 = 100 - p0
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-yellow-400 font-bold">{players[0]} {p0}%</span>
              <span className="text-gray-500">관람자 여론</span>
              <span className="text-red-400 font-bold">{p1}% {players[1]}</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
              <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${p0}%` }} />
              <div className="bg-red-400 h-full transition-all duration-500" style={{ width: `${p1}%` }} />
            </div>
          </div>
        )
      })()}

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-3 overflow-y-auto mb-3 min-h-[300px] max-h-[calc(100dvh-320px)]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-600 text-sm">
              {isMyTurn ? '먼저 공격하세요! 💥' : '상대방의 공격을 기다리는 중...'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const isMine = msg.playerIndex === myPlayerIndex
              return (
                <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMine ? 'bg-yellow-400 text-black rounded-br-sm' : 'bg-gray-800 text-white rounded-bl-sm'}`}>
                    {!isMine && <p className="text-xs text-gray-400 mb-0.5 font-bold">{msg.nickname}</p>}
                    <p className="text-sm font-medium break-words">{msg.text}</p>
                  </div>
                </div>
              )
            })}
            {isOpponentTyping && !isMyTurn && (
              <div className="flex justify-start">
                <p className="text-xs text-gray-500 px-2 animate-pulse">✍️ 상대방 입력 중...</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className={`rounded-xl p-0.5 ${isMyTurn ? 'bg-yellow-400' : 'bg-gray-700'}`}>
        <form onSubmit={handleSend} className="flex gap-2 bg-gray-900 rounded-xl p-2">
          <input
            ref={inputRef}
            className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none disabled:opacity-40"
            placeholder={isMyTurn ? '킹받게 쳐봐... 💬' : '상대방 턴입니다'}
            value={input}
            onChange={handleInputChange}
            disabled={!isMyTurn || isJudging}
            maxLength={MAX_MSG_LENGTH}
            inputMode="text"
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={!isMyTurn || !input.trim() || isJudging}
            className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black px-4 py-2 rounded-lg text-sm transition"
          >
            전송
          </button>
        </form>
      </div>

      {isMyTurn && !isJudging && (
        <button
          type="button"
          onClick={isLastTurn ? undefined : () => handleEndTurn(isMyTurn, isJudging)}
          disabled={endTurnPending || isLastTurn}
          className={`w-full mt-2 border font-bold py-2 rounded-lg text-xs transition ${
            isLastTurn || endTurnPending
              ? 'border-gray-800 text-gray-600 cursor-not-allowed'
              : 'border-gray-700 hover:border-yellow-400 text-gray-500 hover:text-yellow-400'
          }`}
        >
          {isLastTurn ? '마지막 턴입니다.' : endTurnPending ? '처리 중...' : '턴 종료 ▶'}
        </button>
      )}
    </div>
  )
}
