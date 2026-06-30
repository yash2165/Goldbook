'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useVoiceRoom } from '@/context/VoiceRoomContext'
import {
  useTracks,
  useLocalParticipant,
  ParticipantTile
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Volume2, Move
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function VoicePictureInPicture() {
  const router = useRouter()
  const pathname = usePathname()
  const { voiceConnected, voiceRoomName, leaveVoiceRoom } = useVoiceRoom()
  
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false })
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const { localParticipant } = useLocalParticipant()

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Only render PIP if connected and NOT on the community voice channel page itself
  if (!voiceConnected || pathname === '/community') {
    return null
  }

  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false
  const hasScreenShare = screenShareTracks.length > 0

  const toggleMic = () => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)
    }
  }

  const toggleCamera = () => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)
    }
  }

  return (
    <div 
      className="fixed bottom-6 right-6 z-[99] bg-[#0c0c14] border border-primary/20 rounded-2xl shadow-2xl overflow-hidden w-72 flex flex-col transition-all duration-300"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
    >
      {/* Header bar / drag handle */}
      <div 
        className="px-3.5 py-2 border-b border-white/5 bg-[#0b0f17] flex items-center justify-between cursor-move select-none"
        onMouseDown={(e) => {
          setIsDragging(true)
          setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
          })
        }}
        onMouseMove={(e) => {
          if (isDragging) {
            setPosition({
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y
            })
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <span className="text-[9px] font-black uppercase tracking-wider text-primary flex items-center gap-1 leading-none">
          <Volume2 className="w-3 h-3 animate-pulse" /> Floor: {voiceRoomName}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => router.push('/community?tab=voice')} 
            className="text-[#64748B] hover:text-white transition-colors"
            title="Open Full Grid"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Screen Presentation / Speaker Video PIP display */}
      <div className="aspect-video bg-black relative border-b border-white/5 flex items-center justify-center">
        {hasScreenShare ? (
          <ParticipantTile trackRef={screenShareTracks[0]} className="w-full h-full object-contain" />
        ) : cameraTracks.length > 0 ? (
          <ParticipantTile trackRef={cameraTracks[0]} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center space-y-1.5 select-none">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 animate-pulse">
              <Mic className="w-4 h-4" />
            </div>
            <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Audio call connected</p>
          </div>
        )}
      </div>

      {/* Action Controls toolbar */}
      <div className="p-2.5 flex items-center justify-around bg-[#080B11]/90">
        <button
          onClick={toggleMic}
          className={cn(
            'p-2 rounded-xl transition-all cursor-pointer border',
            isMicEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/25'
          )}
        >
          {isMicEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={toggleCamera}
          className={cn(
            'p-2 rounded-xl transition-all cursor-pointer border',
            isCameraEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/25'
          )}
        >
          {isCameraEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={leaveVoiceRoom}
          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center border border-transparent shadow-lg shadow-red-500/10"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
