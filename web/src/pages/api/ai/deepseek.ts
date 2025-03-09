import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialize the OpenAI client with DeepSeek's API endpoint
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com/v1',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model, maxTokens, temperature } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required and must be an array' });
    }

    const response = await openai.chat.completions.create({
      model: model || 'deepseek-coder',
      messages,
      max_tokens: maxTokens || 2048,
      temperature: temperature || 0.7,
    });

    return res.status(200).json({
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage,
    });
  } catch (error: any) {
    console.error('DeepSeek API error:', error);
    return res.status(500).json({ 
      error: 'Error calling DeepSeek API',
      details: error.message 
    });
  }
} 