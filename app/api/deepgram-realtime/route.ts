import { NextRequest } from 'next/server'
import { createClient } from '@deepgram/sdk'

export async function POST(request: NextRequest) {
  if (!process.env.DEEPGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: 'Deepgram API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const encoder = new TextEncoder()
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY)

  const stream = new ReadableStream({
    start(controller) {
      let deepgramSocket: any = null

      const setupDeepgramConnection = async () => {
        try {
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
            console.log('Deepgram realtime connection opened')
            const data = JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          deepgramSocket.addListener('Results', (data: any) => {
            const result = data.channel?.alternatives?.[0]
            if (result && result.transcript) {
              const response = {
                type: 'transcript',
                transcript: result.transcript,
                is_final: data.is_final,
                confidence: result.confidence,
                timestamp: new Date().toISOString(),
                speakers: []
              }

              // 話者ダイアライゼーション処理
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

              const eventData = JSON.stringify(response)
              controller.enqueue(encoder.encode(`data: ${eventData}\n\n`))
            }
          })

          deepgramSocket.addListener('UtteranceEnd', () => {
            const data = JSON.stringify({
              type: 'utterance_end',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          deepgramSocket.addListener('SpeechStarted', () => {
            const data = JSON.stringify({
              type: 'speech_started', 
              timestamp: new Date().toISOString()
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          deepgramSocket.addListener('error', (error: any) => {
            console.error('Deepgram realtime error:', error)
            const data = JSON.stringify({
              type: 'error',
              error: error.message || 'Deepgram error',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          deepgramSocket.addListener('close', () => {
            console.log('Deepgram realtime connection closed')
            controller.close()
          })

        } catch (error) {
          console.error('Setup error:', error)
          const data = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Setup error',
            timestamp: new Date().toISOString()
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          controller.close()
        }
      }

      // 接続セットアップ
      setupDeepgramConnection()

      // 接続を保持するためのハートビート
      const heartbeat = setInterval(() => {
        const data = JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch (error) {
          clearInterval(heartbeat)
          if (deepgramSocket) {
            deepgramSocket.finish()
          }
        }
      }, 30000)

      // クリーンアップ処理
      request.signal?.addEventListener('abort', () => {
        clearInterval(heartbeat)
        if (deepgramSocket) {
          deepgramSocket.finish()
        }
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// 音声データを受信してDeepgramに送信するエンドポイント
export async function PUT(request: NextRequest) {
  if (!process.env.DEEPGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: 'Deepgram API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.arrayBuffer()
    const audioBuffer = new Uint8Array(body)
    
    // ここでDeepgramのリアルタイム接続に音声データを送信
    // 実際の実装では、セッション管理が必要
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Audio processing error:', error)
    return new Response(JSON.stringify({ error: 'Audio processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}