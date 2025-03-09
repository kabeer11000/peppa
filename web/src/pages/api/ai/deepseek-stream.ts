import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Disable NextJS's body parser for this route to handle streaming
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse the request body manually for streaming
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  
  try {
    const { messages, model, maxTokens, temperature } = body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required and must be an array' });
    }

    // Set up the OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: 'https://api.deepseek.com/v1',
    });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Create a streaming completion
    const stream = await openai.chat.completions.create({
      model: model || 'deepseek-coder',
      messages,
      max_tokens: maxTokens || 2048,
      temperature: temperature || 0.7,
      stream: true,
    });

    // Write each chunk to the response as it comes in
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // End the response
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('DeepSeek API streaming error:', error);
    // If headers haven't been sent yet, return a JSON error
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Error calling DeepSeek API',
        details: error.message 
      });
    }
    // Otherwise, end the stream with an error message
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
} 