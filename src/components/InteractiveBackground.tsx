'use client'

export function InteractiveBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 bg-[#050508] overflow-hidden">
      {/* Subtle Premium Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem',
        }}
      />
      {/* Obsidian glowing backdrops */}
      <div className="absolute top-[-20%] left-[-20%] w-[70vw] h-[70vw] bg-[radial-gradient(circle_at_center,rgba(0,212,170,0.08)_0%,rgba(0,212,170,0.01)_50%,transparent_100%)] rounded-full blur-[140px] opacity-70 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[75vw] h-[75vw] bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.06)_0%,rgba(212,175,55,0.01)_50%,transparent_100%)] rounded-full blur-[150px] opacity-60 animate-pulse duration-[10000ms]" />
    </div>
  )
}
