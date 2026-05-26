'use client'

import { useEffect, useRef } from 'react'

interface Candle {
  x: number
  y: number
  width: number
  height: number
  wickHeight: number
  isBullish: boolean
  speed: number
  baseX: number // original X before repulsion
}

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let mouseX = -1000
    let mouseY = -1000

    const candles: Candle[] = []
    const numCandles = window.innerWidth < 768 ? 30 : 70 // reduced count for mobile

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const initCandles = () => {
      candles.length = 0
      for (let i = 0; i < numCandles; i++) {
        candles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          baseX: 0,
          width: Math.random() * 4 + 2, // 2px to 6px wide
          height: Math.random() * 20 + 10, // body height
          wickHeight: Math.random() * 15 + 5,
          isBullish: Math.random() > 0.5,
          speed: Math.random() * 0.4 + 0.1,
        })
        candles[i].baseX = candles[i].x
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const handleMouseLeave = () => {
      mouseX = -1000
      mouseY = -1000
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    resize()
    initCandles()

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Global opacity for atmospheric effect
      ctx.globalAlpha = 0.12

      for (const candle of candles) {
        // Drift upwards
        candle.y -= candle.speed

        // Reset if off top
        if (candle.y + candle.height + candle.wickHeight < 0) {
          candle.y = canvas.height + candle.wickHeight
          candle.x = Math.random() * canvas.width
          candle.baseX = candle.x
        }

        // Repulsion logic
        const dx = mouseX - candle.x
        const dy = mouseY - candle.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const repelRadius = 120

        if (distance < repelRadius) {
          const force = (repelRadius - distance) / repelRadius
          candle.x -= (dx / distance) * force * 5
        } else {
          // Gently return to baseX
          candle.x += (candle.baseX - candle.x) * 0.05
        }

        // Draw Candle
        const color = candle.isBullish ? '#22C55E' : '#EF4444'
        ctx.fillStyle = color
        ctx.strokeStyle = color

        // Draw Wick
        ctx.beginPath()
        ctx.moveTo(candle.x, candle.y - candle.wickHeight)
        ctx.lineTo(candle.x, candle.y + candle.height + candle.wickHeight)
        ctx.stroke()

        // Draw Body
        ctx.fillRect(candle.x - candle.width / 2, candle.y, candle.width, candle.height)
      }

      animationFrameId = requestAnimationFrame(render)
    }

    // Pause animation when tab is inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId)
      } else {
        animationFrameId = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    render()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1]"
      style={{ background: '#060A12' }}
    />
  )
}
