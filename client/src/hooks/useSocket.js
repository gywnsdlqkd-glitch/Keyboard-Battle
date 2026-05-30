import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socketInstance = null

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io('/', { autoConnect: true })
  }
  return socketInstance
}

export function useSocket(eventHandlers) {
  const socket = getSocket()
  const handlersRef = useRef(eventHandlers)
  handlersRef.current = eventHandlers

  useEffect(() => {
    const handlers = handlersRef.current
    const entries = Object.entries(handlers)

    entries.forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    return () => {
      entries.forEach(([event, handler]) => {
        socket.off(event, handler)
      })
    }
  }, [socket])

  return socket
}
