# Дневник самопознания

Next.js + Supabase + Vercel. Магическая ссылка вместо пароля.

---

## Шаг 1 — Supabase

1. Зайди на [supabase.com](https://supabase.com) → New project
2. Придумай название и пароль базы данных (сохрани куда-нибудь)
3. Подожди ~2 минуты пока поднимается проект
4. Открой **SQL Editor** и выполни:

```sql
create table entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  text text not null,
  question text,
  tags text[] default '{}',
  tone text default 'soft',
  reply_to text,
  created_at timestamptz default now()
);

alter table entries enable row level security;

create policy "users_own_entries" on entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

5. В **Settings → API** скопируй:
   - `Project URL` → это `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → это `NEXT_PUBLIC_SUPABASE_ANON_KEY`

6. В **Authentication → URL Configuration** добавь в Site URL:
   - Для разработки: `http://localhost:3000`
   - После деплоя: твой URL на Vercel (например `https://diary.vercel.app`)

---

## Шаг 2 — Anthropic API Key

1. Зайди на [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Создай новый ключ → это `ANTHROPIC_API_KEY`

---

## Шаг 3 — Локальный запуск

```bash
# Установи зависимости
npm install

# Скопируй .env.local.example в .env.local
cp .env.local.example .env.local

# Заполни .env.local своими ключами
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# ANTHROPIC_API_KEY=...

# Запусти
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000)

---

## Шаг 4 — Деплой на Vercel

### Вариант А — через GitHub (рекомендую)

1. Залей проект на GitHub (новый репозиторий)
2. Зайди на [vercel.com](https://vercel.com) → New Project → Import из GitHub
3. В **Environment Variables** добавь три переменные:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ANTHROPIC_API_KEY
   ```
4. Нажми Deploy

### Вариант Б — через CLI

```bash
npm i -g vercel
vercel

# Vercel спросит про переменные окружения — добавь все три
```

---

## Поделиться с друзьями

После деплоя скинь им ссылку. Каждый входит через magic link на свой email — у каждого свои записи, изолированные через Row Level Security в Supabase.

---

## Структура проекта

```
app/
  login/page.js        — страница входа (magic link)
  journal/page.js      — главная страница (SSR)
  auth/callback/route.js — обработка magic link
  api/ask/route.js     — проксирует запрос к Anthropic (ключ на сервере)
  api/patterns/route.js — анализ паттернов
components/
  Journal.jsx          — весь интерфейс
lib/
  supabase/client.js   — клиент для браузера
  supabase/server.js   — клиент для сервера
  prompts.js           — системные промпты и тоны ИИ
middleware.js          — защита /journal, редирект авторизованных
```
