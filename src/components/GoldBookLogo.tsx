'use client'

import React from 'react'

export default function GoldBookLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`overflow-visible select-none shrink-0 ${className}`}
    >
      <defs>
        {/* Core metallic gold gradient with champagne and deep gold transitions */}
        <linearGradient id="goldPlateGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#784F06" /> {/* Deep Bronze Shadow */}
          <stop offset="30%" stopColor="#C59E37" /> {/* Antique Gold */}
          <stop offset="50%" stopColor="#FDF0CD" /> {/* Champagne Highlight */}
          <stop offset="70%" stopColor="#D8A928" /> {/* Pure Yellow Gold */}
          <stop offset="100%" stopColor="#8C5B05" /> {/* Dark Gold Border */}
        </linearGradient>

        {/* Dynamic bright neon accent gold for glows and key paths */}
        <linearGradient id="neonGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2CC" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>

        {/* Radial backing glow */}
        <radialGradient id="glowBacking" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>

        {/* Premium high-glow drop shadow for vectors */}
        <filter id="vectorGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft shadow for the base elements to pop */}
        <filter id="softEmblemShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Atmospheric Golden Backing Glow */}
      <circle cx="50" cy="50" r="46" fill="url(#glowBacking)" />

      <g filter="url(#softEmblemShadow)">
        {/* Outer Circular Ring (Modern aesthetic, broken at top-right for breakout path) */}
        <path
          d="M 50 12 A 38 38 0 1 0 88 50 A 38 38 0 0 0 78.8 23.5"
          stroke="url(#goldPlateGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* The Left Page of the GoldBook (Curved geometric golden leaf) */}
        <path
          d="M47 28C33 28 22 36 22 49C22 62 33 69 47 69V64C36 64 27 58 27 49C27 40 36 33 47 33V28Z"
          fill="url(#goldPlateGrad)"
        />

        {/* The Right Page of the GoldBook (Curved geometric golden leaf) */}
        <path
          d="M53 28V33C64 33 73 40 73 49C73 58 64 64 53 64V69C67 69 78 62 78 49C78 36 67 28 53 28Z"
          fill="url(#goldPlateGrad)"
        />

        {/* Book Spine (Elegant central glowing golden pillar) */}
        <rect
          x="48.5"
          y="25"
          width="3"
          height="45"
          rx="1.5"
          fill="url(#neonGoldGrad)"
          opacity="0.9"
        />

        {/* Ascending Chart Bars (Volume/Price candles integrated inside the book structure) */}
        {/* Left page bars */}
        <rect x="31" y="47" width="4" height="12" rx="2" fill="url(#goldPlateGrad)" opacity="0.75" />
        <rect x="38" y="40" width="4" height="18" rx="2" fill="url(#goldPlateGrad)" opacity="0.85" />
        
        {/* Right page bars */}
        <rect x="58" y="38" width="4" height="20" rx="2" fill="url(#goldPlateGrad)" opacity="0.85" />
        <rect x="65" y="30" width="4" height="26" rx="2" fill="url(#goldPlateGrad)" opacity="0.95" />

        {/* Glowing Breakout Trend Line (Threads through the spine and shoots out of the circle) */}
        <path
          d="M26 55 L40 43 L52 49 L76 21 L85 21"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#vectorGlow)"
        />

        {/* Floating growth node (The ultimate trade peak) */}
        <circle
          cx="85"
          cy="21"
          r="4.5"
          fill="#FFFFFF"
          filter="url(#vectorGlow)"
        />

        {/* Compass Calibration Markings at the base for premium financial design feel */}
        <path
          d="M 38 78 L 62 78"
          stroke="url(#goldPlateGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="50" cy="78" r="2.5" fill="url(#neonGoldGrad)" opacity="0.8" />
      </g>
    </svg>
  )
}
