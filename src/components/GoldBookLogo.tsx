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
        {/* Modern metallic frost platinum gradient */}
        <linearGradient id="goldPlate" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="25%" stopColor="#475569" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="75%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1E3A5F" />
        </linearGradient>

        {/* Dynamic bright neon ice gradient */}
        <linearGradient id="neonGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Ambient backing glow */}
        <radialGradient id="backingGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>

        {/* Premium high-glow drop shadow */}
        <filter id="premiumGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft shadow for depth */}
        <filter id="emblemShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Atmospheric Glow */}
      <circle cx="50" cy="50" r="45" fill="url(#backingGlow)" className="animate-pulse" style={{ animationDuration: '4s' }} />

      <g filter="url(#emblemShadow)">
        {/* Sleek Outer Shield Hexagon - Premium Minimalist Frame */}
        <path
          d="M 50 10 L 85 30 L 85 70 L 50 90 L 15 70 L 15 30 Z"
          stroke="url(#goldPlate)"
          strokeWidth="3"
          strokeLinejoin="round"
          fill="none"
          opacity="0.8"
        />

        {/* Interlocking Monogram - Left Leaf forming 'G' and book silhouette */}
        <path
          d="M 45 28 C 30 28 24 38 24 50 C 24 62 30 72 45 72 L 45 64 C 34 64 31 58 31 50 C 31 42 34 36 45 36 Z"
          fill="url(#goldPlate)"
        />

        {/* Interlocking Monogram - Right Leaf forming 'B' pages */}
        <path
          d="M 55 28 C 65 28 73 34 73 43 C 73 48 69 50 63 50 C 70 50 75 55 75 62 C 75 70 65 72 55 72 L 55 28 Z M 62 36 L 55 36 L 55 45 L 62 45 C 66 45 68 43 68 40.5 C 68 38 66 36 62 36 Z M 63 55 L 55 55 L 55 64 L 63 64 C 67 64 70 62 70 59.5 C 70 57 67 55 63 55 Z"
          fill="url(#goldPlate)"
        />

        {/* Spine line connecting G and B */}
        <path
          d="M 50 20 L 50 80"
          stroke="url(#neonGold)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* A beautiful, elegant glowing star node at the top intersection (The edge node) */}
        <circle
          cx="50"
          cy="20"
          r="3"
          fill="#FFFFFF"
          filter="url(#premiumGlow)"
        />
      </g>
    </svg>
  )
}
