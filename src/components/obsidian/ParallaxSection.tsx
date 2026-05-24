'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'

interface ParallaxSectionProps {
  children: React.ReactNode
  speed?: number // 0.1 to 1.5 (0.5 moves slower, 1.2 moves faster)
  className?: string
}

export function ParallaxSection({
  children,
  speed = 0.5,
  className,
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Calculate parallax y offset
  const yOffset = useTransform(
    scrollYProgress,
    [0, 1],
    [(speed - 1) * -120, (speed - 1) * 120]
  )

  // Spring transition to avoid browser scroll-event ticking jitters
  const smoothY = useSpring(yOffset, {
    stiffness: 90,
    damping: 22,
    restDelta: 0.001,
  })

  return (
    <div ref={ref} className={className} style={{ transform: 'translate3d(0, 0, 0)' }}>
      <motion.div style={{ y: smoothY, willChange: 'transform' }}>
        {children}
      </motion.div>
    </div>
  )
}
