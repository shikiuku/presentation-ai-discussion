import { useState, useRef, useCallback, useEffect } from 'react'
import { MediaRecorderSpeechManager, type MediaRecorderSpeechConfig } from '@/lib/media-recorder-speech'

export interface UseMediaRecorderSpeechProps {
  recordingDuration?: number
  autoRestart?: boolean
  onTranscript?: (text: string) => void
  onError?: (error: string) => void
}

export interface UseMediaRecorderSpeechReturn {
  isRecording: boolean
  isSupported: boolean
  start: () => void
  stop: () => void
  error: string | null
  lastRecording: Blob | null
}

export function useMediaRecorderSpeech({
  recordingDuration = 5000,
  autoRestart = true,
  onTranscript,
  onError,
}: UseMediaRecorderSpeechProps = {}): UseMediaRecorderSpeechReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRecording, setLastRecording] = useState<Blob | null>(null)
  
  const recorderRef = useRef<MediaRecorderSpeechManager | null>(null)

  // MediaRecorderSpeechManagerを初期化
  useEffect(() => {
    const config: MediaRecorderSpeechConfig = {
      recordingDuration,
      autoRestart,
      onStart: () => {
        setIsRecording(true)
        setError(null)
        console.log('MediaRecorder録音開始')
      },
      onStop: () => {
        setIsRecording(false)
        console.log('MediaRecorder録音停止')
      },
      onTranscript: (text: string) => {
        console.log('MediaRecorder音声テキスト:', text)
        onTranscript?.(text)
      },
      onError: (errorMessage: string) => {
        console.error('MediaRecorderエラー:', errorMessage)
        setError(errorMessage)
        setIsRecording(false)
        onError?.(errorMessage)
      },
    }

    recorderRef.current = new MediaRecorderSpeechManager(config)
    setIsSupported(recorderRef.current.isSupported())

    return () => {
      if (recorderRef.current) {
        recorderRef.current.cleanup()
      }
    }
  }, [recordingDuration, autoRestart, onTranscript, onError])

  // 録音開始
  const start = useCallback(async () => {
    if (recorderRef.current && !isRecording) {
      try {
        setError(null)
        await recorderRef.current.start()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '録音開始に失敗しました'
        setError(errorMessage)
        onError?.(errorMessage)
      }
    }
  }, [isRecording, onError])

  // 録音停止
  const stop = useCallback(() => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop()
      
      // 最新の録音データを取得
      const recording = recorderRef.current.getLastRecording()
      setLastRecording(recording)
    }
  }, [isRecording])

  return {
    isRecording,
    isSupported,
    start,
    stop,
    error,
    lastRecording,
  }
}