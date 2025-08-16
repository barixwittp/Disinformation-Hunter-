"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Copy, Shield, AlertTriangle, Loader2, History, ExternalLink, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AnalysisResult {
  classification: "Disinformation" | "Not Disinformation" | "NSFW Content" | "Misleading"
  confidence: number
  explanation: string
  keyTerms?: string[]
  verificationSources?: string[]
  recommendations?: string[]
  timestamp: string
}

interface HistoryItem extends AnalysisResult {
  id: string
  content: string
}

export default function DisinformationHunter() {
  const [input, setInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const { toast } = useToast()

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("disinformation-history")
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Save history to localStorage
  const saveToHistory = (newResult: AnalysisResult, content: string) => {
    const historyItem: HistoryItem = {
      ...newResult,
      id: Date.now().toString(),
      content: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
    }

    const newHistory = [historyItem, ...history].slice(0, 5) // Keep only last 5
    setHistory(newHistory)
    localStorage.setItem("disinformation-history", JSON.stringify(newHistory))
  }

  const extractRedditContent = async (url: string) => {
    try {
      // Simple Reddit URL detection and conversion to JSON API
      if (url.includes("reddit.com/r/")) {
        const jsonUrl = url.replace(/\/$/, "") + ".json"
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(jsonUrl)}`)
        const data = await response.json()
        const redditData = JSON.parse(data.contents)

        const post = redditData[0]?.data?.children?.[0]?.data
        if (post) {
          return `${post.title}\n\n${post.selftext || ""}`
        }
      }
    } catch (error) {
      console.log("Reddit extraction failed, using URL as-is")
    }
    return url
  }

  const isValidRedditUrl = (url: string): boolean => {
    const redditPattern = /^https?:\/\/(www\.)?(reddit\.com\/r\/|old\.reddit\.com\/r\/)/
    return redditPattern.test(url)
  }

  const analyzeContent = async () => {
    if (!input.trim()) {
      setError("Please enter some content to analyze")
      return
    }

    const isUrl = input.trim().startsWith("http")
    if (isUrl && !isValidRedditUrl(input.trim())) {
      setError("🚫 Only Reddit links are supported. Please paste a Reddit post URL or enter text directly.")
      return
    }

    setIsAnalyzing(true)
    setError("")
    setResult(null)

    try {
      let contentToAnalyze = input
      if (input.includes("reddit.com/r/")) {
        contentToAnalyze = await extractRedditContent(input)
        setInput(contentToAnalyze) // Update the textarea with extracted content
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: contentToAnalyze }),
      })

      if (!response.ok) {
        throw new Error("Analysis failed")
      }

      const analysisResult = await response.json()

      if (analysisResult.error) {
        throw new Error(analysisResult.error)
      }

      setResult(analysisResult)
      saveToHistory(analysisResult, contentToAnalyze)
    } catch (err) {
      setError("⚠️ Something went wrong. Try again with different text or later.")
      console.error("Analysis error:", err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyResult = () => {
    if (result) {
      const text = `Analysis: ${result.classification} (${result.confidence}% confidence)\nExplanation: ${result.explanation}`
      navigator.clipboard.writeText(text)
      toast({
        title: "Copied to clipboard",
        description: "Analysis result has been copied to your clipboard.",
      })
    }
  }

  const resetAnalysis = () => {
    setInput("")
    setResult(null)
    setError("")
  }

  const loadFromHistory = (item: HistoryItem) => {
    setInput(item.content)
    setResult(item)
    setShowHistory(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 dark">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Disinformation Hunter 🕵️
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            🔍 Paste a Reddit link or text below for advanced disinformation detection with real verification sources.
          </p>

          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="outline"
              size="sm"
              className="border-border hover:border-primary/50"
            >
              <History className="w-4 h-4 mr-2" />
              History ({history.length})
            </Button>
          </div>
        </div>

        {showHistory && history.length > 0 && (
          <Card className="glow-border bg-card/50 backdrop-blur-sm p-4">
            <h3 className="text-lg font-semibold mb-3 text-foreground">Recent Analyses</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadFromHistory(item)}
                  className="p-3 bg-muted/20 rounded-lg border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      className={`${
                        item.classification === "Disinformation"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : item.classification === "NSFW Content"
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                            : item.classification === "Misleading"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-green-500/20 text-green-400 border-green-500/30"
                      } text-xs`}
                    >
                      {item.classification} ({item.confidence}%)
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground truncate">{item.content}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Main Analysis Card */}
        <Card className="glow-border bg-card/50 backdrop-blur-sm p-6 space-y-6">
          <div className="space-y-4">
            <Textarea
              placeholder="📝 Paste Reddit link (auto-extracts content) or text..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-32 bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 resize-none"
              disabled={isAnalyzing}
            />

            <div className="flex gap-3">
              <Button
                onClick={analyzeContent}
                disabled={isAnalyzing || !input.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />🔍 Analyzing Content...
                  </>
                ) : (
                  "🔍 Analyze Content"
                )}
              </Button>

              {(result || error) && (
                <Button
                  onClick={resetAnalysis}
                  variant="outline"
                  className="border-border hover:border-primary/50 hover:bg-primary/10 bg-transparent"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isAnalyzing && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <div
                    className="w-2 h-2 bg-primary rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-primary rounded-full animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
                <span className="text-primary font-medium">🧠 Running detection engine...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {result.classification === "Disinformation" ? (
                    <>
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-3 py-1 text-sm font-semibold">
                        🚫 Disinformation
                      </Badge>
                    </>
                  ) : result.classification === "NSFW Content" ? (
                    <>
                      <Eye className="w-6 h-6 text-orange-500" />
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 px-3 py-1 text-sm font-semibold">
                        🔞 NSFW Content
                      </Badge>
                    </>
                  ) : result.classification === "Misleading" ? (
                    <>
                      <AlertTriangle className="w-6 h-6 text-yellow-500" />
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 px-3 py-1 text-sm font-semibold">
                        ⚠️ Misleading
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Shield className="w-6 h-6 text-green-400" />
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-3 py-1 text-sm font-semibold">
                        ✅ Verified Safe
                      </Badge>
                    </>
                  )}
                </div>

                <Button
                  onClick={copyResult}
                  variant="outline"
                  size="sm"
                  className="border-border hover:border-primary/50 hover:bg-primary/10 bg-transparent"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Confidence Score</span>
                  <span className="font-semibold text-foreground">{result.confidence}%</span>
                </div>
                <Progress value={result.confidence} className="h-2" />
              </div>

              <div className="bg-muted/20 rounded-lg p-4 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground mb-3">📋 Detection Results:</h4>
                <div className="space-y-3">
                  {result.explanation
                    .split(/[.!?]+/)
                    .filter((sentence) => sentence.trim().length > 10)
                    .slice(0, 3) // Limit to 3 sentences max
                    .map((sentence, index) => (
                      <p key={index} className="text-foreground leading-relaxed text-sm">
                        {sentence.trim()}.
                      </p>
                    ))}
                </div>
              </div>

              {result.verificationSources && result.verificationSources.length > 0 && (
                <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                  <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                    🔗 Verification Sources
                  </h4>
                  <div className="space-y-2">
                    {result.verificationSources.map((source, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span className="text-blue-300">{source}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-300/70 mt-2">
                    💡 Cross-reference this content with these trusted fact-checking sources
                  </p>
                </div>
              )}

              {result.recommendations && result.recommendations.length > 0 && (
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                    💡 Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-green-300 flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.keyTerms && result.keyTerms.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Key Terms Analyzed:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.keyTerms.map((term, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-primary/30 text-primary">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center">
                🕐 Analysis completed at {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>🛡️ Disinformation Hunter Engine – Advanced Content Detection</p>
          <p className="mt-1">
            <ExternalLink className="w-3 h-3 inline mr-1" />🔍 Professional content analysis with verified fact-checking
            sources
          </p>
        </div>
      </div>
    </div>
  )
}
