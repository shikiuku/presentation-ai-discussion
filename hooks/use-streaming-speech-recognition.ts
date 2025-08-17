import { useState, useEffect, useCallback, useRef } from 'react'

export interface StreamingTranscriptResult {
  text: string
  isFinal: boolean
  confidence: number
  timestamp: Date
  speaker?: {
    speakerTag: number
    speakerName: string
  }
}

export interface UseStreamingSpeechRecognitionProps {
  lang?: string
  chunkSize?: number // 音声チャンクのサイズ（ms）
  onResult?: (result: StreamingTranscriptResult) => void
  onError?: (error: string) => void
}

export interface UseStreamingSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  start: () => void
  stop: () => void
  error: string | null
  speakers: { [key: number]: string }
}

export function useStreamingSpeechRecognition({
  lang = 'ja-JP',
  chunkSize = 1000, // 1秒ごとに送信
  onResult,
  onError,
}: UseStreamingSpeechRecognitionProps = {}): UseStreamingSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [speakers, setSpeakers] = useState<{ [key: number]: string }>({})
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string>('')

  // ブラウザサポートチェック
  useEffect(() => {
    const checkSupport = () => {
      try {
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
        const hasMediaDevices = typeof navigator !== 'undefined' && 
                              navigator.mediaDevices && 
                              typeof navigator.mediaDevices.getUserMedia === 'function'
        const hasSecureContext = window.isSecureContext || 
                               window.location.protocol === 'https:' || 
                               window.location.hostname === 'localhost'
        
        console.log('Browser support check:', {
          hasMediaRecorder,
          hasMediaDevices,
          hasSecureContext,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          isSecureContext: window.isSecureContext
        })
        
        const isSupported = hasMediaRecorder && hasMediaDevices && hasSecureContext
        console.log('Speech recognition supported:', isSupported)
        
        return isSupported
      } catch (error) {
        console.error('Support check error:', error)
        return false
      }
    }
    
    setIsSupported(checkSupport())
  }, [])

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

  // 音声チャンクを短間隔で送信
  const sendAudioChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) {
      return
    }

    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
      chunksRef.current = [] // チャンクをリセット
      
      if (audioBlob.size === 0) {
        return
      }

      console.log(`Sending audio chunk: ${audioBlob.size} bytes`)
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      formData.append('sessionId', sessionIdRef.current)
      formData.append('interim', 'true') // 中間結果も要求
      
      const response = await fetch('/api/deepgram', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        console.error('API response not ok:', response.status, response.statusText)
        return
      }
      
      const data = await response.json()
      console.log('Streaming response:', data)
      
      if (data.success && data.result) {
        // 話者識別ありの場合
        if (data.result.speakers && Array.isArray(data.result.speakers)) {
          console.log('Found', data.result.speakers.length, 'speaker segments')
          
          data.result.speakers.forEach((speakerSegment: any) => {
            const speakerName = generateSpeakerName(speakerSegment.speakerTag)
            
            const result: StreamingTranscriptResult = {
              text: speakerSegment.text,
              isFinal: true, // ストリーミングでは短いチャンクなので基本的にfinal
              confidence: data.result.confidence || 0.8,
              timestamp: new Date(),
              speaker: {
                speakerTag: speakerSegment.speakerTag,
                speakerName: speakerName
              }
            }
            
            console.log('Calling onResult with streaming result:', result)
            onResult?.(result)
          })
          
          // 全体のトランスクリプトを更新
          const fullText = data.result.speakers.map((s: any) => s.text).join(' ')
          setTranscript(prev => prev + fullText + ' ')
          
        } else if (data.result.transcript) {
          // 話者識別なしの場合
          const transcriptText = data.result.transcript
          console.log('Streaming transcript:', transcriptText)
          
          const result: StreamingTranscriptResult = {
            text: transcriptText,
            isFinal: true,
            confidence: data.result.confidence || 0.8,
            timestamp: new Date(),
          }
          
          setTranscript(prev => prev + transcriptText + ' ')
          onResult?.(result)
        }
      }
    } catch (err) {
      console.error('Streaming audio send error:', err)
      // エラーは出力するが、ストリーミングは継続
    }
  }, [onResult, generateSpeakerName])

  // ストリーミング録音の開始
  const startStreamingRecognition = useCallback(async () => {
    try {
      console.log('startStreamingRecognition called, current isListening:', isListening)
      setError(null)
      
      // セッションIDを生成
      sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      console.log('Starting streaming session:', sessionIdRef.current)

      console.log('Requesting getUserMedia...')
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
      console.log('getUserMedia successful, stream:', stream)
      
      audioStreamRef.current = stream

      // MediaRecorder設定
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm'
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options)
      chunksRef.current = []
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio data available:', event.data.size, 'bytes')
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorderRef.current.onstop = () => {
        console.log('MediaRecorder stopped')
      }
      
      // 短い間隔で録音を開始（データを頻繁に生成）
      mediaRecorderRef.current.start(chunkSize / 2) // chunkSizeの半分の間隔でデータ生成
      console.log('MediaRecorder.start() called successfully with', chunkSize, 'ms chunks')
      console.log('MediaRecorder state:', mediaRecorderRef.current.state)
      
      // 定期的に音声データを送信
      streamingIntervalRef.current = setInterval(() => {
        if (!isListening) {
          return
        }
        sendAudioChunk()
      }, chunkSize)
      
      console.log('Streaming recognition setup completed successfully')

    } catch (err) {
      console.error('Streaming recognition start error:', err)
      const errorMessage = `ストリーミング音声認識開始エラー: ${err instanceof Error ? err.message : '不明なエラー'}`
      setError(errorMessage)
      onError?.(errorMessage)
      console.log('Error occurred, setting isListening back to false')
      setIsListening(false)
    }
  }, [isListening, chunkSize, sendAudioChunk, onError])

  // 録音開始
  const start = useCallback(() => {
    console.log('Start called, isSupported:', isSupported, 'isListening:', isListening)
    
    if (!isSupported) {
      const errorMessage = 'このブラウザはストリーミング音声認識をサポートしていません'
      console.error('Not supported:', errorMessage)
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    if (isListening) {
      console.log('Already listening, returning')
      return
    }
    
    console.log('Starting streaming recognition...')
    setError(null)
    setInterimTranscript('')
    console.log('Setting isListening to true')
    setIsListening(true)
    console.log('isListening should now be true, calling startStreamingRecognition')
    startStreamingRecognition()
  }, [isSupported, isListening, startStreamingRecognition, onError])

  // 録音停止
  const stop = useCallback(() => {
    setIsListening(false)
    setInterimTranscript('')
    
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current)
      streamingIntervalRef.current = null
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    
    // 最後のチャンクを送信
    if (chunksRef.current.length > 0) {
      sendAudioChunk()
    }
    
    console.log('Streaming recognition stopped')
  }, [sendAudioChunk])

  // クリーンアップ
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    start,
    stop,
    error,
    speakers,
  }
}