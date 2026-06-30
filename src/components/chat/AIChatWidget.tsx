'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send, Bot, Loader2, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  role: 'user' | 'model'
  text: string
}

const SUGGESTIONS = [
  'How do I switch to Indian Markets?',
  'How does the CSV import work?',
  'What is the FIFO trade matcher?',
  'Tell me about the AI Coach.'
]

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('goldbook_ai_chat')
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    } else {
      // Set initial welcome message
      setMessages([
        { role: 'model', text: 'Hello! I am your Goldbook AI Assistant. How can I help you today with your trading journal or platform features?' }
      ])
    }
  }, [])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const saveMessages = (newMsgs: Message[]) => {
    setMessages(newMsgs)
    localStorage.setItem('goldbook_ai_chat', JSON.stringify(newMsgs))
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return
    
    const userMsg: Message = { role: 'user', text: textToSend }
    const updatedMsgs = [...messages, userMsg]
    saveMessages(updatedMsgs)
    setInput('')
    setLoading(true)

    try {
      // Map to API payload structure
      const payload = {
        messages: updatedMsgs.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.text) {
        saveMessages([...updatedMsgs, { role: 'model', text: data.text }])
      } else {
        saveMessages([...updatedMsgs, { role: 'model', text: 'Sorry, I encountered an issue. Please try again.' }])
      }
    } catch (err) {
      console.error(err)
      saveMessages([...updatedMsgs, { role: 'model', text: 'Network error. Please check your connection and try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    const defaultMsg: Message[] = [
      { role: 'model', text: 'Hello! I am your Goldbook AI Assistant. How can I help you today with your trading journal or platform features?' }
    ]
    saveMessages(defaultMsg)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-[360px] sm:w-[400px] h-[520px] bg-[#0A0D14] border border-[#1E3A5F]/40 shadow-[0_15px_40px_rgba(56,189,248,0.15)] rounded-2xl flex flex-col overflow-hidden mb-4 backdrop-blur-md"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-white/5 bg-[#0F1421]/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none">Goldbook Assistant</h4>
                  <span className="text-[9px] text-[#34D399] font-bold flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" /> Online
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  title="Clear Conversation"
                  className="p-1.5 hover:bg-white/5 text-[#64748B] hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/5 text-[#64748B] hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex max-w-[85%] flex-col rounded-2xl px-3 py-2 text-xs leading-relaxed transition-all duration-300',
                    m.role === 'user'
                      ? 'ml-auto bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#38BDF8] rounded-br-none'
                      : 'bg-white/5 border border-white/5 text-white/90 rounded-bl-none'
                  )}
                >
                  {m.text}
                </div>
              ))}
              {loading && (
                <div className="bg-white/5 border border-white/5 text-white/90 rounded-2xl rounded-bl-none px-3 py-2.5 text-xs max-w-[80%] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#38BDF8] animate-spin" />
                  <span className="text-[#64748B] font-medium">Assistant is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions */}
            {messages.length === 1 && !loading && (
              <div className="px-4 py-2 border-t border-white/5 bg-[#070A0F]/50 space-y-1">
                <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold block mb-1">Common Questions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSend(s)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded-md text-[10px] font-semibold border border-white/5 transition-all text-left truncate max-w-full cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend(input)
              }}
              className="p-3 border-t border-white/5 bg-[#070A0F] flex gap-2 items-center"
            >
              <input
                type="text"
                placeholder="Ask anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#38BDF8]/40 placeholder-[#64748B] transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#060A12] rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-[#38BDF8] cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center text-[#060A12] shadow-lg cursor-pointer transition-colors duration-300 relative border',
          isOpen 
            ? 'bg-white/10 border-white/20 text-white' 
            : 'bg-gradient-to-b from-[#38BDF8] to-[#0284C7] border-[#38BDF8]/30 shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:from-[#7DD3FC] hover:to-[#38BDF8]'
        )}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </motion.button>
    </div>
  )
}
