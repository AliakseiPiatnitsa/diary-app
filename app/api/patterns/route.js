import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PATTERNS_PROMPT } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entries } = await request.json()

  const corpus = entries
    .map((e, i) => `[Запись ${entries.length - i}]\n${e.text}`)
    .join('\n\n---\n\n')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: PATTERNS_PROMPT,
      messages: [{ role: 'user', content: corpus }],
    })

    const raw = message.content[0].text
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: true })
  }
}
