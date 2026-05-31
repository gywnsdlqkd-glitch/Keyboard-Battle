import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { getRandomTopic } from '../data/topics'
import { useAuth } from '../contexts/AuthContext'

export default function Lobby() {
  const navigate = useNavigate()
  const { user, authLoading, signInWithGoogle, signOut } = useAuth()
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '')
  const [topic, setTopic] = useState('')
  const [roomId, setRoomId] = useState('')
  const [roomList, setRoomList] = useState([])
  const [battlingRooms, setBattlingRooms] = useState([])
  const [tab, setTab] = useState('create')
  const [error, setError] = useState('')

  const socket = useSocket({
    'room-created': ({ roomId, topic, nickname, playerIndex }) => {
      localStorage.setItem('nickname', nickname)
      sessionStorage.setItem('nickname', nickname)
      sessionStorage.setItem('topic', topic)
      sessionStorage.setItem('isHost', 'true')
      sessionStorage.setItem('playerIndex', String(playerIndex))
      sessionStorage.removeItem('opponent')
      navigate(`/room/${roomId}`)
    },
    'room-joined': ({ roomId, topic, nickname, opponent, playerIndex }) => {
      localStorage.setItem('nickname', nickname)
      sessionStorage.setItem('nickname', nickname)
      sessionStorage.setItem('topic', topic)
      sessionStorage.setItem('isHost', 'false')
      sessionStorage.setItem('opponent', opponent)
      sessionStorage.setItem('playerIndex', String(playerIndex))
      navigate(`/room/${roomId}`)
    },
    'room-list': (list) => setRoomList(list),
    'battling-list': (list) => setBattlingRooms(list),
    'join-error': ({ message }) => setError(message),
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteRoom = params.get('room')
    if (inviteRoom) {
      setRoomId(inviteRoom.toUpperCase())
      setTab('join')
    }
  }, [])

  useEffect(() => {
    socket.emit('get-room-list')
  }, [socket])

  function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!nickname.trim()) return setError('닉네임을 입력하세요.')
    if (!topic.trim()) return setError('주제를 입력하세요.')
    socket.emit('create-room', { nickname: nickname.trim(), topic: topic.trim() })
  }

  function handleJoin(e) {
    e.preventDefault()
    setError('')
    if (!nickname.trim()) return setError('닉네임을 입력하세요.')
    if (!roomId.trim()) return setError('방 코드를 입력하세요.')
    socket.emit('join-room', { nickname: nickname.trim(), roomId: roomId.trim().toUpperCase() })
  }

  function handleJoinFromList(id) {
    setError('')
    if (!nickname.trim()) return setError('닉네임을 먼저 입력하세요.')
    socket.emit('join-room', { nickname: nickname.trim(), roomId: id })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-5xl font-black text-center mb-2 text-yellow-400 tracking-tight whitespace-nowrap">
          ⌨️ Keyboard Battle
        </h1>
        <p className="text-center text-gray-400 mb-2 text-sm">
          누가 더 킹받게 쳤나? AI가 판정한다
        </p>
        <p className="text-center text-gray-600 mb-4 text-xs">v{__APP_VERSION__}</p>

        <div className="flex items-center justify-between mb-6">
          {authLoading ? (
            <div className="h-8" />
          ) : user ? (
            <div className="flex items-center gap-2 flex-1">
              {user.photoURL && (
                <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm text-gray-300 truncate max-w-[120px]">{user.displayName}</span>
              <button
                onClick={signOut}
                className="text-xs text-gray-500 hover:text-gray-300 transition ml-1"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인
            </button>
          )}
          <button
            onClick={() => navigate('/leaderboard')}
            className="text-xs text-gray-400 hover:text-yellow-400 font-bold transition"
          >
            🏆 랭킹
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          <div className="mb-5">
            <label className="block text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">닉네임</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition"
              placeholder="배틀 닉네임"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError('') }}
              maxLength={12}
            />
          </div>

          <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-5">
            <button
              className={`flex-1 py-2 text-sm font-bold transition ${tab === 'create' ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setTab('create')}
            >
              방 만들기
            </button>
            <button
              className={`flex-1 py-2 text-sm font-bold transition ${tab === 'join' ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              onClick={() => setTab('join')}
            >
              방 참가
            </button>
          </div>

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">배틀 주제</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition"
                  placeholder="예: 짜장면 vs 짬뽕"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  maxLength={50}
                />
                <button
                  type="button"
                  onClick={() => setTopic(getRandomTopic('🎲 랜덤'))}
                  className="mt-2 w-full text-xs py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-yellow-400 hover:text-yellow-400 transition"
                >
                  🎲 랜덤 주제 뽑기
                </button>
              </div>
              <button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 rounded-lg text-lg transition"
              >
                방 개설
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">방 코드</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition uppercase"
                  placeholder="6자리 방 코드"
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  maxLength={6}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 rounded-lg text-lg transition"
              >
                참가
              </button>
            </form>
          )}

          {error && (
            <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
          )}
        </div>

        {roomList.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">대기 중인 방</h2>
            <div className="space-y-2">
              {roomList.map(room => (
                <div
                  key={room.id}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-white text-sm line-clamp-1 break-all">{room.topic}</p>
                    <p className="text-xs text-gray-500">코드: {room.id} · {room.playerCount}/2명</p>
                  </div>
                  <button
                    onClick={() => handleJoinFromList(room.id)}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black px-3 py-1.5 rounded-lg transition"
                  >
                    입장
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {battlingRooms.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">🔥 진행 중인 배틀</h2>
            <div className="space-y-2">
              {battlingRooms.map(room => (
                <div
                  key={room.id}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-white text-sm line-clamp-1 break-all">{room.topic}</p>
                    <p className="text-xs text-gray-500">
                      {room.players[0]} vs {room.players[1]} · {room.turnCount}/10턴
                      {room.spectatorCount > 0 && ` · 👁 ${room.spectatorCount}명 관람 중`}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/spectate/${room.id}`)}
                    className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-black px-3 py-1.5 rounded-lg transition"
                  >
                    관람
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
