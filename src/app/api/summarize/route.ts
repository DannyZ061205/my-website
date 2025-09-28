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

    // Get the audio data from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // First, transcribe the audio using Whisper API
    const transcriptionFormData = new FormData();
    transcriptionFormData.append('file', audioFile);
    transcriptionFormData.append('model', 'whisper-1');
    transcriptionFormData.append('response_format', 'text');

    console.log('Calling OpenAI Whisper API for transcription at:', new Date().toISOString());
    const transcribeStartTime = Date.now();

    const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: transcriptionFormData,
    });

    console.log('Whisper API responded in:', Date.now() - transcribeStartTime, 'ms');

    if (!transcribeResponse.ok) {
      console.error('Transcription failed:', transcribeResponse.status);
      return NextResponse.json(
        { error: 'Failed to transcribe audio' },
        { status: transcribeResponse.status }
      );
    }

    const transcript = await transcribeResponse.text();

    // Now summarize the transcript using GPT
    console.log('Calling OpenAI API for summary with model: gpt-5-nano-2025-08-07 at:', new Date().toISOString());
    const summaryStartTime = Date.now();

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an intelligent audio summarization assistant. Your task is to create a comprehensive yet concise summary of audio recordings.

GUIDELINES FOR SUMMARY:
1. **Main Points**: Extract and organize the key ideas and topics discussed
2. **Action Items**: Identify any tasks, todos, or action items mentioned
3. **Key Insights**: Highlight important conclusions, decisions, or insights
4. **Context**: Provide relevant context when needed for clarity
5. **Structure**: Use clear headings and bullet points for readability

FORMAT:
- Start with a brief overview (1-2 sentences)
- Use markdown formatting for structure
- Keep the summary focused and actionable
- Highlight the most important information
- If the audio is very short or unclear, provide what information is available

TONE:
- Professional yet conversational
- Clear and direct
- Focus on value and actionability`
          },
          {
            role: 'user',
            content: `Please provide a detailed summary of this recording transcript:\n\n${transcript}`
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    console.log('OpenAI API responded in:', Date.now() - summaryStartTime, 'ms');

    if (!summaryResponse.ok) {
      console.error('Summary generation failed:', summaryResponse.status);
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: summaryResponse.status }
      );
    }

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices[0]?.message?.content || 'Unable to generate summary';

    return NextResponse.json({
      transcript,
      summary
    });
  } catch (error) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      { error: 'Internal server error during summarization' },
      { status: 500 }
    );
  }
}