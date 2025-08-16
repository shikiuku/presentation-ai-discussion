// MediaRecorder APIを使用した音声録音とテキスト変換
export interface MediaRecorderSpeechConfig {
  onTranscript?: (text: string) => void
  onError?: (error: string) => void
  onStart?: () => void
  onStop?: () => void
  recordingDuration?: number // 録音時間（ミリ秒）
  autoRestart?: boolean // 自動再開
}

export class MediaRecorderSpeechManager {
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private isRecording = false
  private config: MediaRecorderSpeechConfig
  private recordingChunks: Blob[] = []
  private recordingTimer: NodeJS.Timeout | null = null

  constructor(config: MediaRecorderSpeechConfig = {}) {
    this.config = {
      recordingDuration: 5000, // デフォルト5秒
      autoRestart: true,
      ...config,
    }
  }

  // MediaRecorder APIがサポートされているかチェック
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'MediaRecorder' in window && 
           'getUserMedia' in navigator.mediaDevices
  }

  // マイクの権限を取得
  private async requestMicrophonePermission(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // 音声認識に適した16kHz
        } 
      })
      return stream
    } catch (error) {
      console.error('マイクアクセスエラー:', error)
      throw new Error('マイクの許可が必要です。ブラウザ設定でマイクを許可してください。')
    }
  }

  // 録音を開始
  public async start(): Promise<void> {
    if (this.isRecording) {
      console.warn('録音は既に開始されています')
      return
    }

    try {
      if (!this.isSupported()) {
        throw new Error('このブラウザはMediaRecorder APIをサポートしていません')
      }

      this.audioStream = await this.requestMicrophonePermission()
      
      // MediaRecorderを設定
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      }
      
      // ブラウザがopusをサポートしていない場合の代替
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('opus codec not supported, using default')
        this.mediaRecorder = new MediaRecorder(this.audioStream)
      } else {
        this.mediaRecorder = new MediaRecorder(this.audioStream, options)
      }

      this.recordingChunks = []

      // イベントハンドラを設定
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.processRecording()
      }

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        this.config.onError?.('録音中にエラーが発生しました')
      }

      // 録音開始
      this.mediaRecorder.start()
      this.isRecording = true
      this.config.onStart?.()

      console.log(`録音開始 (${this.config.recordingDuration}ms)`)

      // 指定時間後に自動停止
      this.recordingTimer = setTimeout(() => {
        this.stop()
      }, this.config.recordingDuration)

    } catch (error) {
      console.error('録音開始エラー:', error)
      this.config.onError?.(error instanceof Error ? error.message : '録音を開始できませんでした')
    }
  }

  // 録音を停止
  public stop(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      return
    }

    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer)
      this.recordingTimer = null
    }

    this.mediaRecorder.stop()
    this.isRecording = false
    this.config.onStop?.()

    console.log('録音停止')
  }

  // 録音データを処理
  private processRecording(): void {
    if (this.recordingChunks.length === 0) {
      console.warn('録音データがありません')
      if (this.config.autoRestart) {
        this.restart()
      }
      return
    }

    const audioBlob = new Blob(this.recordingChunks, { type: 'audio/webm' })
    console.log('録音完了:', audioBlob.size, 'bytes')

    // ここでは録音データができたことを通知
    // 実際のテキスト変換は外部サービス（Gemini、OpenAI Whisper等）を使用
    this.config.onTranscript?.('録音データの準備ができました（テキスト変換機能は今後実装予定）')

    // 自動再開
    if (this.config.autoRestart) {
      setTimeout(() => {
        this.restart()
      }, 500) // 0.5秒後に再開
    }
  }

  // 録音を再開
  private restart(): void {
    if (!this.audioStream) {
      console.error('音声ストリームがありません')
      return
    }

    this.start().catch(error => {
      console.error('録音再開エラー:', error)
      this.config.onError?.('録音の再開に失敗しました')
    })
  }

  // リソースをクリーンアップ
  public cleanup(): void {
    this.stop()
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
      this.audioStream = null
    }
    
    this.mediaRecorder = null
    this.recordingChunks = []
  }

  // 現在の状態を取得
  public getIsRecording(): boolean {
    return this.isRecording
  }

  // 最新の録音データを取得
  public getLastRecording(): Blob | null {
    if (this.recordingChunks.length === 0) {
      return null
    }
    return new Blob(this.recordingChunks, { type: 'audio/webm' })
  }
}

// React Hook用のヘルパー関数
export function createMediaRecorderSpeech(config: MediaRecorderSpeechConfig) {
  return new MediaRecorderSpeechManager(config)
}