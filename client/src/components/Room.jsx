import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const nickname = sessionStorage.getItem('nickname')
  const topic = sessionStorage.getItem('topic')
  const [opponent, setOpponent] = useState(sessionStorage.getItem('opponent') || null)

  const socket = useSocket({
    'player-joined': ({ nickname: opponentNick }) => {
      setOpponent(opponentNick)
      sessionStorage.setItem('opponent', opponentNick)
    },
    'game-start': (gameData) => {
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

  function copyCode() {
    navigator.clipboard.writeText(roomId)
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-black text-yellow-400 mb-1">⌨️ Keyboard Battle</h1>
        <p className="text-gray-400 text-sm mb-8">상대방이 입장하기를 기다리는 중...</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">배틀 주제</p>
          <p className="text-xl font-bold text-white mb-5">"{topic}"</p>

          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">방 코드</p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-3xl font-black text-yellow-400 tracking-widest">{roomId}</span>
            <button
              onClick={copyCode}
              className="text-xs text-gray-400 hover:text-yellow-400 transition border border-gray-700 rounded px-2 py-1"
            >
              복사
            </button>
          </div>
          <button
            onClick={copyLink}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-2 rounded-lg text-sm transition"
          >
            🔗 초대 링크 복사
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
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
              <span className="text-gray-500">상대방 대기 중...</span>
            </div>
          )}
        </div>

        {opponent && (
          <p className="mt-6 text-green-400 font-bold animate-pulse">게임 시작!</p>
        )}
      </div>
    </div>
  )
}
