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
    const wrappedHandlers = new Map()

    Object.keys(handlersRef.current).forEach(event => {
      const wrapper = (...args) => handlersRef.current[event]?.(...args)
      wrappedHandlers.set(event, wrapper)
      socket.on(event, wrapper)
    })

    return () => {
      wrappedHandlers.forEach((wrapper, event) => socket.off(event, wrapper))
    }
  }, [socket])

  return socket
}
