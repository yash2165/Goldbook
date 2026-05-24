'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'

interface LiquidProgressProps {
  value: number // 0 to 100 percentage allocation
  color?: string
  className?: string
}

export function LiquidProgress({
  value,
  color = '#D4AF37',
  className,
}: LiquidProgressProps) {
  const ref = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Dynamic scale trigger linked directly to vertical viewport progression
  const scaleX = useTransform(
    scrollYProgress,
    [0.1, 0.5],
    [0.02, value / 100]
  )

  const smoothScaleX = useSpring(scaleX, {
    stiffness: 85,
    damping: 18,
    restDelta: 0.001,
  })

  return (
    <div 
      ref={ref} 
      className={`w-full bg-[#0d0d12] border border-white/5 h-2.5 rounded-full overflow-hidden relative ${className}`}
    >
      <motion.div
        className="h-full rounded-full origin-left"
        style={{
          scaleX: smoothScaleX,
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}22`,
          willChange: 'transform',
        }}
      />
    </div>
  )
}
