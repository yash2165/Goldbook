'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  description?: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toast: (options: Omit<Toast, 'id'>) => void
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(({ message, description, type, duration = 4000 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, description, type, duration }])
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const success = useCallback((message: string, description?: string) => toast({ message, description, type: 'success' }), [toast])
  const error = useCallback((message: string, description?: string) => toast({ message, description, type: 'error' }), [toast])
  const warning = useCallback((message: string, description?: string) => toast({ message, description, type: 'warning' }), [toast])
  const info = useCallback((message: string, description?: string) => toast({ message, description, type: 'info' }), [toast])

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />,
    error: <XCircle className="w-5 h-5 text-[#EF4444]" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F59E0B] animate-pulse" />,
    info: <Info className="w-5 h-5 text-[#3B82F6]" />,
  }

  const borderColors = {
    success: 'border-[#22C55E]/30 shadow-[0_0_15px_rgba(34,197,94,0.08)]',
    error: 'border-[#EF4444]/30 shadow-[0_0_15px_rgba(239,68,68,0.08)]',
    warning: 'border-[#F59E0B]/30 shadow-[0_0_15px_rgba(245,159,11,0.12)]',
    info: 'border-[#3B82F6]/30 shadow-[0_0_15px_rgba(59,130,246,0.08)]',
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className={`pointer-events-auto w-full bg-[#0d0d14]/90 backdrop-blur-md border rounded-2xl p-4 flex gap-3.5 relative overflow-hidden ${borderColors[t.type]}`}
            >
              {/* Subtle top gold accent for warnings/violations */}
              {t.type === 'warning' && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
              )}
              
              <div className="shrink-0 pt-0.5">
                {icons[t.type]}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white tracking-tight">{t.message}</h4>
                {t.description && (
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{t.description}</p>
                )}
              </div>
              
              <button 
                onClick={() => removeToast(t.id)} 
                className="shrink-0 text-[#64748B] hover:text-white transition-colors h-fit p-0.5 rounded-lg hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
