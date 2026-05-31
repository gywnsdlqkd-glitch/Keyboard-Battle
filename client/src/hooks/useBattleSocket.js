import { useState, useRef } from 'react'
import { useSocket } from './useSocket'
import { sounds } from '../utils/sounds'
import { TURN_DURATION, TYPING_TIMEOUT_MS, END_TURN_TIMEOUT_MS } from '../constants'

export function useBattleSocket({ roomId, nickname, navigate, resetTimer, startVoteTimer, stopVoteTimer, stopTimer }) {
  const [myPlayerIndex, setMyPlayerIndex] = useState(
    parseInt(sessionStorage.getItem('playerIndex') ?? '0', 10)
  )
  const [messages, setMessages] = useState([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [currentNickname, setCurrentNickname] = useState('')
  const [players, setPlayers] = useState([])
  const [turnCount, setTurnCount] = useState(0)
  const [totalTurns, setTotalTurns] = useState(0)
  const [isJudging, setIsJudging] = useState(false)
  const [timeoutMsg, setTimeoutMsg] = useState('')
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [isOpponentTyping, setIsOpponentTyping] = useState(false)
  const [voteCount, setVoteCount] = useState([0, 0])
  const [votedProfiles, setVotedProfiles] = useState([[], []])
  const [isVoting, setIsVoting] = useState(false)
  const [endTurnPending, setEndTurnPending] = useState(false)
  const [spectators, setSpectators] = useState([])

  const endTurnTimeoutRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const socket = useSocket({
    'game-start': ({ players, currentTurnIndex, currentNickname, turnCount, totalTurns: tt }) => {
      sessionStorage.setItem('battleSession', JSON.stringify({ roomId, nickname }))
      setPlayers(players)
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      if (tt) setTotalTurns(tt)
      sessionStorage.setItem('gameData', JSON.stringify({ players, currentTurnIndex, currentNickname, turnCount, totalTurns: tt }))
      resetTimer()
    },
    'message-added': ({ nickname: sender, text, playerIndex }) => {
      setMessages(prev => [...prev, { nickname: sender, text, playerIndex }])
    },
    'turn-update': ({ currentTurnIndex, currentNickname, turnCount, messages: serverMessages }) => {
      if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      setTimeoutMsg('')
      setIsOpponentTyping(false)
      setEndTurnPending(false)
      setMessages(prev => {
        if (!serverMessages?.length) return prev
        if (serverMessages.length < prev.length) return prev
        return serverMessages.map(m => ({ nickname: m.nickname, text: m.text, playerIndex: m.playerIndex }))
      })
      sounds.turnChange()
      resetTimer()
      const existing = JSON.parse(sessionStorage.getItem('gameData') || '{}')
      sessionStorage.setItem('gameData', JSON.stringify({ ...existing, currentTurnIndex, currentNickname, turnCount }))
    },
    'turn-timeout': ({ nickname: timedOutNick }) => {
      setTimeoutMsg(`⏰ ${timedOutNick}이(가) 시간 초과!`)
    },
    'game-judging': () => {
      stopTimer()
      sounds.turnChange()
      setIsJudging(true)
    },
    'vote-start': ({ duration }) => {
      setIsVoting(true)
      startVoteTimer(Math.ceil(duration / 1000))
    },
    'vote-update': ({ voteCount: vc, votedProfiles: vp }) => {
      setVoteCount(vc)
      if (vp) setVotedProfiles(vp)
    },
    'vote-closed': () => {
      setIsVoting(false)
      stopVoteTimer()
    },
    'end-turn-rejected': () => {
      if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
      setEndTurnPending(false)
    },
    'game-result': (result) => {
      sessionStorage.removeItem('battleSession')
      sessionStorage.setItem('gameResult', JSON.stringify(result))
      navigate(`/result/${roomId}`, { replace: true })
    },
    'opponent-left': () => {
      sessionStorage.removeItem('battleSession')
      navigate('/')
    },
    'opponent-disconnected': () => setOpponentDisconnected(true),
    'opponent-reconnected': () => setOpponentDisconnected(false),
    'rejoin-success': ({ players, messages: serverMessages, currentTurnIndex, currentNickname, turnCount, totalTurns: tt, playerIndex, state, turnElapsedMs }) => {
      sessionStorage.setItem('playerIndex', String(playerIndex))
      setMyPlayerIndex(playerIndex)
      setPlayers(players)
      setMessages(serverMessages.map(m => ({ nickname: m.nickname, text: m.text, playerIndex: m.playerIndex })))
      setCurrentTurnIndex(currentTurnIndex)
      setCurrentNickname(currentNickname)
      setTurnCount(turnCount)
      if (tt) setTotalTurns(tt)
      sessionStorage.setItem('gameData', JSON.stringify({ players, currentTurnIndex, currentNickname, turnCount, totalTurns: tt }))
      if (state === 'judging') {
        stopTimer()
        setIsJudging(true)
      } else {
        const elapsed = Math.floor((turnElapsedMs ?? 0) / 1000)
        resetTimer(Math.max(1, TURN_DURATION - elapsed))
      }
    },
    'rejoin-error': () => {
      sessionStorage.removeItem('battleSession')
      navigate('/')
    },
    'spectator-list': (list) => setSpectators(list),
    'typing-indicator': () => {
      setIsOpponentTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setIsOpponentTyping(false), TYPING_TIMEOUT_MS)
    },
  })

  function handleEndTurn(isMyTurn, isJudgingNow) {
    if (!isMyTurn || isJudgingNow || endTurnPending) return
    setEndTurnPending(true)
    socket.emit('end-turn')
    if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
    endTurnTimeoutRef.current = setTimeout(() => setEndTurnPending(false), END_TURN_TIMEOUT_MS)
  }

  function cleanup() {
    if (endTurnTimeoutRef.current) clearTimeout(endTurnTimeoutRef.current)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
  }

  return {
    socket,
    myPlayerIndex,
    messages,
    setMessages,
    currentTurnIndex,
    currentNickname,
    players,
    turnCount,
    totalTurns,
    isJudging,
    timeoutMsg,
    opponentDisconnected,
    isOpponentTyping,
    voteCount,
    votedProfiles,
    isVoting,
    endTurnPending,
    spectators,
    handleEndTurn,
    cleanup,
  }
}
