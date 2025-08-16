// Web Speech API用の型定義
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
  readonly resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
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
}

export class SpeechRecognitionManager {
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private config: SpeechRecognitionConfig

  constructor(config: SpeechRecognitionConfig = {}) {
    this.config = {
      lang: 'ja-JP',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
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

    // 設定を適用
    recognition.lang = this.config.lang || 'ja-JP'
    recognition.continuous = this.config.continuous || true
    recognition.interimResults = this.config.interimResults || true
    recognition.maxAlternatives = this.config.maxAlternatives || 1

    // イベントハンドラを設定
    recognition.onstart = () => {
      this.isListening = true
      this.config.onStart?.()
    }

    recognition.onend = () => {
      this.isListening = false
      this.config.onEnd?.()
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      this.config.onError?.(event.error)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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

  // 設定を更新
  public updateConfig(newConfig: Partial<SpeechRecognitionConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// カスタムフック用のヘルパー関数
export function createSpeechRecognition(config: SpeechRecognitionConfig) {
  return new SpeechRecognitionManager(config)
}