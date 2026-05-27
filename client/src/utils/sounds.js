function tone(frequency, duration, type = 'sine', volume = 0.25) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.frequency.value = frequency
    oscillator.type = type
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch (_) {}
}

export const sounds = {
  turnChange: () => {
    tone(880, 0.12)
    setTimeout(() => tone(1100, 0.1), 110)
  },
  timerWarning: () => tone(660, 0.08, 'square', 0.15),
  timerCritical: () => tone(440, 0.08, 'square', 0.25),
  messageSent: () => tone(1047, 0.08, 'sine', 0.1),
  win: () => {
    tone(523, 0.2)
    setTimeout(() => tone(659, 0.2), 180)
    setTimeout(() => tone(784, 0.4), 360)
  },
  lose: () => {
    tone(440, 0.25)
    setTimeout(() => tone(330, 0.4), 220)
  },
}
