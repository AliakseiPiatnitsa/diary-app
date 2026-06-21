import { createClient } from '@/lib/supabase/server'
import Journal from '@/components/Journal'

export default async function JournalPage() {
  const supabase = createClient()

  // Загружаем записи на сервере — страница открывается уже с данными
  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false })

  return <Journal initialEntries={entries || []} />
}
