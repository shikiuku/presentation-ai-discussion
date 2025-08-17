import { useState, useEffect, useCallback, useRef } from 'react'

export interface WebSpeechTranscriptResult {
  text: string
  confidence: number
  timestamp: Date
  isFinal: boolean
  isInterim: boolean
}

export interface UseWebSpeechRecognitionProps {
  onResult?: (result: WebSpeechTranscriptResult) => void
  onError?: (error: string) => void
  continuous?: boolean // 継続的な認識
  interimResults?: boolean // 中間結果を返す
  language?: string // 言語設定
}

export interface UseWebSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  start: () => void
  stop: () => void
  error: string | null
  transcript: string // 現在の認識テキスト
  interimTranscript: string // 中間結果のテキスト
}

// Web Speech APIのタイプ定義
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

// グローバルなSpeechRecognitionの型定義
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export function useWebSpeechRecognition({
  onResult,
  onError,
  continuous = true,
  interimResults = true,
  language = 'ja-JP',
}: UseWebSpeechRecognitionProps = {}): UseWebSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  
  const recognitionRef = useRef<any | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const retryCountRef = useRef<number>(0)
  const maxRetries = 3
  const retryDelayRef = useRef<number>(1000) // 初期遅延1秒

  // ブラウザサポートチェック
  const checkSupport = useCallback(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      
      if (!SpeechRecognition) {
        console.log('Web Speech API is not supported')
        setIsSupported(false)
        return false
      }
      
      // ネットワーク接続チェック
      if (!navigator.onLine) {
        console.log('Network is offline')
        setError('ネットワークに接続されていません')
        return false
      }
      
      console.log('Web Speech API is supported')
      setIsSupported(true)
      return true
    } catch (error) {
      console.error('Support check error:', error)
      setIsSupported(false)
      return false
    }
  }, [])

  // 権限チェック関数
  const checkPermissions = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      console.log('Microphone permission:', permission.state)
      
      if (permission.state === 'denied') {
        setError('マイクの権限が拒否されています')
        return false
      }
      
      return true
    } catch (error) {
      console.log('Permission check not supported or failed:', error)
      // 権限チェックがサポートされていない場合は続行
      return true
    }
  }, [])

  // 音声認識の初期化
  const initializeRecognition = useCallback(() => {
    if (!checkSupport()) return null

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    // 設定
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1
    
    // イベントハンドラー
    recognition.onstart = () => {
      console.log('Web Speech API started')
      setIsListening(true)
      setError(null)
      retryCountRef.current = 0 // 成功したらリトライカウントをリセット
    }
    
    recognition.onend = () => {
      console.log('Web Speech API ended')
      setIsListening(false)
      
      // continuousモードで再起動が必要な場合
      if (continuous && recognitionRef.current && retryCountRef.current < maxRetries) {
        try {
          // 短い遅延後に再起動
          setTimeout(() => {
            if (recognitionRef.current) {
              recognition.start()
            }
          }, 100)
        } catch (e) {
          console.log('Restart failed:', e)
          // 再起動に失敗した場合はリトライカウントを増やす
          retryCountRef.current++
        }
      }
    }
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Web Speech API error:', event.error, 'message:', event.message)
      const errorMessage = `音声認識エラー: ${event.error}`
      
      // エラーの種類に応じた処理
      switch (event.error) {
        case 'no-speech':
          // 音声が検出されない場合は継続（エラー表示しない）
          console.log('No speech detected, continuing...')
          return
          
        case 'network':
          // ネットワークエラーの場合は自動リトライ
          console.log(`Network error (retry ${retryCountRef.current + 1}/${maxRetries})`)
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++
            const delay = retryDelayRef.current * retryCountRef.current
            console.log(`Retrying in ${delay}ms...`)
            
            setTimeout(() => {
              if (recognitionRef.current && continuous) {
                try {
                  setError(null) // エラーをクリア
                  recognition.start()
                } catch (e) {
                  console.log('Retry failed:', e)
                  setError(errorMessage)
                  onError?.(errorMessage)
                }
              }
            }, delay)
            return
          }
          break
          
        case 'audio-capture':
          // マイクアクセス問題
          setError('マイクへのアクセスが拒否されました')
          onError?.('マイクへのアクセスが拒否されました')
          break
          
        case 'not-allowed':
          // 権限エラー
          setError('音声認識の権限が拒否されました')
          onError?.('音声認識の権限が拒否されました')
          break
          
        case 'service-not-allowed':
          // サービス利用不可
          setError('音声認識サービスが利用できません')
          onError?.('音声認識サービスが利用できません')
          break
          
        default:
          setError(errorMessage)
          onError?.(errorMessage)
      }
      
      setIsListening(false)
    }
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      let finalText = finalTranscriptRef.current
      
      // 結果を処理
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        const confidence = result[0].confidence || 0
        
        if (result.isFinal) {
          // 最終結果
          finalText += transcript + ' '
          finalTranscriptRef.current = finalText
          setTranscript(finalText)
          
          const resultData: WebSpeechTranscriptResult = {
            text: transcript,
            confidence: confidence,
            timestamp: new Date(),
            isFinal: true,
            isInterim: false,
          }
          
          console.log('Final result:', resultData)
          onResult?.(resultData)
        } else {
          // 中間結果
          interimText += transcript
        }
      }
      
      setInterimTranscript(interimText)
      
      if (interimText && interimResults) {
        const resultData: WebSpeechTranscriptResult = {
          text: interimText,
          confidence: 0,
          timestamp: new Date(),
          isFinal: false,
          isInterim: true,
        }
        
        onResult?.(resultData)
      }
    }
    
    return recognition
  }, [continuous, interimResults, language, onResult, onError, checkSupport])

  // 音声認識開始
  const start = useCallback(async () => {
    if (!checkSupport()) {
      const errorMessage = 'このブラウザはWeb Speech APIをサポートしていません'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    // 権限チェック
    const hasPermission = await checkPermissions()
    if (!hasPermission) {
      onError?.('マイクの権限が必要です')
      return
    }
    
    if (isListening) {
      console.log('Already listening')
      return
    }
    
    try {
      console.log('Starting Web Speech recognition...')
      setError(null)
      setTranscript('')
      setInterimTranscript('')
      finalTranscriptRef.current = ''
      retryCountRef.current = 0 // リトライカウントをリセット
      
      // 音声認識を初期化
      const recognition = initializeRecognition()
      if (!recognition) return
      
      recognitionRef.current = recognition
      recognition.start()
      
    } catch (err) {
      console.error('Start error:', err)
      const errorMessage = `開始エラー: ${err instanceof Error ? err.message : '不明なエラー'}`
      setError(errorMessage)
      onError?.(errorMessage)
      setIsListening(false)
    }
  }, [isListening, checkSupport, checkPermissions, initializeRecognition, onError])

  // 音声認識停止
  const stop = useCallback(() => {
    console.log('Stopping Web Speech recognition...')
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.continuous = false // 再起動を防ぐ
        recognitionRef.current.stop()
        recognitionRef.current = null
      } catch (e) {
        console.error('Stop error:', e)
      }
    }
    
    setIsListening(false)
  }, [])

  // 初期化時にサポートチェック
  useEffect(() => {
    checkSupport()
  }, [checkSupport])

  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network online')
      setError(null) // ネットワークエラーをクリア
    }
    
    const handleOffline = () => {
      console.log('Network offline')
      setError('ネットワークに接続されていません')
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log('Stop failed on network offline:', e)
        }
      }
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // エラーを無視
        }
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    start,
    stop,
    error,
    transcript,
    interimTranscript,
  }
}