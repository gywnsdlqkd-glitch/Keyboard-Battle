import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'

export default function Lobby() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(sessionStorage.getItem('nickname') || '')
  const [topic, setTopic] = useState('')
  const [roomId, setRoomId] = useState('')
  const [roomList, setRoomList] = useState([])
  const [battlingRooms, setBattlingRooms] = useState([])
  const [tab, setTab] = useState('create')
  const [error, setError] = useState('')

  const socket = useSocket({
    'room-created': ({ roomId, topic, nickname }) => {
      sessionStorage.setItem('nickname', nickname)
      sessionStorage.setItem('topic', topic)
      navigate(`/room/${roomId}`)
    },
    'room-joined': ({ roomId, topic, nickname, opponent }) => {
      sessionStorage.setItem('nickname', nickname)
      sessionStorage.setItem('topic', topic)
      sessionStorage.setItem('opponent', opponent)
      navigate(`/room/${roomId}`)
    },
    'room-list': (list) => setRoomList(list),
    'battling-list': (list) => setBattlingRooms(list),
    'join-error': ({ message }) => setError(message),
  })

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
        <p className="text-center text-gray-400 mb-10 text-sm">
          누가 더 킹받게 쳤나? AI가 판정한다
        </p>

        <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          <div className="mb-5">
            <label className="block text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">닉네임</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition"
              placeholder="배틀 닉네임"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
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
                    <p className="font-bold text-white text-sm">{room.topic}</p>
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
                    <p className="font-bold text-white text-sm">{room.topic}</p>
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
