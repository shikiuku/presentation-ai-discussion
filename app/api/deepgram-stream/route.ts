import { NextRequest } from 'next/server'
import { createClient } from '@deepgram/sdk'

export async function GET(request: NextRequest) {
  if (!process.env.DEEPGRAM_API_KEY) {
    return new Response('Deepgram API key not configured', { status: 500 })
  }

  const { socket, response } = Deno.upgradeWebSocket(request)
  
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY)
  let deepgramSocket: any = null

  socket.onopen = () => {
    console.log('Client WebSocket connected')
    
    // Deepgramライブ転写接続を開始
    deepgramSocket = deepgram.listen.live({
      model: 'nova-2',
      language: 'ja',
      punctuate: true,
      diarize: true,
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      endpointing: 300,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    })

    deepgramSocket.addListener('open', () => {
      console.log('Deepgram WebSocket connected')
      socket.send(JSON.stringify({ type: 'connected' }))
    })

    deepgramSocket.addListener('Results', (data: any) => {
      const result = data.channel?.alternatives?.[0]
      if (result) {
        const response = {
          type: 'transcript',
          transcript: result.transcript,
          is_final: data.is_final,
          confidence: result.confidence,
          timestamp: new Date().toISOString(),
          speakers: []
        }

        // 話者ダイアライゼーション結果の処理
        if (data.channel?.alternatives?.[0]?.words) {
          const words = data.channel.alternatives[0].words
          let currentSpeaker = null
          let currentText = ''
          let currentStartTime = null
          const speakers = []

          for (const word of words) {
            const speakerTag = (word.speaker || 0) + 1
            
            if (currentSpeaker !== speakerTag) {
              if (currentSpeaker !== null && currentText.trim()) {
                speakers.push({
                  speakerTag: currentSpeaker,
                  text: currentText.trim(),
                  startTime: currentStartTime,
                  endTime: word.start
                })
              }
              currentSpeaker = speakerTag
              currentText = word.punctuated_word || word.word || ''
              currentStartTime = word.start
            } else {
              currentText += ' ' + (word.punctuated_word || word.word || '')
            }
          }

          if (currentText.trim() && words.length > 0) {
            const lastWord = words[words.length - 1]
            speakers.push({
              speakerTag: currentSpeaker,
              text: currentText.trim(),
              startTime: currentStartTime,
              endTime: lastWord.end
            })
          }

          response.speakers = speakers
        }

        socket.send(JSON.stringify(response))
      }
    })

    deepgramSocket.addListener('UtteranceEnd', (data: any) => {
      socket.send(JSON.stringify({
        type: 'utterance_end',
        timestamp: new Date().toISOString()
      }))
    })

    deepgramSocket.addListener('SpeechStarted', (data: any) => {
      socket.send(JSON.stringify({
        type: 'speech_started',
        timestamp: new Date().toISOString()
      }))
    })

    deepgramSocket.addListener('error', (error: any) => {
      console.error('Deepgram error:', error)
      socket.send(JSON.stringify({
        type: 'error',
        error: error.message || 'Deepgram error'
      }))
    })
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      
      if (data.type === 'audio' && deepgramSocket) {
        // Base64エンコードされた音声データをバイナリに変換
        const audioBuffer = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))
        deepgramSocket.send(audioBuffer)
      }
    } catch (error) {
      console.error('Message processing error:', error)
    }
  }

  socket.onclose = () => {
    console.log('Client WebSocket disconnected')
    if (deepgramSocket) {
      deepgramSocket.finish()
      deepgramSocket = null
    }
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
    if (deepgramSocket) {
      deepgramSocket.finish()
      deepgramSocket = null
    }
  }

  return response
}