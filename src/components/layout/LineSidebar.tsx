'use client'

import { useRef, useState, useCallback, useEffect, ElementType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import './LineSidebar.css'

export interface NavItem {
  name: string
  href?: string
  icon: ElementType
  badge?: string
  children?: { name: string; href: string }[]
}

const FALLOFF_CURVES = {
  linear: (p: number) => p,
  smooth: (p: number) => p * p * (3 - 2 * p),
  sharp: (p: number) => p * p * p
}

interface LineSidebarProps {
  items: NavItem[]
  accentColor?: string
  textColor?: string
  markerColor?: string
  showIndex?: boolean
  showMarker?: boolean
  proximityRadius?: number
  maxShift?: number
  falloff?: 'linear' | 'smooth' | 'sharp'
  markerLength?: number
  markerGap?: number
  tickScale?: number
  scaleTick?: boolean
  itemGap?: number
  fontSize?: number
  smoothing?: number
  collapsed?: boolean
  onItemClick?: (item: NavItem) => void
}

export default function LineSidebar({
  items,
  accentColor = '#38BDF8',
  textColor = '#94A3B8',
  markerColor = '#334155',
  showIndex = true,
  showMarker = true,
  proximityRadius = 120,
  maxShift = 24,
  falloff = 'smooth',
  markerLength = 40,
  markerGap = 8,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 16,
  fontSize = 0.95,
  smoothing = 120,
  collapsed = false,
  onItemClick
}: LineSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const targetsRef = useRef<number[]>([])
  const currentRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number>(0)
  
  const pathname = usePathname()
  
  // Find active index based on route matches
  const activeIndex = items.findIndex(item => 
    item.href ? pathname === item.href : item.children?.some(c => pathname.startsWith(c.href))
  )

  const activeRef = useRef<number>(activeIndex)
  const smoothingRef = useRef<number>(smoothing)

  useEffect(() => {
    activeRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    smoothingRef.current = smoothing
  }, [smoothing])

  // Submenu states for items with children
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    items.forEach(item => {
      if (item.children && item.children.some(c => pathname.startsWith(c.href))) {
        initial[item.name] = true
      }
    })
    return initial
  })

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  // Single rAF loop that eases every item's --effect toward its target using
  // frame-rate independent exponential smoothing
  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05)
    lastRef.current = now
    const tau = Math.max(smoothingRef.current, 1) / 1000
    const k = 1 - Math.exp(-dt / tau)

    let moving = false
    const currentItems = itemRefs.current
    for (let i = 0; i < currentItems.length; i++) {
      const el = currentItems[i]
      if (!el) continue
      const target = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 1 : 0)
      const cur = currentRef.current[i] || 0
      const next = cur + (target - cur) * k
      const settled = Math.abs(target - next) < 0.0015
      const value = settled ? target : next
      currentRef.current[i] = value
      el.style.setProperty('--effect', value.toFixed(4))
      if (!settled) moving = true
    }

    rafRef.current = moving ? requestAnimationFrame(runFrame) : null
  }, [])

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(runFrame)
  }, [runFrame])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLUListElement>) => {
    if (collapsed) return
    const list = listRef.current
    if (!list) return
    const rect = list.getBoundingClientRect()
    const pointerY = e.clientY - rect.top
    const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear
    const currentItems = itemRefs.current
    
    for (let i = 0; i < currentItems.length; i++) {
      const el = currentItems[i]
      if (!el) continue
      const center = el.offsetTop + el.offsetHeight / 2
      const distance = Math.abs(pointerY - center)
      targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius))
    }
    startLoop()
  }, [falloff, proximityRadius, startLoop, collapsed])

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0)
    startLoop()
  }, [startLoop])

  const handleItemClick = (item: NavItem) => {
    onItemClick?.(item)
  }

  useEffect(() => {
    startLoop()
  }, [activeIndex, startLoop])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <nav
      className={cn(
        'line-sidebar',
        showMarker && !collapsed && 'line-sidebar--markers',
        scaleTick && !collapsed && 'line-sidebar--scale-tick',
        collapsed && 'line-sidebar--collapsed'
      )}
      style={{
        '--accent-color': accentColor,
        '--text-color': textColor,
        '--marker-color': markerColor,
        '--marker-length': collapsed ? '0px' : `${markerLength}px`,
        '--marker-gap': collapsed ? '0px' : `${markerGap}px`,
        '--tick-scale': tickScale,
        '--max-shift': collapsed ? '4px' : `${maxShift}px`,
        '--item-gap': `${itemGap}px`,
        '--font-size': `${fontSize}rem`,
        '--smoothing': `${smoothing}ms`
      } as React.CSSProperties}
    >
      <ul
        ref={listRef}
        className="line-sidebar__list w-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map((item, index) => {
          const Icon = item.icon
          const isItemActive = activeIndex === index
          const hasChildren = !!item.children
          const isMenuOpen = openMenus[item.name] || false

          // Render internal content of the nav link
          const renderContent = (
            <div className="line-sidebar__item-wrapper flex items-center w-full">
              {showMarker && !collapsed && (
                <span className="line-sidebar__marker" aria-hidden="true" />
              )}
              
              <div className="line-sidebar__label flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  {/* Proximity/Active Icon */}
                  <div className="line-sidebar__icon-container flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 transition-transform duration-200" />
                  </div>
                  
                  {/* Zero-padded index and label text */}
                  {!collapsed && (
                    <span className="line-sidebar__text flex items-center whitespace-nowrap overflow-hidden">
                      {showIndex && (
                        <span className="line-sidebar__index font-mono text-[10px] mr-2">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      )}
                      <span className="font-semibold text-sm">{item.name}</span>
                    </span>
                  )}
                </div>

                {/* Badge and dropdown indicator */}
                {!collapsed && (
                  <div className="flex items-center gap-1 shrink-0">
                    {item.badge && (
                      <span className={cn(
                        'text-[8px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase',
                        item.badge === 'NEW' ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30' : 'bg-white/10 text-white/60 border border-white/5'
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {hasChildren && (
                      <div className="text-white/40 group-hover:text-white/80 transition-colors ml-1">
                        {isMenuOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )

          return (
            <li
              key={`${item.name}-${index}`}
              ref={el => {
                itemRefs.current[index] = el
              }}
              className={cn(
                'line-sidebar__item group select-none w-full relative',
                isItemActive && 'line-sidebar__item--active'
              )}
              onClick={() => handleItemClick(item)}
            >
              {/* Click / Link Routing logic */}
              {item.href ? (
                <Link href={item.href} className="w-full flex py-2 px-3 rounded-lg hover:bg-white/[0.015] transition-all">
                  {renderContent}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => hasChildren && toggleMenu(item.name)}
                  className="w-full flex py-2 px-3 rounded-lg hover:bg-white/[0.015] transition-all text-left"
                >
                  {renderContent}
                </button>
              )}

              {/* Collapsible Submenu */}
              {hasChildren && !collapsed && (
                <AnimatePresence initial={false}>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden w-full"
                    >
                      <ul className="ml-11 mt-1 mb-2 pl-3 border-l border-white/5 space-y-1">
                        {item.children!.map((child) => {
                          const isChildActive = pathname === child.href
                          return (
                            <li key={child.href} className="w-full">
                              <Link
                                href={child.href}
                                className={cn(
                                  'block py-1.5 px-3 rounded-md text-xs transition-all w-full whitespace-nowrap',
                                  isChildActive
                                    ? 'text-[#38BDF8] font-bold bg-[#38BDF8]/5 border-l border-[#38BDF8] pl-2.5'
                                    : 'text-[#64748B] hover:text-white hover:bg-white/[0.02]'
                                )}
                              >
                                {child.name}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
