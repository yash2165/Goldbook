'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, LineChart, BookOpen, BarChart2, Globe, Bot, FlaskConical, Users, Wrench, Settings, HelpCircle, Shield, ChevronDown, ChevronRight, Menu, X, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import GoldBookLogo from '@/components/GoldBookLogo'

interface NavItem {
  name: string
  href?: string
  icon: React.ElementType
  badge?: string
  children?: { name: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Trades', href: '/trades', icon: LineChart },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Discipline', href: '/rules', icon: Shield },
  {
    name: 'Analysis',
    icon: BarChart2,
    children: [
      { name: 'Performance', href: '/analysis/performance' },
      { name: 'Indian Analytics & Tax', href: '/analysis/indian-analytics' },
      { name: 'Trade Analysis', href: '/analysis/trade-analysis' },
      { name: 'Strategy Analysis', href: '/analysis/strategy-analysis' },
      { name: 'Accounts', href: '/analysis/accounts' },
    ],
  },
  { name: 'Market', href: '/market', icon: Globe },
  { name: 'AI Coach', href: '/ai-report', icon: Bot, badge: 'NEW' },
  { name: 'Backtesting', href: '/backtest', icon: FlaskConical, badge: 'BETA' },
  { name: 'Community', href: '/community', icon: Users },
  { name: 'Tools', href: '/tools', icon: Wrench },
]

const SUPPORT_ITEMS: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help & Support', href: '/help', icon: HelpCircle },
]

function Tooltip({ children, text }: { children: React.ReactNode, text: string }) {
  return (
    <div className="group/tooltip relative flex items-center">
      {children}
      <div className="absolute left-full ml-3 hidden group-hover/tooltip:block z-50">
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#0D1421] text-white text-xs font-bold px-3 py-1.5 rounded-md border border-[#1E3A5F]/50 whitespace-nowrap shadow-xl"
        >
          {text}
        </motion.div>
      </div>
    </div>
  )
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => item.children?.some(c => pathname.startsWith(c.href)) ?? false)

  const isActive = item.href ? pathname === item.href : item.children?.some(c => pathname.startsWith(c.href)) ?? false

  const content = (
    <div className="relative">
      {isActive && (
        <motion.div
          layoutId="activeNavIndicator"
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#38BDF8] rounded-r-full shadow-[0_0_8px_rgba(56,189,248,0.5)] z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <button
        onClick={(e) => {
          if (item.children) {
            e.preventDefault()
            setOpen(o => !o)
          }
        }}
        className={cn(
          'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative overflow-hidden',
          isActive ? 'text-white bg-white/[0.03]' : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.02]',
          collapsed ? 'justify-center' : 'gap-3'
        )}
      >
        <motion.div
          animate={{
            scale: isActive ? 1.1 : 1,
            color: isActive ? '#38BDF8' : '#94A3B8',
          }}
          whileHover={{
            scale: isActive ? 1.1 : 1.05,
            color: isActive ? '#38BDF8' : '#E2E8F0',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <item.icon className="w-5 h-5 shrink-0" />
        </motion.div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex items-center overflow-hidden whitespace-nowrap"
            >
              <span className="flex-1 text-left">{item.name}</span>
              {item.badge && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ml-2',
                  item.badge === 'NEW' ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-[#0D1421] text-[#94A3B8]'
                )}>
                  {item.badge}
                </span>
              )}
              {item.children && (
                open ? <ChevronDown className="w-3.5 h-3.5 ml-2" /> : <ChevronRight className="w-3.5 h-3.5 ml-2" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Submenu */}
      <AnimatePresence>
        {item.children && open && !collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-7 mt-1 space-y-0.5 border-l border-white/5 pl-3">
              {item.children.map(child => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    'block px-3 py-2 rounded-md text-sm transition-all',
                    pathname === child.href ? 'text-[#38BDF8] font-bold' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                  )}
                >
                  {child.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  if (collapsed) {
    return (
      <Tooltip text={item.name}>
        {item.href ? <Link href={item.href} className="w-full">{content}</Link> : content}
      </Tooltip>
    )
  }

  return item.href ? <Link href={item.href} className="w-full block">{content}</Link> : content
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Auto-collapse on smaller desktop screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setCollapsed(true)
      } else if (window.innerWidth >= 1024) {
        setCollapsed(false)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="md:hidden fixed top-3 left-4 z-60 p-2 bg-[#0D1421] border border-white/10 rounded-lg text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ 
          width: collapsed ? 64 : 240,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 bg-[#060A12] border-r border-[#1E3A5F]/50 flex flex-col transition-transform duration-300',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-white/5 shrink-0 overflow-hidden relative bg-[#060A12]/50">
          <div className="flex items-center gap-3">
            <GoldBookLogo size={32} className="shadow-[0_0_15px_rgba(56,189,248,0.2)]" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-extrabold text-sm tracking-wider whitespace-nowrap uppercase flex items-center"
                >
                  <span className="bg-gradient-to-r from-[#38BDF8] via-[#7DD3FC] to-[#BAE6FD] text-transparent bg-clip-text font-black">GOLD</span>
                  <span className="text-white font-light tracking-wide ml-0.5">BOOK</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-8 no-scrollbar">
          {/* Main Menu */}
          <div className="space-y-1">
            <AnimatePresence>
              {!collapsed && (
                <motion.p 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#334155] mb-2 whitespace-nowrap"
                >
                  Menu
                </motion.p>
              )}
            </AnimatePresence>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.name} item={item} collapsed={collapsed} />
            ))}
          </div>

          {/* Support / Settings */}
          <div className="space-y-1">
            <AnimatePresence>
              {!collapsed && (
                <motion.p 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#334155] mb-2 whitespace-nowrap"
                >
                  Preferences
                </motion.p>
              )}
            </AnimatePresence>
            {SUPPORT_ITEMS.map(item => (
              <NavLink key={item.name} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* Footer Area */}
        <div className="p-2 border-t border-white/5 bg-[#060A12]">
          <button
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-[#EF4444] hover:bg-[#EF4444]/10",
              collapsed ? "justify-center" : "gap-3"
            )}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 text-left whitespace-nowrap overflow-hidden"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-[#0D1421] border border-white/10 rounded-full items-center justify-center text-[#94A3B8] hover:text-white hover:border-white/30 transition-all shadow-lg z-50"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring' }}>
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.div>
        </button>
      </motion.aside>
    </>
  )
}
