import { useState, useEffect, useCallback, useRef } from 'react'

export interface TranscriptResultWithSpeaker {
  text: string
  isFinal: boolean
  confidence: number
  timestamp: Date
  speaker?: {
    speakerTag: number
    speakerName: string
  }
}

export interface UseExternalSpeechRecognitionProps {
  lang?: string
  continuous?: boolean
  recordingDuration?: number
  onResult?: (result: TranscriptResultWithSpeaker) => void
  onError?: (error: string) => void
}

export interface UseExternalSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  start: () => void
  stop: () => void
  error: string | null
  speakers: { [key: number]: string }
}

export function useExternalSpeechRecognition({
  lang = 'ja-JP',
  continuous = true,
  recordingDuration = 5000,
  onResult,
  onError,
}: UseExternalSpeechRecognitionProps = {}): UseExternalSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [speakers, setSpeakers] = useState<{ [key: number]: string }>({})
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // ブラウザサポートチェック
  useEffect(() => {
    const checkSupport = () => {
      try {
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
        const hasMediaDevices = typeof navigator !== 'undefined' && 
                              navigator.mediaDevices && 
                              typeof navigator.mediaDevices.getUserMedia === 'function'
        const hasSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost'
        
        return hasMediaRecorder && hasMediaDevices && hasSecureContext
      } catch (error) {
        console.error('Support check error:', error)
        return false
      }
    }
    
    setIsSupported(checkSupport())
  }, [])

  // 話者名を生成/更新
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

  // 音声データを外部APIに送信して分析
  const sendAudioToAPI = useCallback(async (audioBlob: Blob) => {
    try {
      console.log('sendAudioToAPI: 開始 - ファイルサイズ:', audioBlob.size)
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      
      console.log('API呼び出し中: /api/speech')
      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      })
      
      console.log('APIレスポンス受信 - ステータス:', response.status)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('APIレスポンスデータ:', data)
      
      if (data.success && data.result) {
        // 話者ダイアライゼーション結果を処理
        if (data.result.speakers && Array.isArray(data.result.speakers)) {
          let fullText = ''
          
          data.result.speakers.forEach((speakerSegment: any) => {
            const speakerName = generateSpeakerName(speakerSegment.speakerTag)
            fullText += speakerSegment.text + ' '
            
            // 各話者セグメントに対してコールバックを呼び出し
            const result: TranscriptResultWithSpeaker = {
              text: speakerSegment.text,
              isFinal: true,
              confidence: data.result.confidence || 0.8,
              timestamp: new Date(),
              speaker: {
                speakerTag: speakerSegment.speakerTag,
                speakerName: speakerName
              }
            }
            
            onResult?.(result)
          })
          
          setTranscript(prev => prev + fullText)
        } else {
          // 話者識別なしの場合
          const result: TranscriptResultWithSpeaker = {
            text: data.result.transcript,
            isFinal: true,
            confidence: data.result.confidence || 0.8,
            timestamp: new Date(),
          }
          
          setTranscript(prev => prev + data.result.transcript + ' ')
          onResult?.(result)
        }
      }
    } catch (err) {
      console.error('音声認識API error:', err)
      const errorMessage = `音声認識エラー: ${err instanceof Error ? err.message : '不明なエラー'}`
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }, [onResult, onError])

  // MediaRecorderの設定と開始
  const startRecording = useCallback(async () => {
    try {
      console.log('startRecording: 開始')
      
      // getUserMediaを正しい方法で呼び出し
      const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      
      if (!getUserMedia) {
        throw new Error('getUserMedia is not supported')
      }
      
      console.log('getUserMedia: 音声ストリーム取得中...')
      const stream = await getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      
      console.log('getUserMedia: 音声ストリーム取得成功')
      
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
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        console.log('録音停止 - 音声データサイズ:', audioBlob.size, 'bytes')
        
        if (audioBlob.size > 0) {
          console.log('音声データをAPIに送信中...')
          await sendAudioToAPI(audioBlob)
        } else {
          console.warn('音声データが空です')
        }
        
        // ストリームを停止
        stream.getTracks().forEach(track => track.stop())
        
        // 連続録音の場合は再開
        if (continuous && isListening) {
          setTimeout(() => {
            startRecording()
          }, 100)
        }
      }
      
      mediaRecorderRef.current.start()
      setError(null)
      
      // 一定時間後に停止して音声を送信
      recordingIntervalRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, recordingDuration)
      
    } catch (err) {
      console.error('MediaRecorder start error:', err)
      const errorMessage = `録音開始エラー: ${err instanceof Error ? err.message : '不明なエラー'}`
      setError(errorMessage)
      onError?.(errorMessage)
      setIsListening(false)
    }
  }, [continuous, recordingDuration, sendAudioToAPI, onError, isListening])

  // 録音開始
  const start = useCallback(() => {
    console.log('音声録音開始の試行')
    
    if (!isSupported) {
      const errorMessage = 'このブラウザは音声録音をサポートしていません'
      console.error('サポートチェック失敗:', errorMessage)
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    if (isListening) {
      console.log('既に録音中です')
      return
    }
    
    console.log('録音を開始します')
    setError(null)
    setIsListening(true)
    startRecording()
  }, [isSupported, isListening, startRecording, onError])

  // 録音停止
  const stop = useCallback(() => {
    setIsListening(false)
    
    if (recordingIntervalRef.current) {
      clearTimeout(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearTimeout(recordingIntervalRef.current)
      }
      
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

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