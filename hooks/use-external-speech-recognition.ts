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
  recordingDuration = 12000,
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
      console.log('Sending audio blob to Deepgram API. Size:', audioBlob.size, 'bytes')
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      
      const response = await fetch('/api/deepgram', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        console.error('API response not ok:', response.status, response.statusText)
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Deepgram API response:', data)
      
      if (data.success && data.result) {
        // 話者ダイアライゼーション結果を処理
        if (data.result.speakers && Array.isArray(data.result.speakers)) {
          console.log('Found', data.result.speakers.length, 'speaker segments')
          let fullText = ''
          
          data.result.speakers.forEach((speakerSegment: any, index: number) => {
            console.log(`Processing speaker segment ${index + 1}:`, speakerSegment)
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
            
            console.log('Calling onResult with:', result)
            onResult?.(result)
          })
          
          setTranscript(prev => prev + fullText)
          console.log('Updated transcript with speaker segments')
        } else {
          // 話者識別なしの場合
          const transcriptText = data.result.transcript || data.result.text || ''
          console.log('No speaker segments found. Transcript text:', transcriptText)
          
          if (transcriptText) {
            const result: TranscriptResultWithSpeaker = {
              text: transcriptText,
              isFinal: true,
              confidence: data.result.confidence || 0.8,
              timestamp: new Date(),
            }
            
            console.log('Calling onResult with non-speaker result:', result)
            setTranscript(prev => prev + transcriptText + ' ')
            onResult?.(result)
          } else {
            console.log('No transcript text found in response')
          }
        }
      } else {
        console.log('API response success was false or no result:', data)
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
      // getUserMediaを正しい方法で呼び出し
      const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      
      if (!getUserMedia) {
        throw new Error('getUserMedia is not supported')
      }
      
      const stream = await getUserMedia({ 
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
        console.log('Recording stopped. Audio blob size:', audioBlob.size, 'bytes')
        
        if (audioBlob.size > 0) {
          console.log('Sending audio to API...')
          await sendAudioToAPI(audioBlob)
        } else {
          console.log('Audio blob is empty, skipping API call')
        }
        
        // ストリームを停止
        stream.getTracks().forEach(track => track.stop())
        console.log('Audio stream stopped')
        
        // 連続録音の場合は再開
        if (continuous && isListening) {
          console.log('Restarting recording in 100ms...')
          setTimeout(() => {
            startRecording()
          }, 100)
        } else {
          console.log('Not restarting recording. Continuous:', continuous, 'IsListening:', isListening)
        }
      }
      
      mediaRecorderRef.current.start()
      setError(null)
      console.log('Recording started for', recordingDuration, 'ms')
      
      // 一定時間後に停止して音声を送信
      recordingIntervalRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('Stopping recording after', recordingDuration, 'ms')
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
    if (!isSupported) {
      const errorMessage = 'このブラウザは音声録音をサポートしていません'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    if (isListening) {
      return
    }
    
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