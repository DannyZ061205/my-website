import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Security: Only allow POST requests from same origin
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // In production, validate the origin more strictly
    if (process.env.NODE_ENV === 'production' && origin && !origin.includes(host!)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }

    // Get the text to format from the request
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Call OpenAI API to format the text
    console.log('Calling OpenAI API with model: gpt-5-nano-2025-08-07 at:', new Date().toISOString());
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an intelligent text formatting assistant. Your task is to analyze the input text and apply appropriate formatting based on its content type.

FIRST, DETECT THE CONTENT TYPE:

A) TECHNICAL/MATHEMATICAL CONTENT (contains LaTeX, math expressions, code):
   - Convert LaTeX math delimiters:
     * (expression) or \\(expression\\) → $expression$
     * [expression] or \\[expression\\] → $$expression$$
     * Standalone math expressions → wrap with $ or $$
   - Fix common LaTeX issues:
     * \\Bbb F → \\mathbb{F}
     * Ensure all math is properly wrapped in $ or $$
   - Preserve technical accuracy
   - Format mathematical proofs with clear structure

B) GENERAL DOCUMENT TEXT (regular writing, notes, essays):
   - Create clear hierarchy:
     * Identify main topics → ## Heading
     * Identify subtopics → ### Subheading
     * Identify supporting points → bullet points or numbered lists
   - Improve readability:
     * Break long paragraphs into smaller ones
     * Add horizontal rules (---) between major sections
     * Create lists for sequential or related items
   - Organize scattered thoughts into coherent sections
   - Add emphasis (**bold** for key terms, *italic* for definitions)

UNIVERSAL RULES:
1. DO NOT change the actual content, facts, or meaning
2. DO NOT add new information or explanations
3. Return ONLY the formatted text
4. Preserve the original intent and tone
5. Make the text scannable and easy to read
6. Use consistent formatting throughout`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    console.log('OpenAI API responded in:', Date.now() - startTime, 'ms');

    if (!response.ok) {
      let errorMessage = 'Failed to format text';
      try {
        const error = await response.json();
        console.error('Formatting failed:', response.status);

        if (response.status === 401) {
          errorMessage = 'Authentication failed';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded';
        } else {
          errorMessage = error.error?.message || error.message || errorMessage;
        }
      } catch (e) {
        console.error('Failed to parse error response');
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    const formattedText = data.choices[0]?.message?.content || text;

    return NextResponse.json({ formattedText });
  } catch (error) {
    console.error('Formatting error:', error);
    return NextResponse.json(
      { error: 'Internal server error during formatting' },
      { status: 500 }
    );
  }
}