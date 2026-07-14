'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, LineChart, BookOpen, BarChart2, Globe, Bot, FlaskConical, Users, Wrench, Settings, HelpCircle, Shield, Menu, X, LogOut, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import GoldBookLogo from '@/components/GoldBookLogo'
import LineSidebar, { NavItem } from './LineSidebar'

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
        className="md:hidden fixed top-3 left-4 z-60 p-2.5 bg-[#030712]/90 border border-white/10 rounded-xl text-white backdrop-blur-md transition-all active:scale-95 shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 bg-black z-50"
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ 
          width: collapsed ? 72 : 240,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 bg-gradient-to-b from-[#030712] via-[#080E1C] to-[#030712] border-r border-white/[0.04] flex flex-col transition-transform duration-300 backdrop-blur-md shadow-2xl',
          mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header Branding */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.04] shrink-0 overflow-hidden relative">
          {/* Neon backing glow for the brand logo */}
          <div className="absolute top-1/2 left-6 -translate-y-1/2 w-10 h-10 bg-[#38BDF8]/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <GoldBookLogo size={32} className="shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all hover:scale-105" />
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 space-y-8 no-scrollbar relative">
          {/* Main Menu */}
          <div className="space-y-3">
            <AnimatePresence>
              {!collapsed && (
                <motion.p 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 0.35 }} 
                  exit={{ opacity: 0 }}
                  className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1 whitespace-nowrap"
                >
                  Menu
                </motion.p>
              )}
            </AnimatePresence>
            <LineSidebar items={NAV_ITEMS} collapsed={collapsed} />
          </div>

          {/* Preferences */}
          <div className="space-y-3 pt-4 border-t border-white/[0.02]">
            <AnimatePresence>
              {!collapsed && (
                <motion.p 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 0.35 }} 
                  exit={{ opacity: 0 }}
                  className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1 whitespace-nowrap"
                >
                  Preferences
                </motion.p>
              )}
            </AnimatePresence>
            <LineSidebar items={SUPPORT_ITEMS} collapsed={collapsed} />
          </div>
        </div>

        {/* Footer Area */}
        <div className="p-3 border-t border-white/[0.04] bg-[#030712]/40 backdrop-blur-sm">
          <button
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all text-[#EF4444] hover:bg-[#EF4444]/10 active:scale-[0.98] group border border-transparent hover:border-[#EF4444]/10",
              collapsed ? "justify-center" : "gap-3"
            )}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 text-left whitespace-nowrap overflow-hidden font-semibold"
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
          className="hidden md:flex absolute -right-3.5 top-20 w-7 h-7 bg-[#080E1C] border border-white/10 hover:border-white/30 rounded-full items-center justify-center text-[#94A3B8] hover:text-white transition-all shadow-xl z-50 active:scale-90"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring' }}>
            <ChevronRight className="w-4 h-4" />
          </motion.div>
        </button>
      </motion.aside>
    </>
  )
}
