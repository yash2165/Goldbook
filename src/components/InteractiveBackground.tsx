'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let particles: Particle[] = []

    // Size configuration
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    // Initialize particles
    const initParticles = () => {
      particles = []
      // Extremely lightweight particle count
      const particleCount = Math.min(35, Math.floor((canvas.width * canvas.height) / 45000))
      
      const colors = [
        'rgba(245, 159, 11, 0.25)', // Premium Primary Gold/Orange
        'rgba(252, 211, 77, 0.20)',  // Amber Yellow
        'rgba(184, 134, 11, 0.15)',  // Deep Dark Goldenrod
        'rgba(239, 68, 68, 0.08)',   // Accent soft red/coral
      ]

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.25, // Slow, peaceful drift
          vy: (Math.random() - 0.5) * 0.25,
          radius: Math.random() * 2 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        })
      }
    }

    // Animation loop (Optimized: No heavy connection lines, no mouse attraction)
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Update & Draw particles
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy

        // Bounce bounds
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 bg-[#0A0A0F]"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
