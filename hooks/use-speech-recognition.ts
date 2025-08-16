import { useState, useEffect, useCallback, useRef } from 'react'
import { SpeechRecognitionManager, TranscriptResult } from '@/lib/speech-recognition'

export interface UseSpeechRecognitionProps {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (result: TranscriptResult) => void
  onError?: (error: string) => void
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  start: () => void
  stop: () => void
  error: string | null
}

export function useSpeechRecognition({
  lang = 'ja-JP',
  continuous = true,
  interimResults = true,
  onResult,
  onError,
}: UseSpeechRecognitionProps = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<SpeechRecognitionManager | null>(null)

  // ブラウザサポートチェック
  useEffect(() => {
    const recognition = new SpeechRecognitionManager()
    setIsSupported(recognition.isSupported())
  }, [])

  // 結果処理関数
  const handleResult = useCallback((result: TranscriptResult) => {
    if (result.isFinal) {
      setTranscript(prev => prev + result.text + ' ')
      setInterimTranscript('')
    } else {
      setInterimTranscript(result.text)
    }
    
    onResult?.(result)
  }, [onResult])

  // エラー処理関数
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setIsListening(false)
    onError?.(errorMessage)
  }, [onError])

  // 開始処理関数
  const handleStart = useCallback(() => {
    setIsListening(true)
    setError(null)
  }, [])

  // 終了処理関数
  const handleEnd = useCallback(() => {
    setIsListening(false)
  }, [])

  // 音声認識を開始
  const start = useCallback(() => {
    if (!isSupported) {
      handleError('このブラウザは音声認識をサポートしていません')
      return
    }

    if (isListening) {
      return
    }

    try {
      recognitionRef.current = new SpeechRecognitionManager({
        lang,
        continuous,
        interimResults,
        onResult: handleResult,
        onError: handleError,
        onStart: handleStart,
        onEnd: handleEnd,
      })

      recognitionRef.current.start()
    } catch (err) {
      handleError('音声認識の開始に失敗しました')
    }
  }, [isSupported, isListening, lang, continuous, interimResults, handleResult, handleError, handleStart, handleEnd])

  // 音声認識を停止
  const stop = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
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
  }
}