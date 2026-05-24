'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'

interface HolographicTiltProps {
  children: React.ReactNode
  className?: string
}

export function HolographicTilt({
  children,
  className,
}: HolographicTiltProps) {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Maps vertical viewport scroll coordinates directly to perspective rotations
  const rotateX = useTransform(scrollYProgress, [0, 1], [8, -8])
  const rotateY = useTransform(scrollYProgress, [0, 1], [-10, 10])

  const smoothRotateX = useSpring(rotateX, { stiffness: 85, damping: 20 })
  const smoothRotateY = useSpring(rotateY, { stiffness: 85, damping: 20 })

  return (
    <div 
      ref={ref} 
      className={className} 
      style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
    >
      <motion.div
        style={{
          rotateX: smoothRotateX,
          rotateY: smoothRotateY,
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
