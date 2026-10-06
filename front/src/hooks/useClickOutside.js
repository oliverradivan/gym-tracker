import { useEffect, useRef } from 'react'

export function useClickOutside(elementRef, onClickOutside) {
  const handlerRef = useRef(onClickOutside)

  useEffect(() => {
    handlerRef.current = onClickOutside
  }, [onClickOutside])

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (!elementRef.current?.contains(event.target)) {
        handlerRef.current()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [elementRef])
}
