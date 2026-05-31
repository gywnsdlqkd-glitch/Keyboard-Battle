import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { sounds } from '../utils/sounds'

const TURN_DURATION = 30

export default function Battle() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('nickname')
  const topic = sessionStorage.getItem('topic')
  const [myPlayerIndex, setMyPlayerIndex] = useState(
    parseInt(sessionStorage.getItem('playerIndex') ?? '0', 10)
  )

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [currentNickname, setCurrentNickname] = useState('')
  const [players, setPlayers] = useState([])
  const [turnCount, setTurnCount] = useState(0)
  const [totalTurns, setTotalTurns] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION)
  const [isJudging, setIsJudging] = useState(false)
  const [timeoutMsg, setTimeoutMsg] = useState('')
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [isOpponentTyping, setIsOpponentTyping] = useState(false)
  const [voteCount, setVoteCount] = useState([0, 0])
  const [votedProfiles, setVotedProfiles] = useState([[], []])
  const [voteTimeLeft, setVoteTimeLeft] = useState(0)
  const [isVoting, setIsVoting] = useState(false)
  const [endTurnPending, setEndTurnPending] = useState(false)
  const [spectators, setSpectators] = useState([])

  const timerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const prevTimeLeft = useRef(TURN_DURATION)
  const voteTimerRef = useRef(null)
  const endTurnTimeoutRef = useRef(null)

  const isMyTurn = currentTurnIndex === myPlayerIndex

  function resetTimer(startFrom = TURN_DURATION) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(startFrom)
    prevTimeLeft.current = startFrom
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const socket = useSocket({
    'game-start': ({ players, currentTurnIndex, currentNickname, turnCount, totalTurns: tt }) => {
      sessionStorage.setItem('battleSession', JSON.stringify({ roomId, nickname }))
      setPlayers(players)
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      if (tt) setTotalTurns(tt)
      sessionStorage.setItem('gameData', JSON.stringify({ players, currentTurnIndex, currentNickname, turnCount, totalTurns: tt }))
      resetTimer()
    },
    'message-added': ({ nickname: sender, text, playerIndex }) => {
      setMessages(prev => [...prev, { nickname: sender, text, playerIndex }])
    },
    'turn-update': ({ currentTurnIndex, currentNickname, turnCount, messages: serverMessages }) => {
      if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      setTimeoutMsg('')
      setIsOpponentTyping(false)
      setEndTurnPending(false)
      setMessages(prev => {
        if (!serverMessages?.length) return prev
        if (serverMessages.length < prev.length) return prev
        return serverMessages.map(m => ({ nickname: m.nickname, text: m.text, playerIndex: m.playerIndex }))
      })
      sounds.turnChange()
      resetTimer()
      const existing = JSON.parse(sessionStorage.getItem('gameData') || '{}')
      sessionStorage.setItem('gameData', JSON.stringify({ ...existing, currentTurnIndex, currentNickname, turnCount }))
    },
    'turn-timeout': ({ nickname: timedOutNick }) => {
      setTimeoutMsg(`⏰ ${timedOutNick}이(가) 시간 초과!`)
    },
    'game-judging': () => {
      if (timerRef.current) clearInterval(timerRef.current)
      sounds.turnChange()
      setIsJudging(true)
    },
    'vote-start': ({ duration }) => {
      setIsVoting(true)
      setVoteTimeLeft(Math.ceil(duration / 1000))
      if (voteTimerRef.current) clearInterval(voteTimerRef.current)
      voteTimerRef.current = setInterval(() => {
        setVoteTimeLeft(prev => {
          if (prev <= 1) { clearInterval(voteTimerRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
    },
    'vote-update': ({ voteCount: vc, votedProfiles: vp }) => {
      setVoteCount(vc)
      if (vp) setVotedProfiles(vp)
    },
    'vote-closed': () => {
      setIsVoting(false)
      if (voteTimerRef.current) clearInterval(voteTimerRef.current)
    },
    'end-turn-rejected': () => {
      if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
      setEndTurnPending(false)
    },
    'game-result': (result) => {
      sessionStorage.removeItem('battleSession')
      sessionStorage.setItem('gameResult', JSON.stringify(result))
      navigate(`/result/${roomId}`, { replace: true })
    },
    'opponent-left': () => {
      sessionStorage.removeItem('battleSession')
      navigate('/')
    },
    'opponent-disconnected': () => {
      setOpponentDisconnected(true)
    },
    'opponent-reconnected': () => {
      setOpponentDisconnected(false)
    },
    'rejoin-success': ({ players, messages: serverMessages, currentTurnIndex, currentNickname, turnCount, totalTurns: tt, playerIndex, state, turnElapsedMs }) => {
      sessionStorage.setItem('playerIndex', String(playerIndex))
      setMyPlayerIndex(playerIndex)
      setPlayers(players)
      setMessages(serverMessages.map(m => ({ nickname: m.nickname, text: m.text, playerIndex: m.playerIndex })))
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      if (tt) setTotalTurns(tt)
      sessionStorage.setItem('gameData', JSON.stringify({ players, currentTurnIndex, currentNickname, turnCount, totalTurns: tt }))
      if (state === 'judging') {
        if (timerRef.current) clearInterval(timerRef.current)
        setIsJudging(true)
      } else {
        const elapsed = Math.floor((turnElapsedMs ?? 0) / 1000)
        resetTimer(Math.max(1, TURN_DURATION - elapsed))
      }
    },
    'rejoin-error': ({ message }) => {
      sessionStorage.removeItem('battleSession')
      alert(`재접속 실패: ${message}`)
      navigate('/')
    },
    'spectator-list': (list) => setSpectators(list),
    'typing-indicator': () => {
      setIsOpponentTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setIsOpponentTyping(false), 2000)
    },
  })

  useEffect(() => {
    // freshBattleEntry 플래그로 정상 진입(Room.jsx game-start 경유) 여부 판단
    const isFreshEntry = sessionStorage.getItem('freshBattleEntry') === 'true'
    sessionStorage.removeItem('freshBattleEntry')

    if (!isFreshEntry) {
      // 새로고침 또는 직접 URL 접근 → 로비로
      sessionStorage.removeItem('gameData')
      navigate('/')
      return
    }

    if (sessionStorage.getItem('gameResult')) {
      navigate(`/result/${roomId}`, { replace: true })
      return
    }

    const stored = sessionStorage.getItem('gameData')
    if (stored) {
      const data = JSON.parse(stored)
      setPlayers(data.players)
      setCurrentTurnIndex(data.currentTurnIndex)
      setCurrentNickname(data.currentNickname)
      setTurnCount(data.turnCount)
      if (data.totalTurns) setTotalTurns(data.totalTurns)
      resetTimer()
    } else if (!nickname || !topic) {
      navigate('/')
    }

    // 뒤로가기 차단
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
      navigate('/')
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      if (timerRef.current) clearInterval(timerRef.current)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (voteTimerRef.current) clearInterval(voteTimerRef.current)
      if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (timeLeft === 10) sounds.timerWarning()
    else if (timeLeft <= 5 && timeLeft > 0 && prevTimeLeft.current > timeLeft) sounds.timerCritical()
    prevTimeLeft.current = timeLeft
  }, [timeLeft])

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

  function handleEndTurn() {
    if (!isMyTurn || isJudging || endTurnPending) return
    setEndTurnPending(true)
    socket.emit('end-turn')
    if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
    endTurnTimeoutRef.current = setTimeout(() => setEndTurnPending(false), 5000)
  }

  const progress = (turnCount / totalTurns) * 100
  const timerColor = timeLeft > 10 ? 'text-green-400' : timeLeft > 5 ? 'text-yellow-400' : 'text-red-400'
  const isLastTurn = turnCount + 1 >= totalTurns

  if (isJudging) {
    const totalVotesNow = voteCount[0] + voteCount[1]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center w-full max-w-sm">
          <div className="text-6xl mb-4 animate-bounce">⚖️</div>
          <h2 className="text-2xl font-black text-yellow-400 mb-2">AI 판정 중...</h2>
          <p className="text-gray-400 mb-6">AI가 배틀 로그를 분석하고 있습니다</p>
          <div className="flex justify-center gap-1 mb-8">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-blue-400 font-black text-sm">🗳️ 관람자 투표</p>
              {isVoting && (
                <span className={`text-sm font-black ${voteTimeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
                  {voteTimeLeft}s
                </span>
              )}
            </div>

            <div className="flex gap-3 mb-3">
              {players.map((p, i) => (
                <div key={i} className={`flex-1 rounded-xl p-3 border ${i === 0 ? 'border-yellow-400/30' : 'border-red-400/30'}`}>
                  <p className="text-xs text-gray-400 mb-1 truncate">{p}</p>
                  <p className={`text-2xl font-black ${i === 0 ? 'text-yellow-400' : 'text-red-400'}`}>{voteCount[i]}표</p>
                  <div className="flex flex-wrap gap-1 mt-2 min-h-[20px]">
                    {votedProfiles[i]?.map((profile, j) => (
                      <div key={j} className="w-5 h-5 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center" title={profile.nickname}>
                        {profile.photoURL
                          ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          : <span className="text-[8px] text-gray-300">{profile.nickname?.[0]?.toUpperCase()}</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {totalVotesNow === 0 && (
              <p className="text-gray-600 text-xs text-center">아직 투표한 관람자가 없어요</p>
            )}
          </div>
        </div>
      </div>
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
          <div
            className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-3 flex items-center justify-between">
        <div className="flex gap-4">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${currentTurnIndex === i ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-sm font-bold ${currentTurnIndex === i ? 'text-white' : 'text-gray-500'}`}>
                {p}
              </span>
            </div>
          ))}
        </div>
        <div className={`text-2xl font-black tabular-nums ${timerColor}`}>
          {timeLeft}s
        </div>
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
                  : <span className="text-xs text-gray-400">👤</span>
                }
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
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMine
                    ? 'bg-yellow-400 text-black rounded-br-sm'
                    : 'bg-gray-800 text-white rounded-bl-sm'
                    }`}>
                    {!isMine && (
                      <p className="text-xs text-gray-400 mb-0.5 font-bold">{msg.nickname}</p>
                    )}
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
            maxLength={200}
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
          onClick={isLastTurn ? undefined : handleEndTurn}
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
