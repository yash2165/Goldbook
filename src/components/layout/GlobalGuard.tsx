'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export function GlobalGuard({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      
      // Allow public routes
      if (pathname === '/' || pathname.startsWith('/auth')) {
        setLoading(false)
        return
      }

      if (!session) {
        router.push('/auth')
        setLoading(false)
        return
      }
      
      const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', session.user.id).single()
      
      if (!profile?.onboarding_completed && pathname !== '/onboarding') {
        router.push('/onboarding')
      } else if (profile?.onboarding_completed && pathname === '/onboarding') {
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    }
    checkAuth()
  }, [pathname])

  if (loading && pathname !== '/') return null

  return <>{children}</>
}
