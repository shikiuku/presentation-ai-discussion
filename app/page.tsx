"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Presentation, Calendar, Users, MoreVertical, Search, MessageSquare, X, Newspaper, Image, Loader2 } from "lucide-react"

interface Project {
  id: string
  name: string
  description: string
  type: "debate" | "presentation" | "interview"
  createdAt: string
  lastUsed: string
  participantCount: number
  status: "active" | "completed" | "draft"
}

export default function ProjectSelection() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [projectType, setProjectType] = useState<"debate" | "presentation" | "interview" | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [debateTheme, setDebateTheme] = useState("")
  const [interviewTarget, setInterviewTarget] = useState("")
  
  // 画像検索関連の状態
  const [imageSearchQuery, setImageSearchQuery] = useState("")
  const [imageSearchResults, setImageSearchResults] = useState<{
    keyword: string
    images: Array<{
      url: string
      title: string
      source: string
    }>
    isLoading: boolean
  } | null>(null)

  const [projects, setProjects] = useState<Project[]>([
    {
      id: "1",
      name: "四半期業績報告",
      description: "Q3の売上実績と来期の戦略について",
      type: "presentation",
      createdAt: "2024-01-15",
      lastUsed: "2024-01-20",
      participantCount: 12,
      status: "active",
    },
    {
      id: "2",
      name: "新製品発表会",
      description: "革新的なAI機能を搭載した新サービスの紹介",
      type: "presentation",
      createdAt: "2024-01-10",
      lastUsed: "2024-01-18",
      participantCount: 25,
      status: "completed",
    },
    {
      id: "3",
      name: "環境政策討論",
      description: "持続可能な社会実現のための政策について",
      type: "debate",
      createdAt: "2024-01-12",
      lastUsed: "2024-01-16",
      participantCount: 8,
      status: "draft",
    },
    {
      id: "4",
      name: "スタートアップCEO取材",
      description: "AI分野での起業経験とビジョンについてのインタビュー",
      type: "interview",
      createdAt: "2024-01-08",
      lastUsed: "2024-01-14",
      participantCount: 3,
      status: "active",
    },
  ])

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      alert("プロジェクト名を入力してください")
      return
    }

    if (!projectType) {
      alert("プロジェクトの種類を選択してください")
      return
    }

    // 新しいプロジェクトを作成
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectName.trim(),
      description: projectDescription.trim() || "説明なし",
      type: projectType,
      createdAt: new Date().toISOString().split('T')[0], // YYYY-MM-DD形式
      lastUsed: new Date().toISOString().split('T')[0],
      participantCount: 1,
      status: "draft",
    }

    console.log("Creating project:", {
      ...newProject,
      debateTheme: projectType === "debate" ? debateTheme : undefined,
      interviewTarget: projectType === "interview" ? interviewTarget : undefined,
    })

    // プロジェクトリストに追加
    setProjects(prevProjects => [newProject, ...prevProjects])

    // フォームをリセットしてダイアログを閉じる
    setShowCreateDialog(false)
    setProjectType(null)
    setProjectName("")
    setProjectDescription("")
    setDebateTheme("")
    setInterviewTarget("")

    // 作成したプロジェクトのページにリダイレクト
    setTimeout(() => {
      window.location.href = `/presentation/${newProject.id}`
    }, 100)
  }

  const resetCreateForm = () => {
    setProjectType(null)
    setProjectName("")
    setProjectDescription("")
    setDebateTheme("")
    setInterviewTarget("")
  }

  // 画像検索を実行する関数
  const handleImageSearch = async (keyword: string) => {
    if (keyword.trim().length < 2) return

    setImageSearchResults({
      keyword: keyword.trim(),
      images: [],
      isLoading: true
    })

    try {
      const response = await fetch('/api/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() })
      })

      if (response.ok) {
        const result = await response.json()
        setImageSearchResults({
          keyword: keyword.trim(),
          images: result.images || [],
          isLoading: false
        })
      } else {
        setImageSearchResults({
          keyword: keyword.trim(),
          images: [],
          isLoading: false
        })
      }
    } catch (error) {
      console.error('Image search error:', error)
      setImageSearchResults({
        keyword: keyword.trim(),
        images: [],
        isLoading: false
      })
    }
  }

  // 画像検索をクリアする関数
  const clearImageSearch = () => {
    setImageSearchResults(null)
    setImageSearchQuery("")
  }

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "draft":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "進行中"
      case "completed":
        return "完了"
      case "draft":
        return "下書き"
      default:
        return status
    }
  }

  const getTypeIcon = (type: "debate" | "presentation" | "interview") => {
    if (type === "debate") return <MessageSquare className="h-3 w-3" />
    if (type === "presentation") return <Presentation className="h-3 w-3" />
    return <Newspaper className="h-3 w-3" />
  }

  const getTypeText = (type: "debate" | "presentation" | "interview") => {
    if (type === "debate") return "議論"
    if (type === "presentation") return "プレゼン"
    return "取材"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">PresentationAI</h1>
              <p className="text-muted-foreground mt-1">AIを活用したプレゼンテーション支援システム</p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  新しいプロジェクト
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>新しいプロジェクトを作成</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {!projectType && (
                    <div className="space-y-4">
                      <Label className="text-base font-medium">プロジェクトの種類を選択してください</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <Card
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary"
                          onClick={() => setProjectType("debate")}
                        >
                          <CardContent className="p-8 text-center">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-primary" />
                            <h3 className="font-semibold text-lg mb-3">議論・討論</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              相手の主張に対する反論や事実確認を支援します
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary"
                          onClick={() => setProjectType("presentation")}
                        >
                          <CardContent className="p-8 text-center">
                            <Presentation className="h-12 w-12 mx-auto mb-4 text-primary" />
                            <h3 className="font-semibold text-lg mb-3">プレゼンテーション</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">想定される質問への回答準備を支援します</p>
                          </CardContent>
                        </Card>

                        <Card
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary"
                          onClick={() => setProjectType("interview")}
                        >
                          <CardContent className="p-8 text-center">
                            <Newspaper className="h-12 w-12 mx-auto mb-4 text-primary" />
                            <h3 className="font-semibold text-lg mb-3">取材</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">インタビューの質問内容と要点の整理を支援します</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {projectType && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(projectType)}
                          <span className="font-medium">{getTypeText(projectType)}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={resetCreateForm}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="projectName">プロジェクト名</Label>
                          <Input
                            id="projectName"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="プロジェクト名を入力..."
                          />
                        </div>

                        <div>
                          <Label htmlFor="projectDescription">説明</Label>
                          <Textarea
                            id="projectDescription"
                            value={projectDescription}
                            onChange={(e) => setProjectDescription(e.target.value)}
                            placeholder="プロジェクトの説明を入力..."
                            rows={3}
                          />
                        </div>

                        {projectType === "debate" && (
                          <div>
                            <Label htmlFor="debateTheme">討論テーマ</Label>
                            <Input
                              id="debateTheme"
                              value={debateTheme}
                              onChange={(e) => setDebateTheme(e.target.value)}
                              placeholder="討論のテーマを入力... (例: 環境保護 vs 経済発展)"
                            />
                          </div>
                        )}

                        {projectType === "interview" && (
                          <div>
                            <Label htmlFor="interviewTarget">取材対象・テーマ</Label>
                            <Input
                              id="interviewTarget"
                              value={interviewTarget}
                              onChange={(e) => setInterviewTarget(e.target.value)}
                              placeholder="取材対象や主なテーマを入力... (例: 新製品開発責任者へのインタビュー)"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-6">
                        <Button 
                          onClick={handleCreateProject} 
                          className="flex-1"
                          disabled={!projectName.trim()}
                        >
                          プロジェクトを作成
                        </Button>
                        <Button variant="outline" onClick={resetCreateForm}>
                          戻る
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="プロジェクトを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative flex-1 max-w-md">
              <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="画像を検索..."
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && imageSearchQuery.trim()) {
                    handleImageSearch(imageSearchQuery.trim())
                  }
                }}
                className="pl-10"
              />
              {imageSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleImageSearch(imageSearchQuery.trim())}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-2"
                >
                  検索
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Image Search Results Card */}
        {imageSearchResults && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <Image className="h-5 w-5 mr-2 text-blue-600" />
                    画像検索結果: "{imageSearchResults.keyword}"
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearImageSearch}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {imageSearchResults.isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
                    <span className="text-sm text-muted-foreground">画像を検索中...</span>
                  </div>
                ) : imageSearchResults.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {imageSearchResults.images.slice(0, 12).map((image, index) => (
                      <div key={index} className="group relative">
                        <div className="aspect-square overflow-hidden rounded-lg border border-border hover:border-primary transition-colors">
                          <img
                            src={image.url}
                            alt={image.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                            onClick={() => window.open(image.url, '_blank')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `https://via.placeholder.com/200x200/e2e8f0/64748b?text=${encodeURIComponent(imageSearchResults.keyword)}`
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs opacity-0 group-hover:opacity-100 bg-black bg-opacity-70 px-2 py-1 rounded">
                            拡大表示
                          </span>
                        </div>
                        {image.title && (
                          <p className="mt-1 text-xs text-muted-foreground truncate" title={image.title}>
                            {image.title}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      "{imageSearchResults.keyword}"の画像が見つかりませんでした
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{project.name}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge className={`${getStatusColor(project.status)}`}>{getStatusText(project.status)}</Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getTypeIcon(project.type)}
                        {getTypeText(project.type)}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-2" />
                    作成日: {new Date(project.createdAt).toLocaleDateString("ja-JP")}
                  </div>
                  <div className="flex items-center">
                    <Presentation className="h-3 w-3 mr-2" />
                    最終使用: {new Date(project.lastUsed).toLocaleDateString("ja-JP")}
                  </div>
                  <div className="flex items-center">
                    <Users className="h-3 w-3 mr-2" />
                    参加者: {project.participantCount}名
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    className="w-full"
                    variant={project.status === "active" ? "default" : "outline"}
                    onClick={() => {
                      // Navigate to presentation assistant
                      window.location.href = `/presentation/${project.id}`
                    }}
                  >
                    {project.status === "active" ? "セッション再開" : "セッション開始"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <Presentation className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">プロジェクトが見つかりません</h3>
            <p className="text-muted-foreground mb-4">検索条件を変更するか、新しいプロジェクトを作成してください</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新しいプロジェクト
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
