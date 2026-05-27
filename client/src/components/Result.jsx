import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { sounds } from '../utils/sounds'
import { useSocket, getSocket } from '../hooks/useSocket'

export default function Result() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('nickname')

  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [rematchSent, setRematchSent] = useState(false)
  const [rematchPending, setRematchPending] = useState(false)
  const [displayedComment, setDisplayedComment] = useState('')

  useSocket({
    'rematch-requested': () => setRematchPending(true),
    'rematch-declined': () => {
      setRematchSent(false)
      setRematchPending(false)
      alert('상대방이 재경기를 거절했습니다.')
    },
    'rematch-start': (gameData) => {
      sessionStorage.removeItem('gameResult')
      sessionStorage.removeItem('gameData')
      sessionStorage.setItem('gameData', JSON.stringify(gameData))
      sessionStorage.setItem('battleSession', JSON.stringify({ roomId, nickname }))
      navigate(`/battle/${roomId}`)
    },
    'countdown': () => {},
  })

  useEffect(() => {
    const stored = sessionStorage.getItem('gameResult')
    if (stored) {
      setResult(JSON.parse(stored))
      return
    }
    fetch(`/api/result/${roomId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setResult)
      .catch(() => navigate('/'))
  }, [navigate, roomId])

  useEffect(() => {
    if (!result) return
    const p1Score = result.player1Score ?? 50
    const p2Score = result.player2Score ?? 50
    const isDraw = p1Score === p2Score
    if (isDraw) return
    if (result.winner === nickname) sounds.win()
    else sounds.lose()
  }, [result, nickname])

  useEffect(() => {
    if (!result?.comment) return
    let i = 0
    const interval = setInterval(() => {
      if (i >= result.comment.length) { clearInterval(interval); return }
      setDisplayedComment(result.comment.slice(0, i + 1))
      i++
    }, 25)
    return () => clearInterval(interval)
  }, [result])

  function handleRematch() {
    sessionStorage.removeItem('gameResult')
    sessionStorage.removeItem('gameData')
    sessionStorage.removeItem('battleSession')
    navigate('/')
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  function handleRematchRequest() {
    getSocket().emit('rematch-request')
    setRematchSent(true)
  }

  function handleRematchAccept() {
    getSocket().emit('rematch-accept')
    setRematchPending(false)
  }

  function handleRematchDecline() {
    getSocket().emit('rematch-decline')
    setRematchPending(false)
  }

  if (!result) return null

  const [p1, p2] = result.players || []
  const p1Score = result.player1Score ?? 50
  const p2Score = result.player2Score ?? 50
  const isDraw = p1Score === p2Score
  const isWinner = !isDraw && result.winner === nickname

  const emoji = isDraw ? '🤝' : isWinner ? '🏆' : '💀'
  const resultText = isDraw ? '무승부!' : isWinner ? '승리!' : '패배...'
  const resultColor = isDraw ? 'text-blue-400' : isWinner ? 'text-yellow-400' : 'text-gray-400'
  const isTyping = displayedComment.length < (result.comment?.length ?? 0)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">{emoji}</div>
          <h1 className={`text-4xl font-black mb-1 ${resultColor}`}>{resultText}</h1>
          <p className="text-gray-400 text-sm">주제: "{result.topic}"</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">점수</p>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold text-white w-20 text-right truncate">{p1}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-1000"
                style={{ width: `${p1Score}%` }}
              />
            </div>
            <span className="text-sm font-black text-yellow-400 w-8">{p1Score}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white w-20 text-right truncate">{p2}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full transition-all duration-1000"
                style={{ width: `${p2Score}%` }}
              />
            </div>
            <span className="text-sm font-black text-red-400 w-8">{p2Score}</span>
          </div>
        </div>

        {result.bestMessage && (
          <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl p-4 mb-4">
            <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">🏅 킹받 최고 명언</p>
            <p className="text-white text-sm font-bold italic">"{result.bestMessage}"</p>
          </div>
        )}

        <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-5 mb-4">
          <p className="text-xs text-yellow-500 uppercase tracking-wider mb-2">⚖️ AI 판정 코멘트</p>
          <p className="text-gray-200 text-sm leading-relaxed">
            {displayedComment}
            {isTyping && <span className="animate-pulse">|</span>}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">배틀 기록</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {result.messages?.map((msg, i) => (
              <div key={i} className={`flex ${msg.nickname === nickname ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${
                  msg.nickname === nickname
                    ? 'bg-yellow-400/20 text-yellow-200'
                    : 'bg-gray-800 text-gray-300'
                }`}>
                  <span className="font-bold mr-1 opacity-70">{msg.nickname}:</span>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {rematchPending ? (
          <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl p-4 mb-3 text-center">
            <p className="text-yellow-400 font-bold mb-3">상대방이 재경기를 요청했습니다!</p>
            <div className="flex gap-2">
              <button
                onClick={handleRematchAccept}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-2.5 rounded-xl text-sm transition"
              >
                수락 🔄
              </button>
              <button
                onClick={handleRematchDecline}
                className="flex-1 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                거절
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRematchRequest}
            disabled={rematchSent}
            className="w-full border border-yellow-500/50 hover:border-yellow-400 text-yellow-400 hover:text-yellow-300 font-bold py-3 rounded-xl text-sm transition mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rematchSent ? '재경기 요청 중... ⏳' : '상대방과 다시 하기 🔄'}
          </button>
        )}

        <button
          onClick={handleShare}
          className="w-full border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-bold py-3 rounded-xl text-sm transition mb-3"
        >
          {copied ? '링크 복사됨! ✓' : '결과 링크 공유하기 📤'}
        </button>

        <button
          onClick={handleRematch}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl text-lg transition"
        >
          다시 배틀하기 🔥
        </button>
      </div>
    </div>
  )
}
