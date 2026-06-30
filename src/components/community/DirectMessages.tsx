'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { useMarketMode } from '@/context/MarketModeContext'
import {
  Send, Bot, Image as ImageIcon, Link as LinkIcon, X, Loader2, MessageSquare, Plus, Users
} from 'lucide-react'
import { format } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export function DirectMessages({ user }: { user: any }) {
  const searchParams = useSearchParams()
  const activeParamId = searchParams.get('id')

  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState<'direct' | 'group'>('direct')
  const [usernameInput, setUsernameInput] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  // Trade Embedder State
  const [showTradeModal, setShowTradeModal] = useState(false)

  const { activeAccount } = useAccounts()
  const { trades } = useTrades(activeAccount?.id)
  const { currencySymbol, formatCurrency } = useMarketMode()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversations list
  const loadConversations = async (selectConvId?: string) => {
    try {
      const res = await fetch('/api/messages/conversations')
      const data = await res.json()
      if (res.ok && data.conversations) {
        setConversations(data.conversations)
        if (selectConvId) {
          const matched = data.conversations.find((c: any) => c.id === selectConvId)
          if (matched) setActiveConv(matched)
        } else if (data.conversations.length > 0 && !activeConv) {
          setActiveConv(data.conversations[0])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingConvs(false)
    }
  }

  // Load message history for active conversation
  const loadMessages = async (convId: string) => {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/messages/conversations/${convId}/messages`)
      const data = await res.json()
      if (res.ok && data.messages) {
        setMessages(data.messages)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMsgs(false)
    }
  }

  // Fetch friends list for Group Chat selector
  const loadFriends = async () => {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted')

    if (friendships && friendships.length > 0) {
      const friendIds = friendships.map(f => f.user_id === user.id ? f.friend_id : f.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', friendIds)
      
      if (profiles) setFriends(profiles)
    }
  }

  useEffect(() => {
    loadConversations(activeParamId || undefined)
    loadFriends()
  }, [activeParamId])

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id)
    } else {
      setMessages([])
    }
  }, [activeConv])

  // Scroll messages list to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time listener for incoming direct messages
  useEffect(() => {
    if (!activeConv) return

    const channel = supabase
      .channel(`conversation:${activeConv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${activeConv.id}`
        },
        async (payload) => {
          // If message is already present, skip
          if (messages.some(m => m.id === payload.new.id)) return

          // Fetch sender details
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single()

          // Fetch trade details if linked
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
            sender: senderProfile,
            trades: linkedTradeData
          }

          setMessages((prev: any[]) => {
            if (prev.some((m: any) => m.id === (newMessage as any).id)) return prev
            return [...prev, newMessage]
          })
          
          // Mark conversation as updated in list
          setConversations(prev => prev.map(c => {
            if (c.id === activeConv.id) {
              return { ...c, last_message_at: payload.new.created_at }
            }
            return c
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConv, messages])

  // Send message handler
  const handleSendMessage = async (textToSend: string, tradeIdToEmbed?: string) => {
    if (!activeConv || (!textToSend.trim() && !tradeIdToEmbed) || sendingMsg) return

    setSendingMsg(true)
    try {
      const res = await fetch(`/api/messages/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textToSend,
          type: tradeIdToEmbed ? 'trade_card' : 'text',
          tradeId: tradeIdToEmbed || null
        })
      })

      const data = await res.json()
      if (res.ok && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
        setInputMsg('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSendingMsg(false)
    }
  }

  // Create Conversation DM or Group
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      if (createType === 'direct') {
        const cleanName = usernameInput.toLowerCase().trim()
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanName)
          .single()

        if (error || !profile) {
          alert('Trader username not found')
          setCreating(false)
          return
        }

        const res = await fetch('/api/messages/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'direct', recipientId: profile.id })
        })

        const data = await res.json()
        if (res.ok && data.conversation) {
          await loadConversations(data.conversation.id)
          setShowCreateModal(false)
        }
      } else {
        // Group Chat
        const res = await fetch('/api/messages/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'group',
            name: groupName,
            memberIds: selectedFriends
          })
        })

        const data = await res.json()
        if (res.ok && data.conversation) {
          await loadConversations(data.conversation.id)
          setShowCreateModal(false)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const toggleSelectFriend = (id: string) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#07070b]">
      {/* Conversations Left Panel */}
      <div className="w-64 border-r border-white/5 flex flex-col bg-[#0c0c14] shrink-0">
        <div className="px-4 py-3.5 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">Conversations</span>
          <button
            onClick={() => {
              setShowCreateModal(true)
              setUsernameInput('')
              setGroupName('')
              setSelectedFriends([])
            }}
            className="p-1.5 hover:bg-white/5 text-primary hover:text-white rounded-lg transition-colors border border-primary/20 bg-primary/5 cursor-pointer"
            title="New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 no-scrollbar">
          {loadingConvs ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-[10px] text-[#64748B] uppercase tracking-wider font-bold py-12">No active chats.</p>
          ) : (
            conversations.map(c => {
              const isActive = activeConv?.id === c.id
              const otherMember = c.otherMember

              return (
                <button
                  key={c.id}
                  onClick={() => setActiveConv(c)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer',
                    isActive ? 'bg-[#38BDF8]/10 text-white border border-[#38BDF8]/20' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0 overflow-hidden border border-white/10">
                    {c.type === 'direct' && otherMember?.avatar_url ? (
                      <img src={otherMember.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      c.type === 'direct' ? otherMember?.username?.charAt(0).toUpperCase() : <Users className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-white truncate">
                      {c.type === 'direct' ? (otherMember?.display_name || otherMember?.username || 'Trader') : c.name}
                    </p>
                    <p className="text-[10px] text-[#64748B] truncate mt-0.5 font-mono">
                      {c.last_message_at ? format(new Date(c.last_message_at), 'HH:mm') : 'No messages'}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Messages Thread Right Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#07070b]">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="h-12 border-b border-white/5 px-5 flex items-center justify-between shrink-0 bg-[#0d0d14]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs border border-white/10 overflow-hidden">
                  {activeConv.type === 'direct' && activeConv.otherMember?.avatar_url ? (
                    <img src={activeConv.otherMember.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    activeConv.type === 'direct' ? activeConv.otherMember?.username?.charAt(0).toUpperCase() : <Users className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs font-black uppercase text-white tracking-wide">
                  {activeConv.type === 'direct' ? (activeConv.otherMember?.display_name || activeConv.otherMember?.username || 'Trader') : activeConv.name}
                </span>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {loadingMsgs ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-[10px] text-[#64748B] uppercase tracking-wider font-bold py-12">Send a message to start the conversation.</p>
              ) : (
                messages.map(m => {
                  const isMe = m.sender_id === user.id
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-start gap-2.5 max-w-[75%] animate-in fade-in duration-200',
                        isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                      )}
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white shrink-0 text-[10px]">
                        {m.sender?.avatar_url ? (
                          <img src={m.sender.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          m.sender?.username?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>

                      {/* Msg bubble container */}
                      <div className="space-y-1">
                        <div
                          className={cn(
                            'rounded-2xl px-3 py-2 text-xs leading-relaxed border',
                            isMe
                              ? 'bg-[#38BDF8]/10 border-[#38BDF8]/25 text-[#38BDF8] rounded-tr-none'
                              : 'bg-white/5 border-white/5 text-white/90 rounded-tl-none'
                          )}
                        >
                          {m.type === 'trade_card' && m.trades ? (
                            /* Embed trade card */
                            <div className="space-y-2 text-left min-w-[200px] text-white">
                              <div className="flex justify-between items-center text-[9px] font-mono text-[#64748B]">
                                <span className="uppercase tracking-widest font-black text-primary/80">Embedded Trade Verification</span>
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
                          ) : (
                            m.content
                          )}
                        </div>
                        <span className={cn('text-[8px] text-[#64748B] font-mono block', isMe ? 'text-right' : 'text-left')}>
                          {format(new Date(m.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage(inputMsg)
              }}
              className="p-3 border-t border-white/5 bg-[#070A0F] flex gap-2 items-center shrink-0"
            >
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
                placeholder="Send a message..."
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50 placeholder-[#64748B] transition-colors h-10"
              />
              <button
                type="submit"
                disabled={!inputMsg.trim() || sendingMsg}
                className="p-2.5 bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#060A12] rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-[#38BDF8] cursor-pointer flex items-center justify-center shrink-0 w-10 h-10"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-[#64748B]">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-white tracking-wider">Direct Messenger</h3>
              <p className="text-xs text-[#64748B] max-w-sm mt-1 leading-relaxed">
                Start a private conversation or select an active DM list item on the left panel to engage with other traders.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DM/Group Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCreateSubmit} className="bg-[#0D1421] border border-white/10 rounded-2xl w-full max-w-md p-5 flex flex-col space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 shrink-0">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">New Conversation</h4>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-[#64748B] hover:text-white">✕</button>
            </div>

            <div className="flex bg-[#060A12] border border-white/10 rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setCreateType('direct')}
                className={cn('flex-1 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all', createType === 'direct' ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'text-[#64748B]')}
              >
                Direct Message
              </button>
              <button
                type="button"
                onClick={() => setCreateType('group')}
                className={cn('flex-1 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all', createType === 'group' ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'text-[#64748B]')}
              >
                Group Chat
              </button>
            </div>

            {createType === 'direct' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Trader Username</label>
                <input
                  type="text"
                  placeholder="Enter exact username..."
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                  required
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Group Name</label>
                  <input
                    type="text"
                    placeholder="Enter group name..."
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Select Friends ({selectedFriends.length})</label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 no-scrollbar">
                    {friends.length === 0 ? (
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold py-4">Add friends to start group chats.</p>
                    ) : (
                      friends.map(f => {
                        const isChecked = selectedFriends.includes(f.id)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => toggleSelectFriend(f.id)}
                            className={cn('w-full flex items-center justify-between p-2 rounded-lg bg-[#060A12] border transition-all text-xs', isChecked ? 'border-primary/55' : 'border-white/5')}
                          >
                            <span className="text-white font-semibold">{f.username}</span>
                            <span className={cn('w-4 h-4 rounded border flex items-center justify-center', isChecked ? 'border-primary bg-primary/10 text-primary' : 'border-white/10')}>
                              {isChecked && '✓'}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full h-11 bg-[#38BDF8] hover:bg-[#7DD3FC] text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              {creating ? 'Starting chat...' : 'Start Chat'}
            </button>
          </form>
        </div>
      )}

      {/* Trade Selector Linker Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0D1421] border border-white/10 rounded-2xl w-full max-w-md p-5 flex flex-col h-[400px] shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3 shrink-0">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Embed a Verified Trade</h4>
              <button onClick={() => setShowTradeModal(false)} className="text-[#64748B] hover:text-white">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {trades.length === 0 ? (
                <p className="text-center text-xs text-[#64748B] uppercase tracking-wider font-bold py-12">No active trade records found.</p>
              ) : (
                trades.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      handleSendMessage('', t.id)
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
                      <span className="text-[10px] text-[#64748B] font-mono leading-none mt-0.5 block">{t.status === 'open' ? 'Active Position' : format(new Date(t.close_time || ''), 'yyyy-MM-dd')}</span>
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
