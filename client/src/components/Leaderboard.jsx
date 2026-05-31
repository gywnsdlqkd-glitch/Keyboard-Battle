import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs, doc, getDoc, getCountFromServer, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const LEADERBOARD_LIMIT = 10

export default function Leaderboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRecord, setMyRecord] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('wins', 'desc'), limit(LEADERBOARD_LIMIT))
    getDocs(q)
      .then(async snap => {
        const topUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setUsers(topUsers)

        if (user) {
          const isInTop = topUsers.some(u => u.id === user.uid)
          if (!isInTop) {
            const myDoc = await getDoc(doc(db, 'users', user.uid))
            if (myDoc.exists()) {
              const data = myDoc.data()
              const rankSnap = await getCountFromServer(
                query(collection(db, 'users'), where('wins', '>', data.wins ?? 0))
              )
              setMyRecord({ ...data, rank: rankSnap.data().count + 1 })
            } else {
              setMyRecord({ noRecord: true, nickname: user.displayName, photoURL: user.photoURL })
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  function winRate(u) {
    const wins = u.wins ?? 0
    const total = u.totalGames ?? wins + (u.losses ?? 0) + (u.draws ?? 0)
    return total > 0 ? Math.round((wins / total) * 100) + '%' : '0%'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            ← 로비로
          </button>
          <h1 className="text-2xl font-black text-yellow-400">🏆 랭킹보드</h1>
          <div className="w-16" />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : users.length === 0 && !myRecord ? (
            <p className="text-center text-gray-500 py-12">아직 전적이 없습니다.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-xs text-gray-500 font-bold px-4 py-3 text-left w-10">#</th>
                  <th className="text-xs text-gray-500 font-bold px-2 py-3 text-left">닉네임</th>
                  <th className="text-xs text-gray-500 font-bold px-2 py-3 text-center">승</th>
                  <th className="text-xs text-gray-500 font-bold px-2 py-3 text-center">패</th>
                  <th className="text-xs text-gray-500 font-bold px-2 py-3 text-center">무</th>
                  <th className="text-xs text-gray-500 font-bold px-4 py-3 text-center">승률</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const wins = u.wins ?? 0
                  const losses = u.losses ?? 0
                  const draws = u.draws ?? 0
                  const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                  return (
                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3 text-center">
                        {rankEmoji ? (
                          <span className="text-lg">{rankEmoji}</span>
                        ) : (
                          <span className="text-sm text-gray-500">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-black font-black text-xs">
                              {u.nickname?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-bold text-white truncate max-w-[120px]">{u.nickname}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-sm font-bold text-yellow-400">{wins}</td>
                      <td className="px-2 py-3 text-center text-sm text-gray-400">{losses}</td>
                      <td className="px-2 py-3 text-center text-sm text-gray-500">{draws}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-white">{winRate(u)}</td>
                    </tr>
                  )
                })}

                {myRecord && (
                  <>
                    <tr>
                      <td colSpan={6} className="px-4 py-1">
                        <div className="border-t border-dashed border-gray-700" />
                      </td>
                    </tr>
                    <tr className="bg-yellow-400/5">
                      <td className="px-4 py-3 text-center">
                        {myRecord.noRecord
                          ? <span className="text-sm text-gray-500">-</span>
                          : <span className="text-sm text-gray-400">{myRecord.rank}</span>
                        }
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          {myRecord.photoURL ? (
                            <img src={myRecord.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-black font-black text-xs">
                              {myRecord.nickname?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-bold text-yellow-300 truncate max-w-[120px]">
                            {myRecord.nickname} <span className="text-xs text-gray-500 font-normal">(나)</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-sm font-bold text-yellow-400">{myRecord.wins ?? 0}</td>
                      <td className="px-2 py-3 text-center text-sm text-gray-400">{myRecord.losses ?? 0}</td>
                      <td className="px-2 py-3 text-center text-sm text-gray-500">{myRecord.draws ?? 0}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-white">
                        {myRecord.noRecord ? '-' : winRate(myRecord)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
