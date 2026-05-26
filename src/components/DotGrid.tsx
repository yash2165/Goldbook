'use client'

import { useEffect, useRef, useState } from 'react'

export function DotGrid() {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Disable interactive cursor tracking on mobile for performance
    if (window.innerWidth < 768) return

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseLeave = () => {
      setMousePos({ x: -1000, y: -1000 })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div 
      ref={gridRef}
      className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden"
      style={{
        backgroundColor: '#060A12',
        backgroundImage: `radial-gradient(circle at center, rgba(245, 158, 11, 0.04) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* 
        Instead of modifying individual DOM nodes for thousands of dots (bad performance),
        we use a radial gradient mask centered on the mouse position to reveal a brighter 
        dot grid layer.
      */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(245, 158, 11, 0.12) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: `radial-gradient(80px circle at ${mousePos.x}px ${mousePos.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(80px circle at ${mousePos.x}px ${mousePos.y}px, black, transparent)`,
          opacity: mousePos.x === -1000 ? 0 : 1
        }}
      />
    </div>
  )
}
