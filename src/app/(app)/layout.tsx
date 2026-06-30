'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { DotGrid } from '@/components/DotGrid'
import { PageTransitionWrapper } from '@/components/PageTransitionWrapper'
import { MarketModeProvider } from '@/context/MarketModeContext'
import { AIChatWidget } from '@/components/chat/AIChatWidget'
import { VoiceRoomProvider, useVoiceRoom } from '@/context/VoiceRoomContext'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import { VoicePictureInPicture } from '@/components/community/VoicePictureInPicture'
import '@livekit/components-styles'

function GlobalLiveKitWrapper({ children }: { children: React.ReactNode }) {
  const { voiceConnected, voiceToken, voiceServerUrl, leaveVoiceRoom } = useVoiceRoom()

  if (voiceConnected && voiceToken && voiceServerUrl) {
    return (
      <LiveKitRoom
        video={true}
        audio={true}
        token={voiceToken}
        serverUrl={voiceServerUrl}
        options={{
          publishDefaults: {
            screenShareEncoding: {
              maxBitrate: 3000000,
              maxFramerate: 30,
            },
            videoEncoding: {
              maxBitrate: 1500000,
              maxFramerate: 30,
            }
          }
        }}
        data-lk-theme="default"
        style={{ 
          height: '100%', 
          background: 'transparent', 
          '--lk-bg': 'transparent', 
          '--lk-control-bar-bg': 'rgba(0,0,0,0.4)', 
          '--lk-border-color': 'rgba(255,255,255,0.05)',
          '--lk-grid-gap': '16px'
        } as any}
        onDisconnected={leaveVoiceRoom}
      >
        {children}
        <RoomAudioRenderer />
        <VoicePictureInPicture />
      </LiveKitRoom>
    )
  }

  return <>{children}</>
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketModeProvider>
      <VoiceRoomProvider>
        <GlobalLiveKitWrapper>
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
            <AIChatWidget />
          </div>
        </GlobalLiveKitWrapper>
      </VoiceRoomProvider>
    </MarketModeProvider>
  )
}
