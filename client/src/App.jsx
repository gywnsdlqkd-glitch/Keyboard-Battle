import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Lobby from './components/Lobby'
import Room from './components/Room'
import Battle from './components/Battle'
import Result from './components/Result'
import Spectate from './components/Spectate'
import Leaderboard from './components/Leaderboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/battle/:roomId" element={<Battle />} />
          <Route path="/result/:roomId" element={<Result />} />
          <Route path="/spectate/:roomId" element={<Spectate />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
