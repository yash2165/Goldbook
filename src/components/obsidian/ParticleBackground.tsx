'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ParticleBackgroundProps {
  density?: number
  goldColor?: string
  cyanColor?: string
}

export function ParticleBackground({
  density = 1500,
  goldColor = '#D4AF37',
  cyanColor = '#00D4AA',
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    const container = canvas.parentElement || document.body
    
    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)

    // Geometry & Materials
    const particlesCount = density
    const posArray = new Float32Array(particlesCount * 3)
    const colorArray = new Float32Array(particlesCount * 3)

    const cGold = new THREE.Color(goldColor)
    const cCyan = new THREE.Color(cyanColor)

    for (let i = 0; i < particlesCount * 3; i += 3) {
      // Random coordinates in space
      posArray[i] = (Math.random() - 0.5) * 12
      posArray[i + 1] = (Math.random() - 0.5) * 12
      posArray[i + 2] = (Math.random() - 0.5) * 12

      // Blending gold and cyan colors
      const mix = Math.random()
      const color = new THREE.Color().copy(cGold).lerp(cCyan, mix)
      colorArray[i] = color.r
      colorArray[i + 1] = color.g
      colorArray[i + 2] = color.b
    }

    const particlesGeometry = new THREE.BufferGeometry()
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

    // GPU-safe circular particle texture using PointMaterial
    const particleCanvas = document.createElement('canvas')
    particleCanvas.width = 16
    particleCanvas.height = 16
    const ctx = particleCanvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 16, 16)
    }
    const particleTexture = new THREE.CanvasTexture(particleCanvas)

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.05,
      map: particleTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial)
    scene.add(particlesMesh)

    // Mouse Tracking
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth) - 0.5
      mouseY = (event.clientY / window.innerHeight) - 0.5
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Resize Handler
    const handleResize = () => {
      if (!canvas || !container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }

    window.addEventListener('resize', handleResize)

    // Animation Loop
    let animationFrameId = 0
    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const elapsedTime = clock.getElapsedTime()

      // Float effect
      particlesMesh.rotation.y = elapsedTime * 0.015
      particlesMesh.rotation.x = elapsedTime * 0.008

      // Mouse reactive easing (low inertia)
      targetX += (mouseX - targetX) * 0.05
      targetY += (mouseY - targetY) * 0.05

      particlesMesh.position.x = targetX * 2.0
      particlesMesh.position.y = -targetY * 2.0

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      particlesGeometry.dispose()
      particlesMaterial.dispose()
      particleTexture.dispose()
      renderer.dispose()
    }
  }, [density, goldColor, cyanColor])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 mix-blend-screen opacity-80"
      style={{ transform: 'translate3d(0,0,0)' }}
    />
  )
}
