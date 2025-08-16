// Web Speech API用の型定義
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
  readonly resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechGrammar {
  src: string
  weight: number
}

interface SpeechGrammarList {
  readonly length: number
  addFromString(string: string, weight?: number): void
  addFromURI(src: string, weight?: number): void
  item(index: number): SpeechGrammar | null
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  grammars: SpeechGrammarList
  interimResults: boolean
  lang: string
  maxAlternatives: number
  serviceURI: string
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  abort(): void
  start(): void
  stop(): void
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

export interface TranscriptResult {
  text: string
  isFinal: boolean
  confidence: number
  timestamp: Date
}

export interface SpeechRecognitionConfig {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  onResult?: (result: TranscriptResult) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: () => void
  // 新しい設定オプション
  fallbackMode?: boolean  // フォールバック機能を有効にする
  shortSession?: boolean  // 短いセッションモード（ネットワーク負荷軽減）
}

export class SpeechRecognitionManager {
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private config: SpeechRecognitionConfig
  private fallbackAttempts = 0
  private maxFallbackAttempts = 2

  constructor(config: SpeechRecognitionConfig = {}) {
    this.config = {
      lang: 'ja-JP',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      fallbackMode: true,
      shortSession: false,
      ...config,
    }
  }

  // 音声認識がサポートされているかチェック
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 
           ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }

  // 音声認識を初期化
  private initializeRecognition(): SpeechRecognition {
    if (!this.isSupported()) {
      throw new Error('このブラウザは音声認識をサポートしていません')
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    // 設定を適用 - より安定した設定に変更
    recognition.lang = this.config.lang || 'ja-JP'
    
    // フォールバックモードでは、より安定した設定を使用
    if (this.config.fallbackMode && this.fallbackAttempts > 0) {
      recognition.continuous = false  // フォールバック時は短いセッション
      recognition.interimResults = false  // フォールバック時は最終結果のみ
      recognition.maxAlternatives = 1
    } else {
      recognition.continuous = this.config.continuous !== false
      recognition.interimResults = this.config.interimResults !== false
      recognition.maxAlternatives = this.config.maxAlternatives || 1
    }
    
    // 短いセッションモード
    if (this.config.shortSession) {
      recognition.continuous = false
      recognition.interimResults = false
    }
    
    // より安定した音声認識のための追加設定
    if ('serviceURI' in recognition) {
      // Googleの音声認識サービスを明示的に指定
      recognition.serviceURI = 'wss://www.google.com/speech-api/v2/recognize'
    }
    
    // グラマーをリセットして軽量化（安全な方法）
    if ('grammars' in recognition && recognition.grammars) {
      try {
        // lengthプロパティが読み取り専用の場合があるため、設定を避ける
        console.log('グラマーリストは使用せず、デフォルトのままにします')
      } catch (error) {
        console.log('グラマーリストの操作をスキップ:', error)
      }
    }

    // イベントハンドラを設定
    recognition.onstart = () => {
      console.log('音声認識開始:', { 
        fallbackAttempts: this.fallbackAttempts,
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang
      })
      this.isListening = true
      this.config.onStart?.()
    }

    recognition.onend = () => {
      this.isListening = false
      this.config.onEnd?.()
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message)
      
      // エラーの詳細なメッセージを提供
      let errorMessage = '音声認識エラーが発生しました'
      let shouldTryFallback = false
      
      switch (event.error) {
        case 'network':
          errorMessage = 'ネットワークエラーです。インターネット接続を確認してください'
          shouldTryFallback = true
          break
        case 'not-allowed':
          errorMessage = 'マイクの許可が必要です。ブラウザ設定でマイクを許可してください'
          break
        case 'no-speech':
          errorMessage = '音声が検出されませんでした。マイクが正常に動作しているか確認してください'
          shouldTryFallback = true
          break
        case 'audio-capture':
          errorMessage = 'オーディオキャプチャエラーです。マイクが使用できません'
          shouldTryFallback = true
          break
        case 'service-not-allowed':
          errorMessage = '音声認識サービスが利用できません'
          shouldTryFallback = true
          break
        case 'aborted':
          errorMessage = '音声認識が中断されました'
          break
        case 'language-not-supported':
          errorMessage = '指定された言語はサポートされていません'
          break
        default:
          errorMessage = `音声認識エラー: ${event.error}`
          shouldTryFallback = true
      }
      
      // フォールバックモードを試行
      if (this.config.fallbackMode && shouldTryFallback && this.fallbackAttempts < this.maxFallbackAttempts) {
        this.fallbackAttempts++
        console.log(`フォールバックモードを試行します (${this.fallbackAttempts}/${this.maxFallbackAttempts})`)
        
        // 1秒後にフォールバックモードで再試行
        setTimeout(() => {
          try {
            this.recognition = this.initializeRecognition()
            this.recognition.start()
          } catch (err) {
            console.error('フォールバック再試行に失敗:', err)
            this.config.onError?.(errorMessage)
          }
        }, 1000)
        
        return
      }
      
      // フォールバック試行回数をリセット
      this.fallbackAttempts = 0
      this.config.onError?.(errorMessage)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // 正常に結果が得られた場合、フォールバック試行回数をリセット
      this.fallbackAttempts = 0
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        const confidence = result[0].confidence

        const transcriptResult: TranscriptResult = {
          text: transcript,
          isFinal: result.isFinal,
          confidence: confidence,
          timestamp: new Date(),
        }

        this.config.onResult?.(transcriptResult)
      }
    }

    return recognition
  }

  // 音声認識を開始
  public start(): void {
    if (this.isListening) {
      console.warn('音声認識は既に開始されています')
      return
    }

    try {
      this.recognition = this.initializeRecognition()
      this.recognition.start()
    } catch (error) {
      console.error('音声認識の開始に失敗しました:', error)
      this.config.onError?.('音声認識の開始に失敗しました')
    }
  }

  // 音声認識を停止
  public stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
  }

  // 音声認識を中止
  public abort(): void {
    if (this.recognition && this.isListening) {
      this.recognition.abort()
    }
  }

  // 現在の状態を取得
  public getIsListening(): boolean {
    return this.isListening
  }

  // 音声認識の詳細サポート情報を取得
  public getSupportInfo(): {
    isSupported: boolean
    hasWebkit: boolean
    hasNative: boolean
    userAgent: string
    isHTTPS: boolean
    permissionState?: string
  } {
    const hasWebkit = typeof window !== 'undefined' && 'webkitSpeechRecognition' in window
    const hasNative = typeof window !== 'undefined' && 'SpeechRecognition' in window
    const isHTTPS = typeof window !== 'undefined' && window.location.protocol === 'https:'
    
    return {
      isSupported: this.isSupported(),
      hasWebkit,
      hasNative,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      isHTTPS,
    }
  }

  // 設定を更新
  public updateConfig(newConfig: Partial<SpeechRecognitionConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// カスタムフック用のヘルパー関数
export function createSpeechRecognition(config: SpeechRecognitionConfig) {
  return new SpeechRecognitionManager(config)
}