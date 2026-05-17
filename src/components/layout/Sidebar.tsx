'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  LineChart,
  BookOpen,
  BarChart2,
  Globe,
  Bot,
  FlaskConical,
  Users,
  Wrench,
  Settings,
  HelpCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  { name: 'My Rules', href: '/rules', icon: Shield },
  {
    name: 'Analysis',
    icon: BarChart2,
    children: [
      { name: 'Performance', href: '/analysis/performance' },
      { name: 'Trade Analysis', href: '/analysis/trade-analysis' },
      { name: 'Accounts', href: '/analysis/accounts' },
    ],
  },
  { name: 'Market', href: '/market', icon: Globe },
  { name: 'AI Report', href: '/ai-report', icon: Bot, badge: 'NEW' },
  { name: 'Backtesting', href: '/backtest', icon: FlaskConical, badge: 'BETA' },
  { name: 'Traders Lounge', href: '/community', icon: Users },
  { name: 'Tools', href: '/tools', icon: Wrench },
]

const SUPPORT_ITEMS: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help & Support', href: '/help', icon: HelpCircle },
]

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() =>
    item.children?.some(c => pathname.startsWith(c.href)) ?? false
  )

  const isActive = item.href
    ? pathname === item.href
    : item.children?.some(c => pathname.startsWith(c.href)) ?? false

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            isActive ? 'text-foreground' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.name}</span>
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="ml-7 mt-1 space-y-0.5 border-l border-white/5 pl-3">
            {item.children.map(child => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'block px-3 py-2 rounded-md text-sm transition-all',
                  pathname === child.href
                    ? 'text-primary bg-primary/10 font-medium'
                    : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
                )}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href!}
      title={collapsed ? item.name : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.name}</span>
          {item.badge && (
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
              item.badge === 'NEW' ? 'bg-primary/20 text-primary' : 'bg-[#1a1a2e] text-[#64748B]'
            )}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const sidebarContent = (
    <div className={cn(
      'flex flex-col h-full bg-[#0d0d14] border-r border-white/5 transition-all duration-300',
      collapsed ? 'w-[60px]' : 'w-[220px]'
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
        {!collapsed && (
          <Link href="/dashboard" className="font-bold text-xl tracking-tight">
            <span className="text-[#F59E0B]">Gold</span>
            <span className="text-foreground">Book</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-md text-[#64748B] hover:text-foreground hover:bg-white/5 transition-colors ml-auto"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#334155] mb-2">
            Menu
          </p>
        )}
        {NAV_ITEMS.map(item => (
          <NavLink key={item.name} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Support */}
      <div className="px-2 pb-2 space-y-0.5 border-t border-white/5 pt-3 shrink-0">
        {!collapsed && (
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#334155] mb-2">
            Support
          </p>
        )}
        {SUPPORT_ITEMS.map(item => (
          <NavLink key={item.name} item={item} collapsed={collapsed} />
        ))}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#64748B] hover:text-danger hover:bg-danger/5 transition-all"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex h-screen shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg border border-border"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="flex h-full">
            {sidebarContent}
          </div>
          <button
            className="flex-1 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  )
}
