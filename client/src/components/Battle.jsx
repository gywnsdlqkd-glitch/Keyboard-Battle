import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'

const TURN_DURATION = 30

export default function Battle() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('nickname')
  const topic = sessionStorage.getItem('topic')

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [currentNickname, setCurrentNickname] = useState('')
  const [players, setPlayers] = useState([])
  const [turnCount, setTurnCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION)
  const [isJudging, setIsJudging] = useState(false)
  const [timeoutMsg, setTimeoutMsg] = useState('')

  const timerRef = useRef(null)
  const messagesEndRef = useRef(null)

  const isMyTurn = currentNickname === nickname

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(TURN_DURATION)
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
    'game-start': ({ players, currentTurnIndex, currentNickname, turnCount }) => {
      setPlayers(players)
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      resetTimer()
    },
    'message-added': ({ nickname: sender, text, playerIndex }) => {
      if (sender === nickname) return
      setMessages(prev => [...prev, { nickname: sender, text, playerIndex }])
    },
    'turn-update': ({ currentTurnIndex, currentNickname, turnCount, messages: serverMessages }) => {
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      setTimeoutMsg('')
      resetTimer()
    },
    'turn-timeout': ({ nickname: timedOutNick }) => {
      setTimeoutMsg(`⏰ ${timedOutNick}이(가) 시간 초과!`)
    },
    'game-judging': () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsJudging(true)
    },
    'game-result': (result) => {
      sessionStorage.setItem('gameResult', JSON.stringify(result))
      navigate(`/result/${roomId}`)
    },
    'opponent-left': () => {
      alert('상대방이 나갔습니다.')
      navigate('/')
    },
  })

  useEffect(() => {
    const stored = sessionStorage.getItem('gameData')
    if (stored) {
      const data = JSON.parse(stored)
      setPlayers(data.players)
      setCurrentTurnIndex(data.currentTurnIndex)
      setCurrentNickname(data.currentNickname)
      setTurnCount(data.turnCount)
      resetTimer()
    } else if (!nickname || !topic) {
      navigate('/')
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(e) {
    e.preventDefault()
    if (!isMyTurn || !input.trim() || isJudging) return
    const text = input.trim()
    setMessages(prev => [...prev, { nickname, text, playerIndex: currentTurnIndex }])
    socket.emit('send-message', { text })
    setInput('')
  }

  const totalTurns = 10
  const progress = (turnCount / totalTurns) * 100
  const timerColor = timeLeft > 10 ? 'text-green-400' : timeLeft > 5 ? 'text-yellow-400' : 'text-red-400'

  if (isJudging) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⚖️</div>
          <h2 className="text-2xl font-black text-yellow-400 mb-2">AI 판정 중...</h2>
          <p className="text-gray-400">Claude가 배틀 로그를 분석하고 있습니다</p>
          <div className="flex justify-center gap-1 mt-6">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-2 py-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">주제</span>
            <span className="text-sm font-bold text-yellow-400">"{topic}"</span>
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

      {timeoutMsg && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 mb-3 text-red-300 text-sm text-center">
          {timeoutMsg}
        </div>
      )}

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-3 overflow-y-auto mb-3 min-h-[300px] max-h-[calc(100vh-320px)]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-600 text-sm">
              {isMyTurn ? '먼저 공격하세요! 💥' : '상대방의 공격을 기다리는 중...'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const isMine = msg.nickname === nickname
              return (
                <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMine
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className={`rounded-xl p-0.5 ${isMyTurn ? 'bg-yellow-400' : 'bg-gray-700'}`}>
        <form onSubmit={handleSend} className="flex gap-2 bg-gray-900 rounded-xl p-2">
          <input
            className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none disabled:opacity-40"
            placeholder={isMyTurn ? '킹받게 쳐봐... 💬' : '상대방 턴입니다'}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!isMyTurn || isJudging}
            maxLength={200}
            autoFocus={isMyTurn}
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

      <p className="text-center text-xs text-gray-600 mt-2">
        {isMyTurn ? '⚡ 내 턴 — 킹받게 공격하라!' : '⏳ 상대방의 턴'}
      </p>
    </div>
  )
}
