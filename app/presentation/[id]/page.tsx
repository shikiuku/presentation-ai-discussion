"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useWebSpeechRecognition } from "@/hooks/use-web-speech-recognition"
import { TokenizedText } from "@/components/ui/tokenized-text"
import {
  Mic,
  MicOff,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  BookOpen,
  Copy,
  Moon,
  Sun,
  ArrowLeft,
  User,
  Users,
  Loader2,
  Search,
  Shield,
  Upload,
  FileAudio,
  HelpCircle,
} from "lucide-react"

interface AnalysisResult {
  id: string
  type: "fact-check" | "rebuttal" | "term-explanation"
  content: string
  confidence: "high" | "medium" | "low"
  timestamp: string
}

interface TranscriptEntry {
  id: string
  speaker: string
  content: string
  timestamp: string
  isCurrentUser: boolean
}

export default function PresentationAssistant({ params }: { params: { id: string } }) {
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([])
  const [userClaim, setUserClaim] = useState("")
  const [opponentClaim, setOpponentClaim] = useState("")
  const [questionContent, setQuestionContent] = useState("") // 質問内容
  const [summary, setSummary] = useState("") // 要約
  const [projectType, setProjectType] = useState<"presentation" | "discussion">("presentation") // プロジェクトタイプ
  
  // プロジェクトデータを取得する関数
  const fetchProjectData = async (projectId: string) => {
    try {
      // ここで実際のプロジェクトデータを取得
      // 現在はローカルストレージから取得する実装
      const savedProjectType = localStorage.getItem(`project_${projectId}_type`)
      if (savedProjectType && (savedProjectType === "presentation" || savedProjectType === "discussion")) {
        setProjectType(savedProjectType)
      }
    } catch (error) {
      console.error("Failed to fetch project data:", error)
    }
  }

  // プロジェクトタイプを保存する関数（プロジェクト作成時に使用）
  const saveProjectType = (projectId: string, type: "presentation" | "discussion") => {
    try {
      localStorage.setItem(`project_${projectId}_type`, type)
      setProjectType(type)
    } catch (error) {
      console.error("Failed to save project type:", error)
    }
  }
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [activeNotification, setActiveNotification] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // 音声ファイルアップロード関連
  const [isFileUploading, setIsFileUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isFileAnalyzing, setIsFileAnalyzing] = useState(false)
  
  // 新しい話者管理の状態
  const [participantCount, setParticipantCount] = useState(2) // 参加者数
  const [currentSpeaker, setCurrentSpeaker] = useState(1) // 現在の話者（1から始まる）
  const [participants, setParticipants] = useState<string[]>(['参加者1', '参加者2']) // 参加者名
  
  const [sidebarSections, setSidebarSections] = useState({
    factCheck: true,
    rebuttals: true,
    terms: true,
  })

  const transcriptRef = useRef<HTMLDivElement>(null)
  const transcriptIdCounter = useRef(0)
  const webSpeechIdCounter = useRef(0)

  // 初期化時にプロジェクトデータを取得
  useEffect(() => {
    fetchProjectData(params.id)
  }, [params.id])

  // 参加者数変更時の処理
  const handleParticipantCountChange = (count: number) => {
    setParticipantCount(count)
    const newParticipants = Array.from({ length: count }, (_, i) => `参加者${i + 1}`)
    setParticipants(newParticipants)
    
    // 現在の話者がカウントを超えている場合は1にリセット
    if (currentSpeaker > count) {
      setCurrentSpeaker(1)
    }
  }

  // 話者切り替え処理
  const switchToSpeaker = (speakerIndex: number) => {
    setCurrentSpeaker(speakerIndex)
  }

  // 音声ファイルアップロード処理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // ファイル形式チェック
    const supportedFormats = ['audio/wav', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm']
    if (!supportedFormats.includes(file.type)) {
      setActiveNotification('サポートされていないファイル形式です。WAV、MP3、MP4、OGG、WebMファイルを選択してください。')
      setTimeout(() => setActiveNotification(null), 5000)
      return
    }

    // ファイルサイズチェック（25MB制限）
    if (file.size > 25 * 1024 * 1024) {
      setActiveNotification('ファイルサイズが大きすぎます。25MB以下のファイルを選択してください。')
      setTimeout(() => setActiveNotification(null), 5000)
      return
    }

    setIsFileUploading(true)
    setUploadedFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('audio', file)

      const response = await fetch('/api/gemini-speech', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        console.log('File analysis result:', result)
        
        // Gemini APIからの結果を処理
        if (result.success && result.result) {
          const analysisData = result.result
          
          // 話者別にトランスクリプトエントリを追加
          if (analysisData.speakers && analysisData.speakers.length > 0) {
            analysisData.speakers.forEach((speaker: any, index: number) => {
              const newEntry: TranscriptEntry = {
                id: (++webSpeechIdCounter.current).toString(),
                speaker: `話者${speaker.speakerTag || index + 1} (ファイル分析)`,
                content: speaker.text || speaker.content || '',
                timestamp: new Date().toLocaleTimeString(),
                isCurrentUser: false,
              }
              
              setTranscriptEntries(prev => [...prev, newEntry])
            })
          } else if (analysisData.transcript) {
            // 単一トランスクリプトの場合
            const newEntry: TranscriptEntry = {
              id: (++webSpeechIdCounter.current).toString(),
              speaker: '音声ファイル分析',
              content: analysisData.transcript,
              timestamp: new Date().toLocaleTimeString(),
              isCurrentUser: false,
            }
            
            setTranscriptEntries(prev => [...prev, newEntry])
          }
          
          setActiveNotification('音声ファイルの分析が完了しました')
          setTimeout(() => setActiveNotification(null), 3000)
        } else {
          setActiveNotification('音声ファイルの分析結果を取得できませんでした')
          setTimeout(() => setActiveNotification(null), 5000)
        }
      } else {
        const errorData = await response.json()
        setActiveNotification(`音声ファイル分析エラー: ${errorData.error || '不明なエラー'}`)
        setTimeout(() => setActiveNotification(null), 5000)
      }
    } catch (error) {
      console.error('File upload error:', error)
      setActiveNotification('音声ファイルのアップロードに失敗しました')
      setTimeout(() => setActiveNotification(null), 5000)
    } finally {
      setIsFileUploading(false)
      // input要素をリセット
      event.target.value = ''
    }
  }

  // Web Speech API用の音声認識フック
  const webSpeechRecognition = useWebSpeechRecognition({
    onResult: (result) => {
      console.log('Web Speech result:', result)
      
      if (result.isFinal && result.text.trim()) {
        const newEntry: TranscriptEntry = {
          id: (++webSpeechIdCounter.current).toString(),
          speaker: participants[currentSpeaker - 1], // 現在の話者名
          content: result.text.trim(),
          timestamp: new Date().toLocaleTimeString(),
          isCurrentUser: true, // Web Speech APIは常にユーザー入力
        }
        
        setTranscriptEntries(prev => [...prev, newEntry])
      }
    },
    onError: (error) => {
      console.error('Web Speech error:', error)
      setActiveNotification(error)
      setTimeout(() => setActiveNotification(null), 5000)
    },
    continuous: true,
    interimResults: true,
    language: 'ja-JP',
  })

  // 状態変化をログ出力
  useEffect(() => {
    console.log('Web Speech recognition state changed:', {
      isListening: webSpeechRecognition.isListening,
      isSupported: webSpeechRecognition.isSupported,
      hasError: !!webSpeechRecognition.error,
    })
    console.log('Button text should be:', webSpeechRecognition.isListening ? "録音停止" : "録音開始")
  }, [webSpeechRecognition.isListening, webSpeechRecognition.isSupported, webSpeechRecognition.error])

  // ファクトチェック実行
  const handleFactCheck = async (text: string, entryId: string) => {
    if (text.length < 5) return
    
    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fact-check',
          text: text,
          userClaim: userClaim,
          opponentClaim: opponentClaim,
          debateTheme: '', // TODO: プロジェクトから取得する
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        const newResult: AnalysisResult = {
          id: `fact-${Date.now()}`,
          type: 'fact-check',
          content: result.result,
          confidence: 'high',
          timestamp: new Date().toLocaleTimeString(),
        }
        setAnalysisResults(prev => [...prev, newResult])
        setActiveNotification('ファクトチェックが完了しました')
        setTimeout(() => setActiveNotification(null), 3000)
      }
    } catch (error) {
      console.error('ファクトチェックエラー:', error)
      setActiveNotification('ファクトチェック中にエラーが発生しました')
      setTimeout(() => setActiveNotification(null), 3000)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 反論提案実行
  const handleRebuttal = async (text: string, entryId: string) => {
    if (!userClaim || !opponentClaim) {
      setActiveNotification('あなたの主張と相手の主張を入力してください')
      setTimeout(() => setActiveNotification(null), 3000)
      return
    }
    
    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rebuttal',
          text: text,
          userClaim: userClaim,
          opponentClaim: opponentClaim,
          debateTheme: '', // TODO: プロジェクトから取得する
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        const newResult: AnalysisResult = {
          id: `rebuttal-${Date.now()}`,
          type: 'rebuttal',
          content: result.result,
          confidence: 'medium',
          timestamp: new Date().toLocaleTimeString(),
        }
        setAnalysisResults(prev => [...prev, newResult])
        setActiveNotification('反論提案が完了しました')
        setTimeout(() => setActiveNotification(null), 3000)
      }
    } catch (error) {
      console.error('反論提案エラー:', error)
      setActiveNotification('反論提案中にエラーが発生しました')
      setTimeout(() => setActiveNotification(null), 3000)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 用語説明実行
  const handleTermExplanation = async (term: string, context: string) => {
    if (term.length < 2) return
    
    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'term-explanation',
          term: term,
          context: context,
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        const newResult: AnalysisResult = {
          id: `term-${Date.now()}`,
          type: 'term-explanation',
          content: result.result,
          confidence: 'high',
          timestamp: new Date().toLocaleTimeString(),
        }
        setAnalysisResults(prev => [...prev, newResult])
        setActiveNotification(`「${term}」の説明が完了しました`)
        setTimeout(() => setActiveNotification(null), 3000)
      }
    } catch (error) {
      console.error('用語説明エラー:', error)
      setActiveNotification('用語説明中にエラーが発生しました')
      setTimeout(() => setActiveNotification(null), 3000)
    } finally {
      setIsAnalyzing(false)
    }
  }


  const toggleSidebarSection = (section: keyof typeof sidebarSections) => {
    setSidebarSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const toggleRecording = () => {
    console.log('toggleRecording called, isListening:', webSpeechRecognition.isListening, 'isSupported:', webSpeechRecognition.isSupported)
    
    if (!webSpeechRecognition.isListening) {
      if (!webSpeechRecognition.isSupported) {
        setActiveNotification('このブラウザはWeb Speech APIをサポートしていません')
        setTimeout(() => setActiveNotification(null), 3000)
        return
      }
      console.log('Starting Web Speech recognition...')
      webSpeechRecognition.start()
    } else {
      console.log('Stopping Web Speech recognition...')
      webSpeechRecognition.stop()
    }
  }

  const copyTranscript = () => {
    const transcriptText = transcriptEntries
      .map((entry) => `[${entry.timestamp}] ${entry.speaker}: ${entry.content}`)
      .join("\n")
    navigator.clipboard.writeText(transcriptText)
    setActiveNotification("トランスクリプトをコピーしました")
    setTimeout(() => setActiveNotification(null), 3000)
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "low":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "fact-check":
        return <CheckCircle className="h-4 w-4" />
      case "rebuttal":
        return <MessageSquare className="h-4 w-4" />
      case "term-explanation":
        return <BookOpen className="h-4 w-4" />
      default:
        return null
    }
  }

  // 自動スクロール
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcriptEntries])

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  // レンダリング時の状態をログ出力
  console.log('Rendering with isListening:', webSpeechRecognition.isListening, 'isSupported:', webSpeechRecognition.isSupported)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                プロジェクト一覧
              </Button>
              <h1 className="text-2xl font-bold text-primary">PresentationAI</h1>
              <Badge variant="secondary" className="text-xs">
                リアルタイム分析
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <label htmlFor="participant-count" className="text-sm font-medium">参加者数:</label>
                  <select
                    id="participant-count"
                    value={participantCount}
                    onChange={(e) => handleParticipantCountChange(Number(e.target.value))}
                    disabled={webSpeechRecognition.isListening}
                    className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                  >
                    <option value={2}>2人</option>
                    <option value={3}>3人</option>
                    <option value={4}>4人</option>
                    <option value={5}>5人</option>
                    <option value={6}>6人</option>
                  </select>
                </div>
                
                {/* 開発者向けプロジェクトタイプ切り替え */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="project-type" className="text-sm font-medium">タイプ:</label>
                  <select
                    id="project-type"
                    value={projectType}
                    onChange={(e) => saveProjectType(params.id, e.target.value as "presentation" | "discussion")}
                    disabled={webSpeechRecognition.isListening}
                    className="px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                  >
                    <option value="presentation">プレゼン</option>
                    <option value="discussion">議論</option>
                  </select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsDarkMode(!isDarkMode)}>
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                onClick={() => {
                  console.log('Button clicked! Current isListening:', webSpeechRecognition.isListening, 'isSupported:', webSpeechRecognition.isSupported)
                  toggleRecording()
                }}
                className={`${webSpeechRecognition.isListening ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}
                disabled={!webSpeechRecognition.isSupported}
              >
                {webSpeechRecognition.isListening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {webSpeechRecognition.isListening ? "録音停止" : "録音開始"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Popup */}
      {activeNotification && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right">
          <Alert className="bg-accent text-accent-foreground">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{activeNotification}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Speaker Control Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  話者切り替えコントロール
                  {webSpeechRecognition.isListening && (
                    <div className="ml-2 flex items-center">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                      <span className="text-sm text-muted-foreground">録音中</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium text-base">現在の話者:</span>
                    <div className="flex space-x-2">
                      {participants.map((participant, index) => (
                        <Button
                          key={index + 1}
                          variant={currentSpeaker === index + 1 ? "default" : "outline"}
                          size="lg"
                          onClick={() => switchToSpeaker(index + 1)}
                          disabled={false}
                          className={`px-4 py-2 text-sm font-medium ${
                            currentSpeaker === index + 1 
                              ? "bg-primary text-primary-foreground shadow-md" 
                              : "bg-background text-foreground hover:bg-muted"
                          }`}
                        >
                          話者 {index + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-primary">
                      {participants[currentSpeaker - 1]}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      録音中でも自由に話者を切り替えできます
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Claims Input Section */}
            {projectType === "presentation" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                      プレゼン内容
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="プレゼンテーションの内容を入力してください..."
                      value={userClaim}
                      onChange={(e) => setUserClaim(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <HelpCircle className="h-5 w-5 mr-2 text-blue-600" />
                      質問内容
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="予想される質問内容を入力してください..."
                      value={questionContent}
                      onChange={(e) => setQuestionContent(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                      あなたの主張
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="ディスカッションで主張したい内容を入力してください..."
                      value={userClaim}
                      onChange={(e) => setUserClaim(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                      相手の主張
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="予想される反対意見や相手の主張を入力してください..."
                      value={opponentClaim}
                      onChange={(e) => setOpponentClaim(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                  </CardContent>
                </Card>
              </div>
            )}


            {/* Live Transcript */}
            <Card className="flex-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <Mic className="h-5 w-5 mr-2 text-accent" />
                    音声認識トランスクリプト
                    {webSpeechRecognition.isListening && (
                      <div className="ml-2 flex items-center">
                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                        <span className="text-sm text-muted-foreground">録音中</span>
                      </div>
                    )}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Web Speech API - 手動話者切り替え
                    </Badge>
                    {webSpeechRecognition.error && (
                      <div className="ml-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 text-destructive mr-1" />
                        <span className="text-sm text-destructive">エラー</span>
                      </div>
                    )}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {isAnalyzing && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        分析中...
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyTranscript}
                      disabled={transcriptEntries.length === 0}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full">
                  <div ref={transcriptRef} className="space-y-3 p-4">
                    {transcriptEntries.length > 0 ? (
                      <>
                        {transcriptEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className={`p-3 rounded-lg ${
                              entry.isCurrentUser
                                ? "bg-primary/10 border-l-4 border-primary"
                                : "bg-muted border-l-4 border-muted-foreground/30"
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-1">
                                {entry.isCurrentUser ? (
                                  <User className="h-4 w-4 text-primary" />
                                ) : (
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span
                                    className={`text-sm font-medium ${
                                      entry.isCurrentUser ? "text-primary" : "text-foreground"
                                    }`}
                                  >
                                    {entry.speaker}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
                                </div>
                                <div className="text-sm leading-relaxed text-foreground mb-3">
                                  <TokenizedText text={entry.content} />
                                </div>
                                
                                {/* AI分析ボタン */}
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFactCheck(entry.content, entry.id)}
                                    disabled={isAnalyzing || entry.content.length < 5}
                                    className="text-xs h-7 px-2"
                                  >
                                    <Shield className="h-3 w-3 mr-1" />
                                    ファクトチェック
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRebuttal(entry.content, entry.id)}
                                    disabled={isAnalyzing || !userClaim || (projectType === "discussion" && !opponentClaim)}
                                    className="text-xs h-7 px-2"
                                  >
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    {projectType === "presentation" ? "質問提案" : "反論提案"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {webSpeechRecognition.isListening && (
                          <div className="text-center py-4">
                            <div className="inline-flex items-center px-4 py-2 bg-accent/20 rounded-lg">
                              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                              <span className="text-sm text-muted-foreground">
                                録音中... (話者: {participants[currentSpeaker - 1]})
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <span className="text-muted-foreground italic">
                          {!webSpeechRecognition.isSupported 
                            ? "このブラウザはWeb Speech APIをサポートしていません"
                            : "プレゼンテーションを開始すると、音声がここにリアルタイムで表示されます..."
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Summary Section - Only for Presentation Mode */}
            {projectType === "presentation" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <BookOpen className="h-5 w-5 mr-2 text-primary" />
                    要約
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="プレゼンテーションの要約を入力してください..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Analysis Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Audio File Upload Section */}
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <FileAudio className="h-4 w-4 mr-2 text-purple-600" />
                  音声ファイル分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    音声ファイルをアップロードしてGemini AIで分析
                  </p>
                  
                  <div className="space-y-2">
                    <label htmlFor="audio-upload" className="block cursor-pointer">
                      <div className={`
                        border-2 border-dashed rounded-lg p-4 text-center transition-colors
                        ${isFileUploading 
                          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20'
                        }
                      `}>
                        {isFileUploading ? (
                          <div className="flex flex-col items-center space-y-1">
                            <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                            <span className="text-xs text-blue-600">分析中...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center space-y-1">
                            <Upload className="h-6 w-6 text-gray-400" />
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              ファイルを選択
                            </span>
                          </div>
                        )}
                      </div>
                      <input
                        id="audio-upload"
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        disabled={isFileUploading}
                        className="hidden"
                      />
                    </label>
                    
                    {uploadedFileName && !isFileUploading && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ✓ {uploadedFileName} 分析完了
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI分析結果</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fact Check Section */}
                <Collapsible open={sidebarSections.factCheck} onOpenChange={() => toggleSidebarSection("factCheck")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      <span className="font-medium">ファクトチェック</span>
                    </div>
                    {sidebarSections.factCheck ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {analysisResults
                          .filter((result) => result.type === "fact-check")
                          .map((result) => (
                            <div key={result.id} className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={getConfidenceColor(result.confidence)}>{result.confidence}</Badge>
                                <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                              </div>
                              <p className="text-sm">{result.content}</p>
                            </div>
                          ))}
                        {analysisResults.filter((r) => r.type === "fact-check").length === 0 && (
                          <p className="text-sm text-muted-foreground italic">分析結果はまだありません</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Rebuttals/Questions Section */}
                <Collapsible open={sidebarSections.rebuttals} onOpenChange={() => toggleSidebarSection("rebuttals")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
                      <span className="font-medium">{projectType === "presentation" ? "質問提案" : "反論提案"}</span>
                    </div>
                    {sidebarSections.rebuttals ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {analysisResults
                          .filter((result) => result.type === "rebuttal")
                          .map((result) => (
                            <div key={result.id} className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={getConfidenceColor(result.confidence)}>{result.confidence}</Badge>
                                <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                              </div>
                              <p className="text-sm">{result.content}</p>
                            </div>
                          ))}
                        {analysisResults.filter((r) => r.type === "rebuttal").length === 0 && (
                          <p className="text-sm text-muted-foreground italic">
                            {projectType === "presentation" ? "質問提案はまだありません" : "反論提案はまだありません"}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Term Explanations Section */}
                <Collapsible open={sidebarSections.terms} onOpenChange={() => toggleSidebarSection("terms")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg">
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-2 text-purple-600" />
                      <span className="font-medium">用語説明</span>
                    </div>
                    {sidebarSections.terms ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {analysisResults
                          .filter((result) => result.type === "term-explanation")
                          .map((result) => (
                            <div key={result.id} className="p-3 bg-muted rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={getConfidenceColor(result.confidence)}>{result.confidence}</Badge>
                                <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                              </div>
                              <p className="text-sm">{result.content}</p>
                            </div>
                          ))}
                        {analysisResults.filter((r) => r.type === "term-explanation").length === 0 && (
                          <p className="text-sm text-muted-foreground italic">用語説明はまだありません</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
