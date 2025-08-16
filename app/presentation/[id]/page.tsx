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
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([])
  const [userClaim, setUserClaim] = useState("")
  const [opponentClaim, setOpponentClaim] = useState("")
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [activeNotification, setActiveNotification] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [sidebarSections, setSidebarSections] = useState({
    factCheck: true,
    rebuttals: true,
    terms: true,
  })

  const transcriptRef = useRef<HTMLDivElement>(null)

  const toggleSidebarSection = (section: keyof typeof sidebarSections) => {
    setSidebarSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  useEffect(() => {
    if (isRecording && !isPaused && transcriptEntries.length > 0) {
      const timer = setTimeout(() => {
        const mockResults: AnalysisResult[] = [
          {
            id: Date.now().toString(),
            type: "fact-check",
            content: "この統計は2023年のデータに基づいており、最新の研究結果と一致しています。",
            confidence: "high",
            timestamp: new Date().toLocaleTimeString(),
          },
          {
            id: (Date.now() + 1).toString(),
            type: "rebuttal",
            content:
              "この主張に対する反論として、代替的な視点を考慮することができます：市場の変動要因も重要な要素です。",
            confidence: "medium",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]
        setAnalysisResults((prev) => [...prev, ...mockResults])
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [transcriptEntries, isRecording, isPaused])

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true)
      setIsPaused(false)
      const mockEntries: TranscriptEntry[] = [
        {
          id: "1",
          speaker: "あなた",
          content: "こんにちは、本日のプレゼンテーションを開始いたします。まず、市場分析の結果についてお話しします。",
          timestamp: new Date().toLocaleTimeString(),
          isCurrentUser: true,
        },
        {
          id: "2",
          speaker: "参加者A",
          content: "ありがとうございます。その市場分析のデータソースについて教えていただけますか？",
          timestamp: new Date(Date.now() + 5000).toLocaleTimeString(),
          isCurrentUser: false,
        },
        {
          id: "3",
          speaker: "あなた",
          content: "はい、こちらのデータは2024年第3四半期の業界レポートに基づいています。",
          timestamp: new Date(Date.now() + 10000).toLocaleTimeString(),
          isCurrentUser: true,
        },
      ]
      setTranscriptEntries(mockEntries)
    } else {
      setIsRecording(false)
      setIsPaused(false)
    }
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
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

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

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
              <Button variant="outline" size="sm" onClick={() => setIsDarkMode(!isDarkMode)}>
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                onClick={toggleRecording}
                className={`${isRecording ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}
              >
                {isRecording ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {isRecording ? "プレゼン終了" : "プレゼン開始"}
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
            {/* Claims Input Section */}
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
                    placeholder="プレゼンテーションで主張したい内容を入力してください..."
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

            {/* Live Transcript */}
            <Card className="flex-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <Mic className="h-5 w-5 mr-2 text-accent" />
                    ライブトランスクリプト
                    {isRecording && (
                      <div className="ml-2 flex items-center">
                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                        <span className="text-sm text-muted-foreground">録音中</span>
                      </div>
                    )}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {isRecording && (
                      <Button variant="outline" size="sm" onClick={togglePause}>
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </Button>
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
                <ScrollArea className="h-[300px] w-full">
                  <div ref={transcriptRef} className="space-y-3 p-4">
                    {transcriptEntries.length > 0 ? (
                      transcriptEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg ${
                            entry.isCurrentUser
                              ? "bg-primary/10 border-l-4 border-primary"
                              : "bg-muted border-l-4 border-muted-foreground/30"
                          }`}
                        >
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
                            <p className="text-sm leading-relaxed text-foreground">{entry.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <span className="text-muted-foreground italic">
                          プレゼンテーションを開始すると、音声がここにリアルタイムで表示されます...
                        </span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
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

                {/* Rebuttals Section */}
                <Collapsible open={sidebarSections.rebuttals} onOpenChange={() => toggleSidebarSection("rebuttals")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
                      <span className="font-medium">反論提案</span>
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
                          <p className="text-sm text-muted-foreground italic">反論提案はまだありません</p>
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
