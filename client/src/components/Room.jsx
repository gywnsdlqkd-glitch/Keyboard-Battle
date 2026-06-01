import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('nickname')
  const topic = sessionStorage.getItem('topic')
  const isHost = sessionStorage.getItem('isHost') === 'true'
  const [opponent, setOpponent] = useState(sessionStorage.getItem('opponent') || null)
  const [countdown, setCountdown] = useState(null)
  const [botCountdown, setBotCountdown] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const gameStartedRef = useRef(false)

  const socket = useSocket({
    'player-joined': ({ nickname: opponentNick }) => {
      setOpponent(opponentNick)
      sessionStorage.setItem('opponent', opponentNick)
    },
    'countdown': ({ count }) => {
      setCountdown(count)
    },
    'game-start': (gameData) => {
      gameStartedRef.current = true
      sessionStorage.setItem('freshBattleEntry', 'true')
      sessionStorage.setItem('gameData', JSON.stringify(gameData))
      navigate(`/battle/${roomId}`)
    },
    'opponent-left': () => {
      alert('상대방이 나갔습니다.')
      navigate('/')
    },
  })

  useEffect(() => {
    if (!nickname || !topic) navigate('/')
  }, [nickname, topic, navigate])

  useEffect(() => {
    fetch(`/api/room/${roomId}`)
      .then(r => r.json())
      .then(data => { if (!data.exists) navigate('/') })
      .catch(() => navigate('/'))

    // Lobby.jsx에서 저장한 botTimer 정보로 남은 카운트다운 계산
    const startedAt = Number(sessionStorage.getItem('botTimerStartedAt') || '0')
    const delay = Number(sessionStorage.getItem('botTimerDelay') || '0')
    if (startedAt && delay) {
      const remaining = Math.ceil((delay - (Date.now() - startedAt)) / 1000)
      if (remaining > 0) setBotCountdown(remaining)
      sessionStorage.removeItem('botTimerStartedAt')
      sessionStorage.removeItem('botTimerDelay')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (!gameStartedRef.current) {
        socket.emit('leave-waiting-room', { roomId })
      }
    }
  }, [])

  useEffect(() => {
    if (botCountdown === null || botCountdown <= 0 || opponent) return
    const t = setTimeout(() => setBotCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [botCountdown, opponent])

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-black text-yellow-400 mb-1">⌨️ Keyboard Battle</h1>
        <p className="text-gray-400 text-sm mb-8">상대방이 입장하기를 기다리는 중...</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">배틀 주제</p>
          <p className="text-xl font-bold text-white mb-5 line-clamp-2 break-all">"{topic}"</p>

          <button
            onClick={copyLink}
            className={`w-full font-black py-2 rounded-lg text-sm transition ${linkCopied ? 'bg-green-400 text-black' : 'bg-yellow-400 hover:bg-yellow-300 text-black'}`}
          >
            {linkCopied ? '🔗 복사됨! ✓' : '🔗 초대 링크 복사'}
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
          {isHost ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-black font-black text-xs">
                  {nickname?.charAt(0)?.toUpperCase()}
                </div>
                <span className="font-bold text-white">{nickname}</span>
                <span className="ml-auto text-xs text-yellow-400 font-bold">방장</span>
              </div>
              <div className="border-t border-gray-800" />
              {opponent ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-400 flex items-center justify-center text-black font-black text-xs">
                    {opponent.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-white">{opponent}</span>
                  <span className="ml-auto text-xs text-green-400 font-bold">입장 완료</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-gray-500 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">상대방 대기 중...</span>
                    {botCountdown !== null && (
                      <span className="text-xs text-gray-600">
                        {botCountdown > 0 ? `${botCountdown}초 후 AI 자동 입장` : 'AI 입장 중...'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-black font-black text-xs">
                  {opponent?.charAt(0)?.toUpperCase()}
                </div>
                <span className="font-bold text-white">{opponent}</span>
                <span className="ml-auto text-xs text-yellow-400 font-bold">방장</span>
              </div>
              <div className="border-t border-gray-800" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-400 flex items-center justify-center text-black font-black text-xs">
                  {nickname?.charAt(0)?.toUpperCase()}
                </div>
                <span className="font-bold text-white">{nickname}</span>
                <span className="ml-auto text-xs text-green-400 font-bold">입장 완료</span>
              </div>
            </>
          )}
        </div>

        {countdown !== null ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="text-8xl font-black text-yellow-400 animate-pulse tabular-nums">{countdown}</div>
            <p className="text-gray-400 text-sm">배틀 준비!</p>
          </div>
        ) : opponent ? (
          <p className="mt-6 text-green-400 font-bold animate-pulse">게임 시작!</p>
        ) : null}
      </div>
    </div>
  )
}
