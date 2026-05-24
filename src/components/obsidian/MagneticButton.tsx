'use client'

import { useRef, useState } from 'react'

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

export function MagneticButton({
  children,
  className,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [transform, setTransform] = useState('')

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect()
    
    // Mouse coords relative to button center
    const x = e.clientX - (left + width / 2)
    const y = e.clientY - (top + height / 2)
    
    // Magnetic pull capping displacement at 15px max for natural luxury micro-interactions
    const maxDisplacement = 16
    const distance = Math.sqrt(x * x + y * y)
    
    let moveX = x * 0.25
    let moveY = y * 0.25
    
    if (distance > 45) {
      moveX = (x / distance) * maxDisplacement
      moveY = (y / distance) * maxDisplacement
    }
    
    setTransform(`translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0) scale3d(1.02, 1.02, 1)`)
  }

  const handleMouseLeave = () => {
    setTransform('translate3d(0, 0, 0) scale3d(1, 1, 1)')
  }

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transform,
        transition: 'transform 0.18s cubic-bezier(0.25, 1, 0.5, 1)',
        willChange: 'transform',
      }}
      {...props}
    >
      {children}
    </button>
  )
}
