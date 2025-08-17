"use client"

import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2 } from "lucide-react"

interface TokenizedWord {
  surface: string
  reading: string
  pos: string
  baseForm: string
  isContent: boolean
}

interface WordDefinition {
  success: boolean
  word: string
  definition: string
}

interface TokenizedTextProps {
  text: string
  className?: string
}

export function TokenizedText({ text, className = "" }: TokenizedTextProps) {
  const [words, setWords] = useState<TokenizedWord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [definition, setDefinition] = useState<WordDefinition | null>(null)
  const [definitionLoading, setDefinitionLoading] = useState(false)

  // テキストを形態素解析してトークン化
  useEffect(() => {
    if (!text || text.trim().length === 0) return

    const tokenizeText = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/tokenize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.words) {
            setWords(result.words)
          }
        }
      } catch (error) {
        console.error('形態素解析エラー:', error)
        // エラーの場合は単純分割にフォールバック
        const fallbackWords = text.split(/(\s+|[、。！？])/).map(word => ({
          surface: word,
          reading: word,
          pos: '',
          baseForm: word,
          isContent: word.trim().length >= 2 && !/^\s+$/.test(word) && !/^[、。！？]+$/.test(word)
        }))
        setWords(fallbackWords)
      } finally {
        setIsLoading(false)
      }
    }

    tokenizeText()
  }, [text])

  // 単語の定義を取得
  const handleWordClick = async (word: TokenizedWord) => {
    if (!word.isContent || word.surface.trim().length < 2) return

    setSelectedWord(word.surface)
    setDefinitionLoading(true)

    try {
      const response = await fetch('/api/word-definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          word: word.baseForm || word.surface,
          context: text
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setDefinition(result)
      } else {
        setDefinition({
          success: false,
          word: word.surface,
          definition: '定義を取得できませんでした'
        })
      }
    } catch (error) {
      console.error('単語定義取得エラー:', error)
      setDefinition({
        success: false,
        word: word.surface,
        definition: 'エラーが発生しました'
      })
    } finally {
      setDefinitionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">解析中...</span>
      </div>
    )
  }

  return (
    <div className={className}>
      {words.map((word, index) => {
        // 空白や記号は表示しない（単語間の空白を削除）
        if (/^\s+$/.test(word.surface)) {
          return null
        }

        // 記号類は通常のテキストとして表示（空白なし）
        if (!word.isContent || word.surface.trim().length < 2) {
          return (
            <span key={index} className="text-foreground">
              {word.surface}
            </span>
          )
        }

        // 内容語（名詞、動詞、形容詞など）はクリック可能にする
        return (
          <Popover key={index}>
            <PopoverTrigger asChild>
              <span
                className="cursor-pointer hover:bg-yellow-200/50 hover:dark:bg-yellow-900/30 rounded px-1 transition-colors text-foreground select-none"
                onClick={() => handleWordClick(word)}
                title={`読み: ${word.reading} | 品詞: ${word.pos}`}
              >
                {word.surface}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top">
              {definitionLoading && selectedWord === word.surface ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm">定義を取得中...</span>
                </div>
              ) : definition && selectedWord === word.surface ? (
                <div className="space-y-2">
                  <div className="font-semibold text-sm border-b pb-1">
                    {definition.word}
                  </div>
                  <div className="text-sm whitespace-pre-line leading-relaxed">
                    {definition.definition}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-2">
                  クリックして定義を表示
                </div>
              )}
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}