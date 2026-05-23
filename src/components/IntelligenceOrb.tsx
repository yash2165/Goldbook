'use client'

import React from 'react'

interface IntelligenceOrbProps {
  className?: string
  size?: number
}

export default function IntelligenceOrb({ className, size = 64 }: IntelligenceOrbProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rotateCw {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rotateCcw {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulseCore {
          0%, 100% { transform: scale(0.92); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes floatParticles {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.15); }
        }
        .orb-rotate-cw {
          animation: rotateCw 16s linear infinite;
          transform-origin: center;
        }
        .orb-rotate-ccw {
          animation: rotateCcw 10s linear infinite;
          transform-origin: center;
        }
        .orb-rotate-fast {
          animation: rotateCw 6s linear infinite;
          transform-origin: center;
        }
        .orb-pulse-core {
          animation: pulseCore 2.5s ease-in-out infinite;
          transform-origin: center;
        }
        .orb-float {
          animation: floatParticles 4s ease-in-out infinite;
          transform-origin: center;
        }
      `}} />
      
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible select-none"
      >
        {/* Dynamic drop shadow filter for deep premium glow */}
        <defs>
          <filter id="orbDeepGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <linearGradient id="orbRingGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
            <stop offset="30%" stopColor="#60A5FA" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
          </linearGradient>
          
          <radialGradient id="orbCoreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="1" />
            <stop offset="35%" stopColor="#3B82F6" stopOpacity="0.9" />
            <stop offset="75%" stopColor="#1E40AF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0B0F19" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* Outer Fine Dotted Compass Track */}
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="rgba(59, 130, 246, 0.12)"
          strokeWidth="0.75"
          strokeDasharray="2 4"
          className="orb-rotate-cw"
        />

        {/* Geometric Hexagonal Shield (Tech Design Layer) */}
        <polygon
          points="50,10 84.6,30 84.6,70 50,90 15.4,70 15.4,30"
          stroke="rgba(59, 130, 246, 0.08)"
          strokeWidth="1"
          className="orb-rotate-ccw"
        />

        {/* Main Orbit Ring with multi-stop gradient */}
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke="url(#orbRingGrad)"
          strokeWidth="1.5"
          strokeDasharray="40 15 80 45"
          className="orb-rotate-ccw"
        />

        {/* Inner High-tech telemetry tick ring */}
        <circle
          cx="50"
          cy="50"
          r="29"
          stroke="rgba(245, 158, 11, 0.22)"
          strokeWidth="1"
          strokeDasharray="8 6 2 4"
          className="orb-rotate-cw"
        />

        {/* Floating crosshair ticks */}
        <line x1="50" y1="2" x2="50" y2="6" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1" />
        <line x1="50" y1="94" x2="50" y2="98" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1" />
        <line x1="2" y1="50" x2="6" y2="50" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1" />
        <line x1="94" y1="50" x2="98" y2="50" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1" />

        {/* Central Core Brain/Orb with radial gradient and drop shadow filter */}
        <circle
          cx="50"
          cy="50"
          r="19"
          fill="url(#orbCoreGrad)"
          filter="url(#orbDeepGlow)"
          className="orb-pulse-core"
        />

        {/* Floating high-fidelity energy dots */}
        <circle cx="50" cy="14" r="3" fill="#60A5FA" className="orb-rotate-ccw" />
        <circle cx="14" cy="50" r="2.5" fill="#F59E0B" className="orb-rotate-cw" />
        <circle cx="50" cy="86" r="2" fill="#8B5CF6" className="orb-rotate-ccw" />
        <circle cx="86" cy="50" r="2.5" fill="#10B981" className="orb-rotate-cw" />
        
        {/* Floating center energy core */}
        <circle
          cx="50"
          cy="50"
          r="6"
          fill="#FFFFFF"
          className="orb-pulse-core"
          style={{ opacity: 0.65, filter: 'drop-shadow(0 0 4px #93C5FD)' }}
        />
      </svg>
    </div>
  )
}
