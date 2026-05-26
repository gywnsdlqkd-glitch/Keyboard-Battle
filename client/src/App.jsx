import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Lobby from './components/Lobby'
import Room from './components/Room'
import Battle from './components/Battle'
import Result from './components/Result'
import Spectate from './components/Spectate'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/battle/:roomId" element={<Battle />} />
        <Route path="/result/:roomId" element={<Result />} />
        <Route path="/spectate/:roomId" element={<Spectate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
