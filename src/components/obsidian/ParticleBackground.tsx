'use client'

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
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
      {/* Subtle Premium Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.025]" 
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '5rem 5rem',
        }}
      />
      {/* Obsidian glowing backdrops */}
      <div className="absolute top-[10%] left-[10%] w-[60vw] h-[60vw] bg-[radial-gradient(circle_at_center,rgba(0,212,170,0.06)_0%,rgba(0,212,170,0.01)_50%,transparent_100%)] rounded-full blur-[130px] opacity-75 animate-pulse duration-[9000ms]" />
      <div className="absolute bottom-[10%] right-[10%] w-[65vw] h-[65vw] bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,rgba(212,175,55,0.01)_50%,transparent_100%)] rounded-full blur-[140px] opacity-65 animate-pulse duration-[11000ms]" />
    </div>
  )
}
