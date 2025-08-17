import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json()

    if (!keyword || keyword.trim().length < 2) {
      return NextResponse.json(
        { error: 'キーワードが短すぎます' },
        { status: 400 }
      )
    }

    // Google Custom Search APIまたは代替手段を使用
    // ここでは簡易的な実装として、Unsplash APIを使用
    const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY
    
    if (!unsplashAccessKey) {
      // 代替として、プレースホルダー画像を返す
      const placeholderImages = [
        {
          url: `https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=${encodeURIComponent(keyword)}`,
          title: `${keyword} - プレースホルダー`,
          source: 'placeholder'
        },
        {
          url: `https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=${encodeURIComponent(keyword)}`,
          title: `${keyword} - プレースホルダー2`,
          source: 'placeholder'
        },
        {
          url: `https://via.placeholder.com/400x300/45B7D1/FFFFFF?text=${encodeURIComponent(keyword)}`,
          title: `${keyword} - プレースホルダー3`,
          source: 'placeholder'
        }
      ]

      return NextResponse.json({
        success: true,
        images: placeholderImages,
        keyword: keyword
      })
    }

    // Unsplash APIを使用した画像検索
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=6&client_id=${unsplashAccessKey}`
    )

    if (!response.ok) {
      throw new Error('画像検索APIエラー')
    }

    const data = await response.json()
    
    const images = data.results?.map((photo: any) => ({
      url: photo.urls.small,
      title: photo.alt_description || photo.description || keyword,
      source: 'unsplash'
    })) || []

    return NextResponse.json({
      success: true,
      images: images,
      keyword: keyword
    })

  } catch (error) {
    console.error('Image search error:', error)
    
    // エラー時はプレースホルダー画像を返す
    const { keyword } = await req.json().catch(() => ({ keyword: 'unknown' }))
    
    const fallbackImages = [
      {
        url: `https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=${encodeURIComponent(keyword)}`,
        title: `${keyword} - エラー画像`,
        source: 'fallback'
      }
    ]

    return NextResponse.json({
      success: false,
      images: fallbackImages,
      keyword: keyword,
      error: '画像検索中にエラーが発生しました'
    })
  }
}