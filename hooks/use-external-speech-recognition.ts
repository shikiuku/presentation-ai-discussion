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
    const isMediaRecorderSupported = typeof MediaRecorder !== 'undefined' && 
                                   navigator.mediaDevices && 
                                   navigator.mediaDevices.getUserMedia
    setIsSupported(isMediaRecorderSupported)
  }, [])

  // 話者名を生成/更新
  const generateSpeakerName = useCallback((speakerTag: number): string => {
    const existingName = speakers[speakerTag]
    if (existingName) {
      return existingName
    }
    
    const speakerNames = ['話者A', '話者B', '話者C', '話者D', '話者E']
    const newName = speakerNames[speakerTag - 1] || `話者${speakerTag}`
    
    setSpeakers(prev => ({
      ...prev,
      [speakerTag]: newName
    }))
    
    return newName
  }, [speakers])

  // 音声データを外部APIに送信して分析
  const sendAudioToAPI = useCallback(async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      
      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      
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
  }, [onResult, onError, generateSpeakerName])

  // MediaRecorderの設定と開始
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      
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
        if (audioBlob.size > 0) {
          await sendAudioToAPI(audioBlob)
        }
        
        // ストリームを停止
        stream.getTracks().forEach(track => track.stop())
        
        // 連続録音の場合は再開
        if (continuous && isListening) {
          setTimeout(() => {
            if (isListening) {
              startRecording()
            }
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
  }, [continuous, isListening, recordingDuration, sendAudioToAPI, onError])

  // 録音開始
  const start = useCallback(() => {
    if (!isSupported) {
      const errorMessage = 'このブラウザは音声録音をサポートしていません'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    if (isListening) {
      return
    }
    
    setIsListening(true)
    setError(null)
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