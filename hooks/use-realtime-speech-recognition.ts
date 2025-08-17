import { useState, useEffect, useCallback, useRef } from 'react'

export interface RealtimeTranscriptResult {
  text: string
  isFinal: boolean
  confidence: number
  timestamp: Date
  speaker?: {
    speakerTag: number
    speakerName: string
  }
}

export interface UseRealtimeSpeechRecognitionProps {
  lang?: string
  onResult?: (result: RealtimeTranscriptResult) => void
  onError?: (error: string) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
}

export interface UseRealtimeSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  isConnected: boolean
  transcript: string
  interimTranscript: string
  start: () => void
  stop: () => void
  error: string | null
  speakers: { [key: number]: string }
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export function useRealtimeSpeechRecognition({
  lang = 'ja-JP',
  onResult,
  onError,
  onStatusChange,
}: UseRealtimeSpeechRecognitionProps = {}): UseRealtimeSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [speakers, setSpeakers] = useState<{ [key: number]: string }>({})
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const processingRef = useRef(false)

  // ブラウザサポートチェック
  useEffect(() => {
    const checkSupport = () => {
      try {
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
        const hasMediaDevices = typeof navigator !== 'undefined' && 
                              navigator.mediaDevices && 
                              typeof navigator.mediaDevices.getUserMedia === 'function'
        const hasWebSocket = typeof WebSocket !== 'undefined'
        const hasSecureContext = window.isSecureContext || 
                               window.location.protocol === 'https:' || 
                               window.location.hostname === 'localhost'
        
        return hasMediaRecorder && hasMediaDevices && hasWebSocket && hasSecureContext
      } catch (error) {
        console.error('Support check error:', error)
        return false
      }
    }
    
    setIsSupported(checkSupport())
  }, [])

  // ステータス変更通知
  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  // 話者名を生成
  const generateSpeakerName = useCallback((speakerTag: number): string => {
    setSpeakers(prev => {
      const existingName = prev[speakerTag]
      if (existingName) {
        return prev
      }
      
      const speakerNames = ['話者A', '話者B', '話者C', '話者D', '話者E']
      const newName = speakerNames[speakerTag - 1] || `話者${speakerTag}`
      
      return {
        ...prev,
        [speakerTag]: newName
      }
    })
    
    const speakerNames = ['話者A', '話者B', '話者C', '話者D', '話者E']
    return speakerNames[speakerTag - 1] || `話者${speakerTag}`
  }, [])

  // 継続的な音声送信
  const sendAudioContinuously = useCallback(() => {
    if (!mediaRecorderRef.current || !websocketRef.current || 
        websocketRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    if (processingRef.current) {
      return // 既に処理中の場合は重複実行を防ぐ
    }

    processingRef.current = true

    try {
      // 小さなチャンクで録音データを送信
      mediaRecorderRef.current.requestData()
      
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = [] // チャンクをクリア
        
        if (audioBlob.size > 0) {
          // Blobを Base64 に変換して送信
          const reader = new FileReader()
          reader.onload = () => {
            if (websocketRef.current?.readyState === WebSocket.OPEN) {
              const base64Audio = (reader.result as string).split(',')[1]
              websocketRef.current.send(JSON.stringify({
                type: 'audio',
                audio: base64Audio,
                timestamp: Date.now()
              }))
            }
          }
          reader.readAsDataURL(audioBlob)
        }
      }
    } catch (error) {
      console.error('Audio sending error:', error)
    } finally {
      processingRef.current = false
    }
  }, [])

  // リアルタイム音声処理の開始
  const startRealtimeRecognition = useCallback(async () => {
    try {
      setStatus('connecting')
      setError(null)

      // 音声ストリーム取得
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      
      audioStreamRef.current = stream

      // WebSocket接続 (EventSourceで代替も可能)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/deepgram-stream`
      
      // WebSocketが使えない場合はEventSourceを使用
      try {
        websocketRef.current = new WebSocket(wsUrl)
      } catch (wsError) {
        console.log('WebSocket not available, falling back to polling')
        // EventSourceまたはポーリングの実装
        throw new Error('WebSocket not supported, implementing fallback')
      }

      websocketRef.current.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setStatus('connected')
      }

      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          switch (data.type) {
            case 'transcript':
              if (data.speakers && data.speakers.length > 0) {
                // 話者識別ありの場合
                data.speakers.forEach((speakerSegment: any) => {
                  const speakerName = generateSpeakerName(speakerSegment.speakerTag)
                  const result: RealtimeTranscriptResult = {
                    text: speakerSegment.text,
                    isFinal: data.is_final,
                    confidence: data.confidence || 0.8,
                    timestamp: new Date(),
                    speaker: {
                      speakerTag: speakerSegment.speakerTag,
                      speakerName: speakerName
                    }
                  }
                  onResult?.(result)
                })
              } else if (data.transcript) {
                // 話者識別なしの場合
                const result: RealtimeTranscriptResult = {
                  text: data.transcript,
                  isFinal: data.is_final,
                  confidence: data.confidence || 0.8,
                  timestamp: new Date(),
                }
                
                if (data.is_final) {
                  setTranscript(prev => prev + data.transcript + ' ')
                  onResult?.(result)
                } else {
                  setInterimTranscript(data.transcript)
                }
              }
              break
              
            case 'error':
              console.error('WebSocket error:', data.error)
              setError(data.error)
              onError?.(data.error)
              break
          }
        } catch (parseError) {
          console.error('Message parse error:', parseError)
        }
      }

      websocketRef.current.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        setStatus('disconnected')
      }

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('接続エラーが発生しました')
        setStatus('error')
        onError?.('接続エラーが発生しました')
      }

      // MediaRecorder設定
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm'
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options)
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      // 短いインターバルで録音データを送信
      mediaRecorderRef.current.start(250) // 250msごとにデータを生成
      
      // 定期的に音声データを送信
      const sendInterval = setInterval(() => {
        if (!isListening) {
          clearInterval(sendInterval)
          return
        }
        sendAudioContinuously()
      }, 300)

    } catch (err) {
      console.error('Realtime recognition start error:', err)
      const errorMessage = `リアルタイム音声認識開始エラー: ${err instanceof Error ? err.message : '不明なエラー'}`
      setError(errorMessage)
      setStatus('error')
      onError?.(errorMessage)
      setIsListening(false)
    }
  }, [isListening, sendAudioContinuously, generateSpeakerName, onResult, onError])

  // 録音開始
  const start = useCallback(() => {
    if (!isSupported) {
      const errorMessage = 'このブラウザはリアルタイム音声認識をサポートしていません'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    if (isListening) {
      return
    }
    
    setError(null)
    setInterimTranscript('')
    setIsListening(true)
    startRealtimeRecognition()
  }, [isSupported, isListening, startRealtimeRecognition, onError])

  // 録音停止
  const stop = useCallback(() => {
    setIsListening(false)
    setInterimTranscript('')
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }
    
    setIsConnected(false)
    setStatus('disconnected')
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    isListening,
    isSupported,
    isConnected,
    transcript,
    interimTranscript,
    start,
    stop,
    error,
    speakers,
    status,
  }
}