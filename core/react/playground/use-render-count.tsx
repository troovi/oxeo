import { useRef } from 'react'

export const useRenderCount = () => {
  const count = useRef(0)
  count.current++
  return count.current
}

export const Renders = ({ count }: { count: number }) => {
  return <span style={{ fontSize: 11, color: '#999' }}>(renders: {count})</span>
}
