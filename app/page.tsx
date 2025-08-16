"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Presentation, Calendar, Users, MoreVertical, Search, MessageSquare, X } from "lucide-react"

interface Project {
  id: string
  name: string
  description: string
  type: "debate" | "presentation"
  createdAt: string
  lastUsed: string
  participantCount: number
  status: "active" | "completed" | "draft"
}

export default function ProjectSelection() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [projectType, setProjectType] = useState<"debate" | "presentation" | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [myClaims, setMyClaims] = useState("")
  const [opponentClaims, setOpponentClaims] = useState("")
  const [expectedQuestions, setExpectedQuestions] = useState("")

  const [projects] = useState<Project[]>([
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
  ])

  const handleCreateProject = () => {
    // Here you would typically save to database
    console.log("[v0] Creating project:", {
      name: projectName,
      description: projectDescription,
      type: projectType,
      myClaims,
      opponentClaims: projectType === "debate" ? opponentClaims : undefined,
      expectedQuestions: projectType === "presentation" ? expectedQuestions : undefined,
    })

    // Reset form and close dialog
    setShowCreateDialog(false)
    setProjectType(null)
    setProjectName("")
    setProjectDescription("")
    setMyClaims("")
    setOpponentClaims("")
    setExpectedQuestions("")
  }

  const resetCreateForm = () => {
    setProjectType(null)
    setProjectName("")
    setProjectDescription("")
    setMyClaims("")
    setOpponentClaims("")
    setExpectedQuestions("")
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

  const getTypeIcon = (type: "debate" | "presentation") => {
    return type === "debate" ? <MessageSquare className="h-3 w-3" /> : <Presentation className="h-3 w-3" />
  }

  const getTypeText = (type: "debate" | "presentation") => {
    return type === "debate" ? "議論" : "プレゼン"
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
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>新しいプロジェクトを作成</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {!projectType && (
                    <div className="space-y-4">
                      <Label className="text-base font-medium">プロジェクトの種類を選択してください</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary"
                          onClick={() => setProjectType("debate")}
                        >
                          <CardContent className="p-6 text-center">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-primary" />
                            <h3 className="font-semibold text-lg mb-2">議論・討論</h3>
                            <p className="text-sm text-muted-foreground">
                              相手の主張に対する反論や事実確認を支援します
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary"
                          onClick={() => setProjectType("presentation")}
                        >
                          <CardContent className="p-6 text-center">
                            <Presentation className="h-12 w-12 mx-auto mb-4 text-primary" />
                            <h3 className="font-semibold text-lg mb-2">プレゼンテーション</h3>
                            <p className="text-sm text-muted-foreground">想定される質問への回答準備を支援します</p>
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

                        <div>
                          <Label htmlFor="myClaims">あなたの主張</Label>
                          <Textarea
                            id="myClaims"
                            value={myClaims}
                            onChange={(e) => setMyClaims(e.target.value)}
                            placeholder="あなたの主張や論点を入力..."
                            rows={4}
                          />
                        </div>

                        {projectType === "debate" && (
                          <div>
                            <Label htmlFor="opponentClaims">相手の主張</Label>
                            <Textarea
                              id="opponentClaims"
                              value={opponentClaims}
                              onChange={(e) => setOpponentClaims(e.target.value)}
                              placeholder="相手の主張や論点を入力..."
                              rows={4}
                            />
                          </div>
                        )}

                        {projectType === "presentation" && (
                          <div>
                            <Label htmlFor="expectedQuestions">想定される質問</Label>
                            <Textarea
                              id="expectedQuestions"
                              value={expectedQuestions}
                              onChange={(e) => setExpectedQuestions(e.target.value)}
                              placeholder="想定される質問や懸念点を入力..."
                              rows={4}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleCreateProject} className="flex-1">
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
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="プロジェクトを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

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
