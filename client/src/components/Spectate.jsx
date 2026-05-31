import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { useGameTimer } from '../hooks/useGameTimer'
import { useAuth } from '../contexts/AuthContext'
import JudgingView from './JudgingView'
import { TYPING_TIMEOUT_MS } from '../constants'

export default function Spectate() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [messages, setMessages] = useState([])
  const [spectators, setSpectators] = useState([])
  const [players, setPlayers] = useState([])
  const [topic, setTopic] = useState('')
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [currentNickname, setCurrentNickname] = useState('')
  const [turnCount, setTurnCount] = useState(0)
  const [totalTurns, setTotalTurns] = useState(0)
  const [isJudging, setIsJudging] = useState(false)
  const [timeoutMsg, setTimeoutMsg] = useState('')
  const [error, setError] = useState('')

  const [isVoting, setIsVoting] = useState(false)
  const [canVote, setCanVote] = useState(false)
  const [myVote, setMyVote] = useState(null)
  const [voteCount, setVoteCount] = useState([0, 0])
  const [votedProfiles, setVotedProfiles] = useState([[], []])

  const [isTyping, setIsTyping] = useState(false)
  const [typingNickname, setTypingNickname] = useState('')

  const { timeLeft, voteTimeLeft, timerColor, resetTimer, startVoteTimer, stopVoteTimer, cleanup } = useGameTimer()
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  function handleVote(playerIndex) {
    if (!canVote) return
    setMyVote(playerIndex)
    socket.emit('submit-vote', { roomId, playerIndex })
  }

  const socket = useSocket({
    'spectate-state': ({ players, topic, messages, currentTurnIndex, currentNickname, turnCount, totalTurns: tt, state, spectators: initSpectators, voteOpen, voteCount: initVoteCount, votedProfiles: initVotedProfiles }) => {
      setPlayers(players)
      setTopic(topic)
      setMessages(messages.map(m => ({ nickname: m.nickname, text: m.text, playerIndex: m.playerIndex })))
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      if (tt) setTotalTurns(tt)
      setSpectators(initSpectators || [])
      if (voteOpen) setCanVote(true)
      if (initVoteCount) setVoteCount(initVoteCount)
      if (initVotedProfiles) setVotedProfiles(initVotedProfiles)
      if (state === 'judging') {
        setIsJudging(true)
      } else {
        resetTimer()
      }
    },
    'spectator-list': (list) => setSpectators(list),
    'message-added': ({ nickname: sender, text, playerIndex }) => {
      setMessages(prev => [...prev, { nickname: sender, text, playerIndex }])
    },
    'turn-update': ({ currentTurnIndex, currentNickname, turnCount, messages: serverMessages }) => {
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      if (serverMessages?.length > 0) {
        setMessages(serverMessages.map(m => ({ nickname: m.nickname, text: m.text, playerIndex: m.playerIndex })))
      }
      setTimeoutMsg('')
      resetTimer()
    },
    'turn-timeout': ({ nickname: timedOutNick }) => {
      setTimeoutMsg(`⏰ ${timedOutNick}이(가) 시간 초과!`)
    },
    'typing-indicator': ({ nickname }) => {
      setIsTyping(true)
      setTypingNickname(nickname)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), TYPING_TIMEOUT_MS)
    },
    'game-judging': () => {
      setIsJudging(true)
    },
    'vote-start': ({ players: votePlayers, duration }) => {
      setPlayers(votePlayers)
      setIsVoting(true)
      setCanVote(true)
      startVoteTimer(Math.ceil(duration / 1000))
    },
    'vote-update': ({ voteCount: vc, votedProfiles: vp }) => {
      setVoteCount(vc)
      if (vp) setVotedProfiles(vp)
    },
    'vote-closed': () => {
      setIsVoting(false)
      setCanVote(false)
      stopVoteTimer()
    },
    'game-result': (result) => {
      sessionStorage.setItem('gameResult', JSON.stringify({ ...result, _isSpectator: true }))
      navigate(`/result/${roomId}`)
    },
    'watch-error': ({ message }) => {
      setError(message)
    },
    'opponent-left': () => {
      alert('배틀이 종료되었습니다.')
      navigate('/')
    },
  })

  useEffect(() => {
    socket.emit('watch-room', {
      roomId,
      nickname: user?.displayName || '익명',
      photoURL: user?.photoURL || null,
    })
    return () => {
      cleanup()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">😢</div>
          <p className="text-red-400 font-bold mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-yellow-400 text-black font-black px-6 py-2 rounded-lg"
          >
            로비로 돌아가기
          </button>
        </div>
      </div>
    )
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
        canVote={canVote}
        myVote={myVote}
        onVote={handleVote}
      />
    )
  }

  const progress = (turnCount / totalTurns) * 100

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-2 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-blue-400 font-bold bg-blue-400/10 border border-blue-400/30 px-3 py-1 rounded-full">
          👁 관람 중
        </span>
        <button onClick={() => navigate('/')} className="text-xs text-gray-500 hover:text-gray-300 transition">
          나가기
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">주제</span>
            <span className="text-sm font-bold text-yellow-400">"{topic}"</span>
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

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-3 overflow-y-auto mb-3 min-h-[300px] max-h-[calc(100vh-280px)]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-600 text-sm">배틀이 시작되기를 기다리는 중...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const isLeft = msg.playerIndex === 0
              return (
                <div key={i} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isLeft ? 'bg-gray-800 text-white rounded-bl-sm' : 'bg-yellow-400 text-black rounded-br-sm'}`}>
                    <p className={`text-xs mb-0.5 font-bold ${isLeft ? 'text-gray-400' : 'text-yellow-800'}`}>{msg.nickname}</p>
                    <p className="text-sm font-medium break-words">{msg.text}</p>
                  </div>
                </div>
              )
            })}
            {isTyping && (
              <div className="flex justify-start">
                <p className="text-xs text-gray-500 px-2 animate-pulse">✍️ {typingNickname} 입력 중...</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {canVote && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mt-3">
          <div className="flex gap-3">
            <button
              onClick={() => handleVote(0)}
              className={`flex-1 active:scale-95 font-black py-3 rounded-xl text-sm transition ${myVote === 0 ? 'bg-yellow-400 text-black' : 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/40'}`}
            >
              {players[0]}{myVote === 0 && ' ✓'}
            </button>
            <button
              onClick={() => handleVote(1)}
              className={`flex-1 active:scale-95 font-black py-3 rounded-xl text-sm transition ${myVote === 1 ? 'bg-red-400 text-black' : 'bg-red-400/20 text-red-400 hover:bg-red-400/40'}`}
            >
              {players[1]}{myVote === 1 && ' ✓'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center mt-3">
        <p className="text-gray-500 text-sm">
          {currentNickname ? `⚡ ${currentNickname}의 턴` : '대기 중...'}
        </p>
      </div>
    </div>
  )
}
