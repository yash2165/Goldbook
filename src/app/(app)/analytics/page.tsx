'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AnalyticsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/analysis/performance')
  }, [router])

  return (
    <div className="flex h-[80vh] items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#64748B] font-medium">Redirecting to live performance analytics...</p>
      </div>
    </div>
  )
}
