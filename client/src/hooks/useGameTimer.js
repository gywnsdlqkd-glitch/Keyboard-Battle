import { useState, useRef, useEffect } from 'react'
import { TURN_DURATION, TIMER_WARN_SEC, TIMER_CRIT_SEC } from '../constants'
import { sounds } from '../utils/sounds'

export function useGameTimer({ enableSounds = false } = {}) {
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION)
  const [voteTimeLeft, setVoteTimeLeft] = useState(0)
  const timerRef = useRef(null)
  const voteTimerRef = useRef(null)
  const prevTimeLeft = useRef(TURN_DURATION)

  useEffect(() => {
    if (!enableSounds) return
    if (timeLeft === TIMER_WARN_SEC) sounds.timerWarning()
    else if (timeLeft <= TIMER_CRIT_SEC && timeLeft > 0 && prevTimeLeft.current > timeLeft) sounds.timerCritical()
    prevTimeLeft.current = timeLeft
  }, [timeLeft, enableSounds])

  function resetTimer(startFrom = TURN_DURATION) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(startFrom)
    prevTimeLeft.current = startFrom
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function startVoteTimer(durationSecs) {
    setVoteTimeLeft(durationSecs)
    if (voteTimerRef.current) clearInterval(voteTimerRef.current)
    voteTimerRef.current = setInterval(() => {
      setVoteTimeLeft(prev => {
        if (prev <= 1) { clearInterval(voteTimerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function stopVoteTimer() {
    if (voteTimerRef.current) clearInterval(voteTimerRef.current)
    setVoteTimeLeft(0)
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function cleanup() {
    stopTimer()
    stopVoteTimer()
  }

  const timerColor = timeLeft > TIMER_WARN_SEC
    ? 'text-green-400'
    : timeLeft > TIMER_CRIT_SEC
    ? 'text-yellow-400'
    : 'text-red-400'

  return { timeLeft, voteTimeLeft, timerColor, resetTimer, startVoteTimer, stopVoteTimer, stopTimer, cleanup }
}
