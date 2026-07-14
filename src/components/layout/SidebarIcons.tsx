'use client'

import React from 'react'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

// Global gradient definitions for sidebar icons to ensure high-fidelity look
const IconGradients = () => (
  <svg width="0" height="0" className="absolute pointer-events-none select-none">
    <defs>
      <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#7DD3FC" />
      </linearGradient>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E293B" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#0F172A" stopOpacity="0.8" />
      </linearGradient>
    </defs>
  </svg>
)

export { IconGradients }

// 1. Dashboard - Isometric floating blocks with glowing nodes
export function IconDashboard({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Background duotone block */}
      <path
        d="M12 2L2 7l10 5 10-5-10-5z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="#38BDF8"
        strokeOpacity="0.3"
      />
      {/* Foreground crisp elements */}
      <path d="M2 17l10 5 10-5" strokeWidth="1.5" />
      <path d="M2 12l10 5 10-5" strokeWidth="1.5" />
      {/* Target core node */}
      <circle cx="12" cy="7" r="1.5" fill="#38BDF8" stroke="#38BDF8" strokeWidth="1" />
    </svg>
  )
}

// 2. Trades - Dynamic financial trendline with candlestick markers
export function IconTrades({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Back grid shadow */}
      <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.05" stroke="#38BDF8" strokeOpacity="0.15" />
      {/* Trendline */}
      <path
        d="M4 17l6-6 4 4 6-8"
        stroke="#38BDF8"
        strokeWidth="2"
      />
      {/* Candlestick Nodes */}
      <line x1="10" y1="8" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="10" width="2" height="2" fill="currentColor" />
      <line x1="14" y1="12" x2="14" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="2" height="3" fill="currentColor" />
    </svg>
  )
}

// 3. Journal - High-tech folder/ledger with document tags
export function IconJournal({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Folder backing */}
      <path
        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="#38BDF8"
        strokeOpacity="0.25"
      />
      {/* Document ledger lines */}
      <line x1="6" y1="11" x2="14" y2="11" strokeWidth="1.5" />
      <line x1="6" y1="15" x2="18" y2="15" strokeWidth="1.5" />
      {/* Interactive indicator dot */}
      <circle cx="17" cy="10" r="1.5" fill="#38BDF8" stroke="#38BDF8" strokeWidth="0.5" />
    </svg>
  )
}

// 4. Discipline - Hexagonal shield with tech circuits
export function IconDiscipline({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Hexagonal outer shield */}
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="#38BDF8"
        strokeOpacity="0.3"
      />
      {/* Core shield node */}
      <path d="M12 6v10" stroke="#38BDF8" strokeWidth="1.5" />
      <path d="M9 9h6" strokeWidth="1.5" />
      <circle cx="12" cy="11" r="2.5" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
    </svg>
  )
}

// 5. Analysis - Advanced nested candlesticks
export function IconAnalysis({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Chart grid background */}
      <path d="M3 3v18h18" strokeWidth="1.5" />
      {/* Candlestick 1 */}
      <line x1="8" y1="5" x2="8" y2="15" stroke="#38BDF8" strokeWidth="1.5" />
      <rect x="6" y="8" width="4" height="5" fill="currentColor" fillOpacity="0.25" stroke="#38BDF8" strokeWidth="1" />
      {/* Candlestick 2 */}
      <line x1="14" y1="9" x2="14" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="11" width="4" height="5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

// 6. Market - Rotating globe with latitude orbits
export function IconMarket({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Globe base */}
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.08" stroke="#38BDF8" strokeOpacity="0.2" />
      {/* Latitude lines */}
      <path d="M3.6 9h16.8" strokeOpacity="0.6" />
      <path d="M3.6 15h16.8" strokeOpacity="0.6" />
      {/* Longitude ellipses */}
      <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" stroke="#38BDF8" />
    </svg>
  )
}

// 7. AI Coach - Neural network nodes with connecting synapses
export function IconAICoach({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Neural backing loop */}
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2h2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 1.93-.68 3.7-1.8 5.1z" fill="currentColor" fillOpacity="0.08" stroke="#38BDF8" strokeOpacity="0.2" />
      
      {/* Digital Core Nodes */}
      <circle cx="12" cy="12" r="3" fill="#38BDF8" stroke="#38BDF8" strokeWidth="0.5" />
      <line x1="12" y1="3" x2="12" y2="9" stroke="#38BDF8" strokeDasharray="2,2" />
      <line x1="12" y1="15" x2="12" y2="21" stroke="#38BDF8" strokeDasharray="2,2" />
      <line x1="3" y1="12" x2="9" y2="12" stroke="#38BDF8" strokeDasharray="2,2" />
      <line x1="15" y1="12" x2="21" y2="12" stroke="#38BDF8" strokeDasharray="2,2" />
    </svg>
  )
}

// 8. Backtesting - Flask with bubbling technical nodes
export function IconBacktesting({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Flask container */}
      <path
        d="M6 3h12M12 3v6M8.5 9h7M16 9l4.5 9A2 2 0 0 1 18.7 21H5.3a2 2 0 0 1-1.8-3L8 9V3"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="#38BDF8"
        strokeOpacity="0.3"
      />
      {/* Liquid particles */}
      <circle cx="10" cy="17" r="1" fill="#38BDF8" />
      <circle cx="14" cy="15" r="1.5" fill="#38BDF8" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  )
}

// 9. Community - Premium overlapping node network
export function IconCommunity({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Back User Dot */}
      <circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity="0.08" stroke="#38BDF8" strokeOpacity="0.2" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" strokeOpacity="0.5" />
      
      {/* Front User Dot */}
      <circle cx="17" cy="11" r="3" fill="#38BDF8" fillOpacity="0.2" stroke="#38BDF8" strokeWidth="1.5" />
      <path d="M13 21v-1.5a2.5 2.5 0 0 1 2.5-2.5h3a2.5 2.5 0 0 1 2.5 2.5v1.5" stroke="#38BDF8" strokeWidth="1.5" />
    </svg>
  )
}

// 10. Tools - Technical gear wheel with center shaft
export function IconTools({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Gear backdrop */}
      <circle cx="12" cy="12" r="7" fill="currentColor" fillOpacity="0.08" stroke="#38BDF8" strokeOpacity="0.2" />
      {/* Mechanical paths */}
      <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.8a1 1 0 0 1-1 .8h-.2a2 2 0 0 0-1.4.6l-.6.6a2 2 0 0 0 0 2.8l.5.5a1 1 0 0 1 0 1.4l-.5.5a2 2 0 0 0 0 2.8l.6.6a2 2 0 0 0 2.8 0l.5-.5a1 1 0 0 1 1.4 0l.5.5a2 2 0 0 0 2.8 0l.6-.6a2 2 0 0 0 0-2.8l-.5-.5a1 1 0 0 1 0-1.4l.5-.5a2 2 0 0 0 0-2.8l-.6-.6a2 2 0 0 0-2.8 0l-.5.5a1 1 0 0 1-1.4 0l-.5-.5a2 2 0 0 0-2-2V4a2 2 0 0 0-2-2z" strokeWidth="1.5" />
      {/* Core alignment node */}
      <circle cx="12" cy="12" r="2" fill="#38BDF8" stroke="#38BDF8" strokeWidth="1" />
    </svg>
  )
}

// 11. Settings - Dial control configurations
export function IconSettings({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.05" stroke="#38BDF8" strokeOpacity="0.15" />
      {/* Sliders */}
      <line x1="4" y1="21" x2="4" y2="14" strokeWidth="1.5" />
      <line x1="4" y1="10" x2="4" y2="3" strokeWidth="1.5" />
      <line x1="12" y1="21" x2="12" y2="12" strokeWidth="1.5" />
      <line x1="12" y1="8" x2="12" y2="3" strokeWidth="1.5" />
      <line x1="20" y1="21" x2="20" y2="16" strokeWidth="1.5" />
      <line x1="20" y1="12" x2="20" y2="3" strokeWidth="1.5" />
      {/* Handles */}
      <circle cx="4" cy="12" r="2" fill="#38BDF8" stroke="#38BDF8" strokeWidth="1" />
      <circle cx="12" cy="10" r="2" fill="currentColor" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="14" r="2" fill="#38BDF8" stroke="#38BDF8" strokeWidth="1" />
    </svg>
  )
}

// 12. Help & Support - Orbiting question sphere
export function IconHelp({ className, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Spherical halo */}
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.08" stroke="#38BDF8" strokeOpacity="0.2" />
      {/* Question path */}
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="#38BDF8" strokeWidth="1.8" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
