import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildJournalPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(request) {
  // Проверяем что пользователь авторизован
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, tone = 'soft', replyTo } = await request.json()

  const userContent = replyTo
    ? `Контекст: отвечаю на вопрос:\n"${replyTo}"\n\nМоя запись:\n${text}`
    : text

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: buildJournalPrompt(tone),
      messages: [{ role: 'user', content: userContent }],
    })

    const raw = message.content[0].text
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ question: 'Что за этим стоит?', tags: [] })
  }
}
