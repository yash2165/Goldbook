'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { useMarketMode } from '@/context/MarketModeContext'
import {
  Send, Bot, Image as ImageIcon, Link as LinkIcon, X, Loader2, MessageSquare
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export function GlobalChat({ user, onOpenProfile }: { user: any, onOpenProfile: (username: string) => void }) {
  const [activeChannel, setActiveChannel] = useState<'english' | 'hindi'>('english')
  const [messages, setMessages] = useState<any[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  // Trade Embedder State
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [linkedTrade, setLinkedTrade] = useState<any | null>(null)

  // Media Attachment State
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const { activeAccount } = useAccounts()
  const { trades } = useTrades(activeAccount?.id)
  const { currencySymbol, formatCurrency } = useMarketMode()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load message history
  const loadMessages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('global_messages')
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url)
        `)
        .eq('channel', activeChannel)
        .order('created_at', { ascending: false })
        .limit(40)

      if (!error && data) {
        setMessages(data.reverse())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [activeChannel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel(`global_room:${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_messages',
          filter: `channel=eq.${activeChannel}`
        },
        async (payload) => {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single()

          // Fetch trade logs details if any
          let linkedTradeData = null
          if (payload.new.trade_id) {
            const { data: trade } = await supabase
              .from('trades')
              .select('*')
              .eq('id', payload.new.trade_id)
              .single()
            linkedTradeData = trade
          }

          const newMessage = {
            ...payload.new,
            profiles: senderProfile,
            trades: linkedTradeData
          }

          setMessages(prev => {
            if (prev.some((m: any) => m.id === (newMessage as any).id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeChannel])

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!inputMsg.trim() && !linkedTrade && !attachedImage) || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('global_messages')
        .insert({
          user_id: user.id,
          channel: activeChannel,
          content: inputMsg.trim() || (linkedTrade ? 'Shared a trade' : 'Sent an image'),
          trade_id: linkedTrade?.id || null,
          media_url: attachedImage || null
        })

      if (!error) {
        setInputMsg('')
        setLinkedTrade(null)
        setAttachedImage(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  // Handle file uploads
  const handleFileUpload = async (file: File) => {
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tradeId', 'global_chat_' + Date.now())

    try {
      const res = await fetch('/api/trades/upload-screenshot', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.screenshot?.url) {
        setAttachedImage(data.screenshot.url)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingImage(false)
    }
  }

  const closedTradesOnly = trades.filter(t => t.status === 'closed')

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07070b]">
      {/* Header */}
      <div className="h-12 border-b border-white/5 px-5 flex items-center justify-between shrink-0 bg-[#0d0d14]">
        <h2 className="text-xs font-black uppercase tracking-widest text-white leading-none flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Global Room Chats
        </h2>
        <div className="flex bg-[#060A12] border border-white/5 p-0.5 rounded-lg gap-0.5">
          {(['english', 'hindi'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => setActiveChannel(lang)}
              className={cn(
                'px-3.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                activeChannel === lang ? 'bg-primary/10 border border-primary/15 text-primary' : 'text-[#64748B] hover:text-white'
              )}
            >
              {lang === 'english' ? '🇬🇧 English' : '🇮🇳 Hindi'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages View Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[10px] text-[#64748B] uppercase tracking-wider font-bold py-16">No messages in this language channel. Start the chat!</p>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className="flex items-start gap-3 max-w-[85%] text-left">
              {/* Avatar */}
              <div 
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white shrink-0 text-xs select-none cursor-pointer"
                onClick={() => m.profiles?.username && onOpenProfile(m.profiles.username)}
              >
                {m.profiles?.avatar_url ? (
                  <img src={m.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  m.profiles?.username?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span 
                    className="text-xs font-extrabold text-white cursor-pointer hover:underline"
                    onClick={() => m.profiles?.username && onOpenProfile(m.profiles.username)}
                  >
                    {m.profiles?.display_name || m.profiles?.username || 'Trader'}
                  </span>
                  <span className="text-[8px] text-[#64748B] font-mono">{format(new Date(m.created_at), 'HH:mm')}</span>
                </div>

                <div className="bg-white/5 border border-white/[0.03] rounded-2xl rounded-tl-none px-3.5 py-2 text-xs text-white/90 leading-relaxed max-w-xl">
                  {m.content}
                  
                  {m.media_url && (
                    <img src={m.media_url} alt="Attached Media" className="w-full h-auto max-h-60 rounded-lg border border-white/10 object-cover mt-2" />
                  )}

                  {m.trade_id && m.trades && (
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 mt-2 space-y-2 text-white">
                      <div className="flex justify-between items-center text-[8px] font-mono text-[#64748B]">
                        <span className="uppercase tracking-widest font-black text-primary/80">Linked Verification Log</span>
                        <span className="uppercase tracking-widest font-bold">Closed</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[9px] font-black uppercase px-1 rounded', m.trades.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                            {m.trades.direction}
                          </span>
                          <span className="text-xs font-black text-white">{m.trades.symbol}</span>
                        </div>
                        <span className={cn('text-xs font-mono font-black', (m.trades.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                          {formatCurrency(m.trades.net_profit ?? 0)}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748B] font-mono">Entry: {m.trades.entry_price} • Exit: {m.trades.exit_price}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview */}
      {(attachedImage || linkedTrade) && (
        <div className="p-3.5 bg-black/40 border-t border-white/5 flex gap-2.5 items-center">
          {attachedImage && (
            <div className="relative rounded-lg overflow-hidden w-16 h-16 border border-white/10 shrink-0">
              <img src={attachedImage} alt="Attachment" className="w-full h-full object-cover" />
              <button onClick={() => setAttachedImage(null)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 text-[8px]">×</button>
            </div>
          )}

          {linkedTrade && (
            <div className="flex items-center justify-between bg-[#060A12] border border-white/10 rounded-lg p-2.5 flex-1 max-w-sm text-left">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[9px] font-black uppercase px-1 rounded', linkedTrade.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                    {linkedTrade.direction}
                  </span>
                  <span className="text-xs font-bold text-white">{linkedTrade.symbol}</span>
                </div>
                <p className="text-[10px] text-[#64748B] font-mono">Entry: {linkedTrade.entry_price} • Exit: {linkedTrade.exit_price}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className={cn('text-xs font-mono font-black', (linkedTrade.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(linkedTrade.net_profit ?? 0)}
                </span>
                <button onClick={() => setLinkedTrade(null)} className="text-[#EF4444] text-xs font-bold">×</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-[#070A0F] flex gap-2 items-center shrink-0">
        <input
          type="file"
          id="global-image-uploader"
          accept="image/*"
          className="hidden"
          onChange={e => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0])
          }}
        />
        <button
          type="button"
          disabled={uploadingImage}
          onClick={() => document.getElementById('global-image-uploader')?.click()}
          className="p-2.5 hover:bg-white/5 rounded-xl border border-white/5 text-[#64748B] hover:text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
          title="Upload Screenshot"
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4.5 h-4.5" />}
        </button>

        <button
          type="button"
          onClick={() => setShowTradeModal(true)}
          className="p-2.5 hover:bg-white/5 rounded-xl border border-white/5 text-[#64748B] hover:text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
          title="Embed Trade Log"
        >
          <LinkIcon className="w-4.5 h-4.5" />
        </button>

        <input
          type="text"
          placeholder={`Type a message in ${activeChannel === 'english' ? 'English' : 'Hindi'}...`}
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary/50 placeholder-[#64748B] h-10"
        />

        <button
          type="submit"
          disabled={(!inputMsg.trim() && !linkedTrade && !attachedImage) || sending}
          className="p-2.5 bg-primary hover:bg-primary/95 text-[#060A12] rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0 w-10 h-10"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>

      {/* Trade Selector Linker Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0D1421] border border-white/10 rounded-2xl w-full max-w-md p-5 flex flex-col h-[400px] shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3 shrink-0">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Embed a Verified Trade</h4>
              <button onClick={() => setShowTradeModal(false)} className="text-[#64748B] hover:text-white">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {closedTradesOnly.length === 0 ? (
                <p className="text-center text-xs text-[#64748B] uppercase tracking-wider font-bold py-12">No closed trade records found.</p>
              ) : (
                closedTradesOnly.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setLinkedTrade(t)
                      setShowTradeModal(false)
                    }}
                    className="w-full text-left p-3 rounded-xl bg-[#060A12] border border-white/5 hover:border-primary/30 hover:bg-white/2 transition-all flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[9px] font-black uppercase px-1 rounded', t.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                          {t.direction}
                        </span>
                        <span className="text-xs font-bold text-white">{t.symbol}</span>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono leading-none mt-0.5 block">{format(new Date(t.close_time || ''), 'yyyy-MM-dd')}</span>
                    </div>
                    <span className={cn('text-xs font-mono font-black', (t.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                      {formatCurrency(t.net_profit ?? 0)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
