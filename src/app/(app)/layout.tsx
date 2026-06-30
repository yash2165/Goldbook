import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { DotGrid } from '@/components/DotGrid'
import { PageTransitionWrapper } from '@/components/PageTransitionWrapper'
import { MarketModeProvider } from '@/context/MarketModeContext'
import { AIChatWidget } from '@/components/chat/AIChatWidget'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketModeProvider>
      <div className="flex h-screen overflow-hidden bg-transparent">
        <DotGrid />
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto relative">
            <PageTransitionWrapper>
              {children}
            </PageTransitionWrapper>
          </main>
        </div>
        <AIChatWidget />
      </div>
    </MarketModeProvider>
  )
}


