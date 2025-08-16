import { useState, useEffect, useCallback, useRef } from 'react'
import { SpeechRecognitionManager, TranscriptResult } from '@/lib/speech-recognition'

export interface UseSpeechRecognitionProps {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  maxRetries?: number
  retryDelay?: number
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
  maxRetries = 3,
  retryDelay = 2000,
  onResult,
  onError,
}: UseSpeechRecognitionProps = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<SpeechRecognitionManager | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // エラー処理関数（再試行ロジック付き）
  const handleError = useCallback((errorMessage: string, canRetry: boolean = false) => {
    console.log('handleError called:', { errorMessage, canRetry, retryCount: retryCountRef.current, maxRetries })
    
    // ネットワークエラーの場合は再試行を試みる
    if (canRetry && retryCountRef.current < maxRetries && errorMessage.includes('ネットワーク')) {
      retryCountRef.current += 1
      setError(`${errorMessage} (再試行 ${retryCountRef.current}/${maxRetries})`)
      
      // 指数バックオフで再試行
      const delay = retryDelay * Math.pow(2, retryCountRef.current - 1)
      
      retryTimeoutRef.current = setTimeout(() => {
        console.log('再試行を開始します:', retryCountRef.current)
        // 音声認識を再開始
        try {
          if (recognitionRef.current) {
            recognitionRef.current.abort()
          }
          
          recognitionRef.current = new SpeechRecognitionManager({
            lang,
            continuous,
            interimResults,
            onResult: handleResult,
            onError: (error: string) => handleError(error, true),
            onStart: handleStart,
            onEnd: handleEnd,
          })
          
          recognitionRef.current.start()
          setError(null) // エラーメッセージをクリア
        } catch (err) {
          console.error('再試行中にエラー:', err)
          handleError('音声認識の再試行に失敗しました', false)
        }
      }, delay)
      
      return
    }
    
    // 再試行の上限に達した場合や、再試行不可能なエラーの場合
    setError(errorMessage)
    setIsListening(false)
    retryCountRef.current = 0 // カウンターをリセット
    onError?.(errorMessage)
  }, [lang, continuous, interimResults, maxRetries, retryDelay, onError])

  // 開始処理関数
  const handleStart = useCallback(() => {
    setIsListening(true)
    setError(null)
    retryCountRef.current = 0 // 開始時にカウンターをリセット
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
        onError: (error: string) => handleError(error, true), // 再試行可能として設定
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
    // 再試行タイマーをクリア
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    
    // カウンターをリセット
    retryCountRef.current = 0
    
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  // クリーンアップ
  useEffect(() => {
    return () => {
      // 再試行タイマーをクリア
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      
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
