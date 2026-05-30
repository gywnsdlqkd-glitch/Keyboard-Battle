import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, setDoc, increment } from 'firebase/firestore'
import { sounds } from '../utils/sounds'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'

export default function Result() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const nickname = sessionStorage.getItem('nickname')
  const statsWritten = useRef(false)

  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [displayedComment, setDisplayedComment] = useState('')

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
    const isSpectator = result.players && !result.players.includes(nickname)
    if (isSpectator) return
    const p1Score = result.player1Score ?? 50
    const p2Score = result.player2Score ?? 50
    const isDraw = p1Score === p2Score
    if (isDraw) return
    if (result.winner === nickname) sounds.win()
    else sounds.lose()
  }, [result, nickname])

  useEffect(() => {
    if (!result || !user || statsWritten.current) return
    const isSpectator = result.players && !result.players.includes(nickname)
    if (isSpectator) return
    statsWritten.current = true

    const p1Score = result.player1Score ?? 50
    const p2Score = result.player2Score ?? 50
    const isDraw = p1Score === p2Score
    const isWinner = !isDraw && result.winner === nickname

    const ref = doc(db, 'users', user.uid)
    const updates = {
      nickname,
      photoURL: user.photoURL || '',
      totalGames: increment(1),
    }
    if (isWinner) updates.wins = increment(1)
    else if (isDraw) updates.draws = increment(1)
    else updates.losses = increment(1)

    setDoc(ref, updates, { merge: true }).catch(() => {})
  }, [result, user, nickname])

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

  function handleBack() {
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

  if (!result) return null

  const [p1, p2] = result.players || []
  const p1Score = result.player1Score ?? 50
  const p2Score = result.player2Score ?? 50
  const isDraw = p1Score === p2Score
  const isSpectator = result.players && !result.players.includes(nickname)
  const isWinner = !isSpectator && !isDraw && result.winner === nickname

  const emoji = isSpectator ? '👁' : (isDraw ? '🤝' : isWinner ? '🏆' : '💀')
  const resultText = isSpectator ? '배틀 종료!' : (isDraw ? '무승부!' : isWinner ? '승리!' : '패배...')
  const resultColor = isSpectator ? 'text-blue-400' : (isDraw ? 'text-blue-400' : isWinner ? 'text-yellow-400' : 'text-gray-400')
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
            <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">🏅 베스트 코멘트</p>
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
            {result.messages?.map((msg, i) => {
              const myIdx = parseInt(sessionStorage.getItem('playerIndex') ?? '0', 10)
              const isMine = isSpectator ? msg.playerIndex === 0 : msg.playerIndex === myIdx
              return (
                <div key={i} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${
                    isMine
                      ? 'bg-gray-800 text-gray-300'
                      : 'bg-yellow-400/20 text-yellow-200'
                  }`}>
                    <span className="font-bold mr-1 opacity-70">{msg.nickname}:</span>
                    {msg.text}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-full border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-bold py-3 rounded-xl text-sm transition mb-3"
        >
          {copied ? '링크 복사됨! ✓' : '결과 링크 공유하기 📤'}
        </button>

        <button
          onClick={handleBack}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-xl text-lg transition"
        >
          {isSpectator ? '로비로 돌아가기' : '다시 배틀하기 🔥'}
        </button>
      </div>
    </div>
  )
}
