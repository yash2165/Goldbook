'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params

  useEffect(() => {
    // Gracefully redirect legacy trade review links directly to the centralized Replay & Analysis console
    router.replace(`/analysis/trade-analysis?replay=${id}`)
  }, [id, router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-[#64748B] font-medium uppercase tracking-wider">
        Redirecting to Trade Replay Console...
      </p>
    </div>
  )
}
