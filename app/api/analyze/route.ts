import { type NextRequest, NextResponse } from "next/server"

function postprocessResponse(rawText: string, classification: string): string {
  // Remove AI-style disclaimers and mentions
  const bannedPhrases = [
    "as an AI",
    "I cannot",
    "language model",
    "AI model",
    "artificial intelligence",
    "I'm an AI",
    "as a language model",
    "I don't have",
    "I can't",
    "gemini",
    "google",
  ]

  let processed = rawText
  bannedPhrases.forEach((phrase) => {
    processed = processed.replace(new RegExp(phrase, "gi"), "")
  })

  const openings = {
    Disinformation: [
      "This content appears to contain disinformation.",
      "This looks like disinformation.",
      "This seems to spread false information.",
      "This resembles disinformation tactics.",
    ],
    "Not Disinformation": [
      "This appears credible.",
      "This seems legitimate.",
      "This looks reliable.",
      "This appears trustworthy.",
    ],
    "NSFW Content": [
      "This contains adult content.",
      "This includes inappropriate material.",
      "This has explicit content.",
    ],
  }

  const randomOpening =
    openings[classification as keyof typeof openings]?.[
      Math.floor(Math.random() * openings[classification as keyof typeof openings].length)
    ] || "Analysis complete."

  return `${randomOpening} ${processed.trim()}`
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const apiKey = "AIzaSyAt-DheHJ9saF0g8MwkTh5Cs9K6xGevFyE"

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this content for disinformation. Respond in JSON format only.

Rules:
- Keep explanations MEDIUM length (3-4 sentences)
- Use plain English, no technical jargon
- For NSFW/sexual content: classify as "NSFW Content" and mark as fictional
- Don't mention AI, models, or analysis tools
- Be direct and confident
- Label content types as: Opinion, Claim, Assumption, Fact, or Mixed

JSON structure:
{
  "classification": "Disinformation" | "Not Disinformation" | "NSFW Content",
  "contentType": "Opinion" | "Claim" | "Assumption" | "Fact" | "Mixed",
  "confidence": 0-100,
  "explanation": "Clear reasoning (3-4 sentences with emojis)",
  "keyTerms": ["term1", "term2"],
  "verificationSources": ["Snopes.com", "FactCheck.org", "Reuters Fact Check"],
  "recommendations": ["action1", "action2"]
}

Content: "${content}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 1200,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error: ${response.status} - ${errorText}`)
      throw new Error(`Analysis service error: ${response.status}`)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      throw new Error("No response from analysis service")
    }

    let analysisResult
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const rawResult = JSON.parse(jsonMatch[0])

        // Post-process the explanation to make it more human-like
        rawResult.explanation = postprocessResponse(rawResult.explanation, rawResult.classification)

        analysisResult = rawResult
      } else {
        const classification =
          generatedText.toLowerCase().includes("disinformation") || generatedText.toLowerCase().includes("false")
            ? "Disinformation"
            : "Not Disinformation"

        analysisResult = {
          classification,
          contentType: "Mixed",
          confidence: 75,
          explanation: postprocessResponse(generatedText, classification),
          keyTerms: [],
          verificationSources: ["Snopes.com", "FactCheck.org", "Reuters Fact Check"],
          recommendations: [
            "Cross-check with multiple sources",
            "Verify publication dates",
            "Check author credentials",
          ],
        }
      }
    } catch (parseError) {
      analysisResult = {
        classification: "Not Disinformation",
        contentType: "Mixed",
        confidence: 50,
        explanation: "Unable to complete full analysis. Please try with different content.",
        keyTerms: [],
        verificationSources: ["Snopes.com", "FactCheck.org"],
        recommendations: ["Try analyzing again", "Check content manually"],
      }
    }

    return NextResponse.json({
      ...analysisResult,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json(
      {
        error: "Analysis temporarily unavailable. Please try again.",
      },
      { status: 500 },
    )
  }
}
