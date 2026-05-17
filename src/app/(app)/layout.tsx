import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { DotGrid } from '@/components/DotGrid'
import { PageTransitionWrapper } from '@/components/PageTransitionWrapper'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
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
    </div>
  )
}
