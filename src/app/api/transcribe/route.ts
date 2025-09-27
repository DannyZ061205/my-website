import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Security: Only allow POST requests from same origin
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // In production, you should validate the origin more strictly
    if (process.env.NODE_ENV === 'production' && origin && !origin.includes(host!)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if API key is configured (NEVER send the key to client)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      return NextResponse.json(
        { error: 'Service not configured' }, // Generic error - don't reveal API key details
        { status: 500 }
      );
    }

    // Get the audio file from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Create form data for OpenAI API
    const openAIFormData = new FormData();
    openAIFormData.append('file', audioFile);
    openAIFormData.append('model', 'gpt-4o-mini-transcribe');
    openAIFormData.append('language', 'en'); // Optional: specify language

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: openAIFormData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to transcribe audio';
      try {
        const error = await response.json();
        // Log error but NEVER log the API key
        console.error('Transcription failed:', response.status);

        // Sanitize error messages to avoid exposing sensitive info
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

    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Internal server error during transcription' },
      { status: 500 }
    );
  }
}