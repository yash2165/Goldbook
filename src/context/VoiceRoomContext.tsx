'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'

interface VoiceRoomContextType {
  voiceToken: string
  voiceServerUrl: string
  voiceConnected: boolean
  voiceLoading: boolean
  voiceRoomName: string
  voiceRoomType: 'public' | 'private'
  joinVoiceRoom: (roomName: string, isPrivate: boolean) => Promise<boolean>
  leaveVoiceRoom: () => void
}

const VoiceRoomContext = createContext<VoiceRoomContextType | undefined>(undefined)

export function VoiceRoomProvider({ children }: { children: React.ReactNode }) {
  const [voiceToken, setVoiceToken] = useState('')
  const [voiceServerUrl, setVoiceServerUrl] = useState('')
  const [voiceConnected, setVoiceConnected] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceRoomName, setVoiceRoomName] = useState('trading-floor')
  const [voiceRoomType, setVoiceRoomType] = useState<'public' | 'private'>('public')
  
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  const joinVoiceRoom = async (roomName: string, isPrivate: boolean): Promise<boolean> => {
    setVoiceLoading(true)
    setVoiceRoomName(roomName)
    setVoiceRoomType(isPrivate ? 'private' : 'public')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      // If it's private, verify room request approval unless we are the creator
      if (isPrivate) {
        // Fetch room creator
        const { data: roomData } = await supabase
          .from('voice_rooms')
          .select('created_by')
          .eq('name', roomName)
          .single()

        if (roomData && roomData.created_by !== user.id) {
          // Check if we have an approved request
          const { data: request } = await supabase
            .from('voice_room_requests')
            .select('status')
            .eq('room_id', roomName) // Or resolving room UUID
            .eq('user_id', user.id)
            .single()

          if (!request || request.status !== 'approved') {
            showError('Access Denied', 'You must request to join this private room first.')
            setVoiceLoading(false)
            return false
          }
        }
      }

      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName })
      })
      const data = await res.json()
      if (data.token) {
        setVoiceToken(data.token)
        setVoiceServerUrl(data.url)
        setVoiceConnected(true)
        return true
      }
      return false
    } catch (e: any) {
      console.error(e)
      showError('Connection Error', e.message || 'Failed to connect to LiveKit.')
      return false
    } finally {
      setVoiceLoading(false)
    }
  }

  const leaveVoiceRoom = () => {
    setVoiceConnected(false)
    setVoiceToken('')
    setVoiceServerUrl('')
  }

  return (
    <VoiceRoomContext.Provider
      value={{
        voiceToken,
        voiceServerUrl,
        voiceConnected,
        voiceLoading,
        voiceRoomName,
        voiceRoomType,
        joinVoiceRoom,
        leaveVoiceRoom
      }}
    >
      {children}
    </VoiceRoomContext.Provider>
  )
}

export function useVoiceRoom() {
  const context = useContext(VoiceRoomContext)
  if (!context) {
    throw new Error('useVoiceRoom must be used within a VoiceRoomProvider')
  }
  return context
}
