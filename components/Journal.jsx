'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TONES } from '@/lib/prompts'

/* ─── УТИЛИТЫ ────────────────────────────────────────────────────────────── */

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'запись'
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'записи'
  return 'записей'
}

function fmtDate(ts) {
  const now = new Date(), d = new Date(ts)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `сегодня, ${time}`
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return `вчера, ${time}`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + `, ${time}`
}

function fmtTimer(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

// DB row → компонентный формат
function rowToEntry(row) {
  return {
    id: row.id,
    text: row.text,
    question: row.question,
    tags: row.tags || [],
    tone: row.tone || 'soft',
    replyTo: row.reply_to,
    ts: new Date(row.created_at).getTime(),
  }
}

function getTagStats(entries) {
  const c = {}
  entries.forEach(e => (e.tags||[]).forEach(t => { c[t] = (c[t]||0) + 1 }))
  return Object.entries(c).sort((a, b) => b[1] - a[1])
}

function calcStreak(entries) {
  if (!entries.length) return { current: 0, todayDone: false }
  const toKey = ts => new Date(ts).toDateString()
  const days = new Set(entries.map(e => toKey(e.ts)))
  const today = new Date(), todayDone = days.has(toKey(today))
  const d = new Date(today)
  if (!todayDone) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(toKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return { current: n, todayDone }
}

function calcBestStreak(entries) {
  if (!entries.length) return 0
  const days = [...new Set(entries.map(e => new Date(e.ts).toDateString()))]
    .map(s => new Date(s).getTime()).sort((a, b) => a - b)
  let best = 1, cur = 1
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i] - days[i-1]) / 86400000)
    if (diff === 1) { cur++; best = Math.max(best, cur) } else if (diff > 1) cur = 1
  }
  return best
}

function downloadMd(entries) {
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  const lines = [`# Дневник самопознания`, `*${entries.length} ${plural(entries.length)} · ${today}*`, ``]
  ;[...entries].reverse().forEach(e => {
    lines.push(`---`, ``, `### ${fmtDate(e.ts)}`)
    if (e.tags?.length) lines.push(`*теги: ${e.tags.join(', ')}*`)
    if (e.replyTo) lines.push(`*↩ в ответ на: ${e.replyTo}*`)
    lines.push(``, e.text, ``)
    if (e.question) lines.push(`**↳** *${e.question}*`, ``)
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `дневник-${new Date().toISOString().slice(0,10)}.md` })
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

/* ─── ПОДСВЕТКА ПОИСКА ───────────────────────────────────────────────────── */

function Highlight({ text, query }) {
  if (!query.trim()) return <>{text}</>
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${esc})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: '#2A2660', color: '#C4B3FF', borderRadius: 2, padding: '0 1px' }}>{p}</mark>
          : p
      )}
    </>
  )
}

/* ─── ТОН ────────────────────────────────────────────────────────────────── */

function ToneSelector({ tone, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={ts.wrap}>
      {open && (
        <div style={ts.panel}>
          {Object.entries(TONES).map(([key, { label, hint }]) => (
            <button key={key} style={ts.option} className={`j-tone-opt ${tone === key ? 'active' : ''}`}
              onClick={() => { onChange(key); setOpen(false) }}>
              <span style={ts.optLabel}>{label}</span>
              <span style={ts.optHint}>{hint}</span>
            </button>
          ))}
        </div>
      )}
      <button style={ts.btn} className={`j-tone-btn ${open ? 'open' : ''}`} onClick={() => setOpen(v => !v)}>
        {TONES[tone].label} <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
      </button>
    </div>
  )
}

const ts = {
  wrap: { position: 'relative' },
  btn: { background: 'transparent', border: '1px solid #1F1D46', color: '#3D3870', padding: '3px 9px', borderRadius: 20, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4 },
  panel: { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: '#111129', border: '1px solid #1F1D46', borderRadius: 4, overflow: 'hidden', minWidth: 200, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', zIndex: 100 },
  option: { width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #1A1840', padding: '10px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, transition: 'background 0.15s', fontFamily: "'Inter', system-ui, sans-serif" },
  optLabel: { fontSize: 12, color: '#9B8FD8', letterSpacing: '0.06em' },
  optHint: { fontSize: 10, color: '#3D3870', letterSpacing: '0.04em' },
}

/* ─── ТАЙМЕР ─────────────────────────────────────────────────────────────── */

function TimerControl({ timerMode, timerSecs, timerTotal, onStart, onStop }) {
  const [showOpts, setShowOpts] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShowOpts(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const progress = timerTotal > 0 ? 1 - timerSecs / timerTotal : 0
  const isLastMin = timerSecs < 60 && timerMode === 'running'
  if (timerMode === 'running' || timerMode === 'done') {
    return (
      <div style={tc.row}>
        <span style={{ ...tc.countdown, color: timerMode === 'done' ? '#7BC67E' : isLastMin ? '#C47BBF' : '#7467C0' }}
          className={timerMode === 'done' ? 'j-timer-done' : ''}>
          ⏱ {timerMode === 'done' ? 'время!' : fmtTimer(timerSecs)}
        </span>
        <div style={tc.bar}><div style={{ ...tc.fill, width: `${progress * 100}%`, background: timerMode === 'done' ? '#3A6B3D' : isLastMin ? '#5A2F5A' : '#2A2660' }} /></div>
        <button style={tc.stop} className="j-timer-stop" onClick={onStop}>✕</button>
      </div>
    )
  }
  return (
    <div ref={ref} style={tc.wrap}>
      {showOpts && (
        <div style={tc.opts}>
          {[5, 10, 15].map(m => (
            <button key={m} style={tc.opt} className="j-timer-opt" onClick={() => { onStart(m); setShowOpts(false) }}>{m}м</button>
          ))}
          <button style={tc.opt} className="j-timer-opt" onClick={() => setShowOpts(false)}>✕</button>
        </div>
      )}
      <button style={tc.icon} className={`j-timer-btn ${showOpts ? 'active' : ''}`} onClick={() => setShowOpts(v => !v)}>⏱</button>
    </div>
  )
}

const tc = {
  wrap: { position: 'relative' },
  icon: { background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', color: '#2A2660', padding: '2px 4px', transition: 'color 0.15s', lineHeight: 1 },
  opts: { position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, background: '#111129', border: '1px solid #1F1D46', borderRadius: 4, padding: '6px', display: 'flex', gap: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' },
  opt: { background: 'transparent', border: '1px solid #1F1D46', color: '#6A5FB5', padding: '4px 10px', borderRadius: 2, fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, transition: 'all 0.15s' },
  row: { display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
  countdown: { fontSize: 12, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  bar: { flex: 1, height: 2, background: '#1A1840', borderRadius: 1, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 1, transition: 'width 1s linear, background 0.5s' },
  stop: { background: 'transparent', border: 'none', color: '#2A2660', fontSize: 12, cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'color 0.15s' },
}

/* ─── ОНБОРДИНГ ──────────────────────────────────────────────────────────── */

function Onboarding() {
  return (
    <div style={ob.wrap} className="j-onboarding">
      <p style={ob.heading}>мысли не обязаны<br />быть структурными</p>
      <div style={ob.steps}>
        {[['✦','пиши как думаешь — хаотично, отрывками'],['↳','ИИ прочтёт и задаст один точный вопрос'],['◎','паттерны и темы видны со временем']].map(([icon, text]) => (
          <div key={icon} style={ob.step}><span style={ob.icon}>{icon}</span><span style={ob.text}>{text}</span></div>
        ))}
      </div>
      <p style={ob.cta}>начни писать выше ↑</p>
    </div>
  )
}

const ob = {
  wrap: { maxWidth: 620, margin: '56px auto 0', padding: '0 24px', animation: 'fadeUp 0.7s ease' },
  heading: { fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 300, fontSize: 30, lineHeight: 1.45, color: '#22204A', margin: '0 0 36px' },
  steps: { display: 'flex', flexDirection: 'column', gap: 14 },
  step: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  icon: { color: '#2E2B60', flexShrink: 0, fontSize: 11, marginTop: 2, width: 14 },
  text: { fontSize: 13, color: '#2A2760', letterSpacing: '0.04em', lineHeight: 1.65 },
  cta: { marginTop: 40, fontSize: 11, color: '#1E1C42', letterSpacing: '0.12em', fontStyle: 'italic' },
}

/* ─── ГЛАВНЫЙ КОМПОНЕНТ ──────────────────────────────────────────────────── */

export default function Journal({ initialEntries }) {
  const supabase = createClient()

  const [view, setView]             = useState('journal')
  const [text, setText]             = useState('')
  const [entries, setEntries]       = useState(initialEntries.map(rowToEntry))
  const [loading, setLoading]       = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [patterns, setPatterns]     = useState(null)
  const [activeTag, setActiveTag]   = useState(null)
  const [showClear, setShowClear]   = useState(false)
  const [replyCtx, setReplyCtx]     = useState(null)
  const [tone, setTone]             = useState('soft')
  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [timerMode, setTimerMode]   = useState('idle')
  const [timerSecs, setTimerSecs]   = useState(0)
  const [timerTotal, setTimerTotal] = useState(300)

  const textareaRef = useRef(null)
  const latestRef   = useRef(null)
  const composeRef  = useRef(null)
  const searchRef   = useRef(null)

  const wordCount  = text.trim() ? text.trim().split(/\s+/).length : 0
  const streak     = calcStreak(entries)
  const bestStreak = calcBestStreak(entries)

  // Загружаем тон из localStorage
  useEffect(() => {
    const saved = localStorage.getItem('diary-tone')
    if (saved) setTone(saved)
  }, [])

  // Таймер
  useEffect(() => {
    if (timerMode !== 'running') return
    if (timerSecs <= 0) { setTimerMode('done'); return }
    const id = setInterval(() => setTimerSecs(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [timerMode, timerSecs])

  useEffect(() => {
    if (timerMode !== 'done') return
    const id = setTimeout(() => setTimerMode('idle'), 4000)
    return () => clearTimeout(id)
  }, [timerMode])

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50)
  }, [showSearch])

  const startTimer = (mins) => {
    setTimerTotal(mins * 60); setTimerSecs(mins * 60); setTimerMode('running')
    setTimeout(() => textareaRef.current?.focus(), 100)
  }
  const stopTimer = () => { setTimerMode('idle'); setTimerSecs(0) }

  const handleToneChange = (newTone) => {
    setTone(newTone)
    localStorage.setItem('diary-tone', newTone)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(180, el.scrollHeight) + 'px'
  }

  const handleReply = (question) => {
    setReplyCtx(question); setView('journal')
    composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => textareaRef.current?.focus(), 450)
  }

  const sendEntry = async () => {
    if (!text.trim() || loading) return
    const body = text.trim(), ctx = replyCtx
    setText(''); setReplyCtx(null)
    if (textareaRef.current) textareaRef.current.style.height = '180px'
    setLoading(true)

    // Вызываем наш API route (не Anthropic напрямую — ключ на сервере)
    let question = '', tags = []
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body, tone, replyTo: ctx }),
      })
      const data = await res.json()
      question = data.question || ''; tags = data.tags || []
    } catch { question = 'Что за этим стоит?' }

    // Сохраняем в Supabase
    const { data: row } = await supabase
      .from('entries')
      .insert({ text: body, question, tags, tone, reply_to: ctx || null })
      .select()
      .single()

    if (row) {
      const entry = rowToEntry(row)
      setEntries(prev => [entry, ...prev])
      setPatterns(null)
      setTimeout(() => latestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
    setLoading(false)
  }

  const analyze = async (subset) => {
    const pool = subset || entries
    if (pool.length < 2 || analyzing) return
    setAnalyzing(true); setPatterns(null)
    try {
      const res = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: pool }),
      })
      setPatterns(await res.json())
    } catch { setPatterns({ error: true }) }
    setAnalyzing(false)
  }

  const clearAll = async () => {
    await supabase.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setEntries([]); setPatterns(null); setActiveTag(null)
    setShowClear(false); setReplyCtx(null); stopTimer()
    setSearchText(''); setShowSearch(false)
  }

  const tagFiltered   = activeTag ? entries.filter(e => (e.tags||[]).includes(activeTag)) : entries
  const finalFiltered = searchText.trim()
    ? tagFiltered.filter(e =>
        e.text.toLowerCase().includes(searchText.toLowerCase()) ||
        e.question?.toLowerCase().includes(searchText.toLowerCase()) ||
        (e.tags||[]).some(t => t.toLowerCase().includes(searchText.toLowerCase()))
      )
    : tagFiltered
  const tagStats = getTagStats(entries)

  /* ─── РЕНДЕР ────────────────────────────────────────────────────────── */
  return (
    <div style={s.root}>
      <style>{css}</style>

      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.brand}>дневник</span>
          {streak.current > 0 && (
            <div style={s.streakWrap} title={`рекорд: ${bestStreak} дн.`}>
              <span style={{ ...s.streakNum, color: streak.todayDone ? '#9B8FD8' : '#3D3870' }}>✦ {streak.current}</span>
              <span style={s.streakLabel}>{streak.todayDone ? 'сегодня' : 'дн.'}</span>
            </div>
          )}
        </div>
        <nav style={s.nav}>
          <button className={`j-tab j-search-toggle ${showSearch ? 'active' : ''}`} style={{ ...s.tab, fontSize: 16 }}
            onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchText('') }}>⌕</button>
          <button className={`j-tab ${view === 'journal' ? 'active' : ''}`} style={s.tab} onClick={() => setView('journal')}>
            записи {entries.length > 0 && <span style={s.badge}>{entries.length}</span>}
          </button>
          <button className={`j-tab ${view === 'patterns' ? 'active' : ''}`} style={s.tab} onClick={() => setView('patterns')}>паттерны</button>
          {entries.length > 0 && (
            <button className="j-tab j-export-btn" style={{ ...s.tab, marginLeft: 4 }} onClick={() => downloadMd(entries)}>↓ .md</button>
          )}
          <button className="j-tab" style={{ ...s.tab, marginLeft: 8, color: '#1E1C42' }} onClick={handleLogout} title="Выйти">⎋</button>
        </nav>
      </header>

      {showSearch && (
        <div style={s.searchWrap} className="j-search-bar">
          <span style={s.searchIcon}>⌕</span>
          <input ref={searchRef} className="j-search-input" style={s.searchInput} value={searchText}
            onChange={e => setSearchText(e.target.value)} placeholder="поиск по записям, вопросам, тегам..." />
          {searchText && <span style={s.searchCount}>{finalFiltered.length} из {tagFiltered.length}</span>}
          <button style={s.searchClose} className="j-close-btn" onClick={() => { setSearchText(''); setShowSearch(false) }}>×</button>
        </div>
      )}

      {view === 'journal' && (
        <>
          <div ref={composeRef} style={s.compose}>
            {replyCtx && (
              <div style={s.replyBar}>
                <span style={s.replyLabel}>↩</span>
                <span style={s.replyText}>{replyCtx}</span>
                <button style={s.replyClose} className="j-close-btn" onClick={() => setReplyCtx(null)}>×</button>
              </div>
            )}
            <textarea ref={textareaRef} className={`j-textarea ${replyCtx ? 'has-reply' : ''} ${timerMode === 'done' ? 'j-pulse' : ''}`}
              style={s.textarea} value={text} onChange={e => { setText(e.target.value); autoResize() }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendEntry() }}
              placeholder={replyCtx ? 'пиши свободно...' : 'что сейчас в голове...'} />
            <div style={s.toolbar}>
              {timerMode === 'idle'
                ? <span style={s.hint}>⌘↵</span>
                : <TimerControl timerMode={timerMode} timerSecs={timerSecs} timerTotal={timerTotal} onStart={startTimer} onStop={stopTimer} />}
              <div style={s.toolbarRight}>
                <ToneSelector tone={tone} onChange={handleToneChange} />
                {timerMode === 'idle' && <TimerControl timerMode={timerMode} timerSecs={timerSecs} timerTotal={timerTotal} onStart={startTimer} onStop={stopTimer} />}
                {wordCount > 0 && <span style={s.wordCount}>{wordCount} сл.</span>}
                <button className="j-btn" style={s.btn} onClick={sendEntry} disabled={!text.trim() || loading}>
                  {loading ? <span className="dots"><span /><span /><span /></span> : '→'}
                </button>
              </div>
            </div>
          </div>

          {tagStats.length > 0 && (
            <div style={s.filterWrap}>
              <button className={`j-tag-filter ${!activeTag ? 'active' : ''}`} style={s.filterPill} onClick={() => setActiveTag(null)}>все</button>
              {tagStats.map(([tag, count]) => (
                <button key={tag} className={`j-tag-filter ${activeTag === tag ? 'active' : ''}`} style={s.filterPill}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                  {tag}<span style={s.tagCount}>{count}</span>
                </button>
              ))}
            </div>
          )}

          {entries.length > 0 && (
            <div style={{ maxWidth: 620, margin: '20px auto 0', padding: '0 24px' }}>
              <div style={s.divider} />
              <div style={s.listHeader}>
                <span style={s.count}>
                  {searchText ? `${finalFiltered.length} ${plural(finalFiltered.length)} по «${searchText}»`
                    : activeTag ? `${finalFiltered.length} из ${entries.length} — «${activeTag}»`
                    : `${entries.length} ${plural(entries.length)}`}
                </span>
                {showClear
                  ? <span style={s.clearConfirm}>точно?{' '}<span style={s.clearLink} onClick={clearAll}>да</span>{' / '}<span style={s.clearLink} onClick={() => setShowClear(false)}>нет</span></span>
                  : <span style={s.clearLink} onClick={() => setShowClear(true)}>очистить</span>}
              </div>
            </div>
          )}

          {finalFiltered.map((e, i) => (
            <div key={e.id} style={s.card} className="j-card" ref={i === 0 ? latestRef : null}>
              <div style={s.entryMeta}>
                <span style={s.meta}>{fmtDate(e.ts)}</span>
                {e.tone && e.tone !== tone && <span style={s.toneMark}>{TONES[e.tone]?.label}</span>}
                {(e.tags||[]).length > 0 && (
                  <div style={s.entryTags}>
                    {e.tags.map(t => (
                      <span key={t} className={`j-entry-tag ${activeTag === t ? 'active' : ''}`}
                        style={s.entryTag} onClick={() => setActiveTag(activeTag === t ? null : t)}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {e.replyTo && <p style={s.replyRef}>↩ <em><Highlight text={e.replyTo} query={searchText} /></em></p>}
              <p style={s.entryText}><Highlight text={e.text} query={searchText} /></p>
              {e.question && (
                <div style={s.qBlock} className="j-question">
                  <span style={s.qArrow}>↳</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.qText}><Highlight text={e.question} query={searchText} /></p>
                    <button className="j-reply-btn" style={s.replyBtn} onClick={() => handleReply(e.question)}>↩ ответить</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {entries.length === 0 && !loading && <Onboarding />}
          {finalFiltered.length === 0 && entries.length > 0 && (
            <p style={s.empty}>{searchText ? `нет записей с «${searchText}»` : `нет записей с тегом «${activeTag}»`}</p>
          )}
        </>
      )}

      {view === 'patterns' && (
        <div style={s.pane}>
          {tagStats.length > 0 && !analyzing && (
            <div style={s.patternTagRow}>
              <span style={s.patternTagLabel}>по теме:</span>
              <button className={`j-tag-filter ${!activeTag ? 'active' : ''}`} style={s.filterPill}
                onClick={() => { setActiveTag(null); setPatterns(null) }}>все</button>
              {tagStats.map(([tag, count]) => count >= 2 && (
                <button key={tag} className={`j-tag-filter ${activeTag === tag ? 'active' : ''}`} style={s.filterPill}
                  onClick={() => { setActiveTag(activeTag === tag ? null : tag); setPatterns(null) }}>
                  {tag}<span style={s.tagCount}>{count}</span>
                </button>
              ))}
            </div>
          )}

          {(activeTag ? tagFiltered : entries).length < 2 ? (
            <p style={s.empty}>{activeTag ? `нужно хотя бы 2 записи с тегом «${activeTag}»` : 'нужно хотя бы 2 записи'}</p>
          ) : !patterns && !analyzing ? (
            <div style={s.analyzeWrap}>
              <p style={s.analyzeHint}>{activeTag ? `${tagFiltered.length} ${plural(tagFiltered.length)} · «${activeTag}»` : `${entries.length} ${plural(entries.length)}`}</p>
              <button className="j-analyze-btn" style={s.analyzeBtn} onClick={() => analyze(activeTag ? tagFiltered : null)}>найти паттерны</button>
            </div>
          ) : analyzing ? (
            <div style={s.analyzeWrap}><span className="dots big"><span /><span /><span /></span><p style={{ ...s.analyzeHint, marginTop: 20 }}>читаю записи...</p></div>
          ) : patterns?.error ? (
            <div style={s.analyzeWrap}><p style={s.analyzeHint}>что-то пошло не так</p><button className="j-analyze-btn" style={s.analyzeBtn} onClick={() => analyze(activeTag ? tagFiltered : null)}>попробовать снова</button></div>
          ) : (
            <div className="j-patterns">
              {activeTag && <div style={s.analysisMeta}>по теме <strong style={{ color: '#9B8FD8', fontWeight: 400 }}>«{activeTag}»</strong>{' · '}{tagFiltered.length} {plural(tagFiltered.length)}</div>}
              <section style={s.section}>
                <div style={s.sectionLabel}>повторяющиеся темы</div>
                <div style={s.themes}>
                  {patterns.themes?.map((t, i) => (
                    <div key={i} style={s.themeRow} className="j-theme-row">
                      <div style={s.themeTop}>
                        <span style={{ ...s.themeName, opacity: 0.5 + Math.min(t.count / (patterns.themes[0]?.count||1), 1) * 0.5, fontSize: 14 + Math.min(t.count - 1, 3) * 1.5 }}>{t.name}</span>
                        <span style={s.themeCount}>{t.count}×</span>
                      </div>
                      <p style={s.themeInsight}>{t.insight}</p>
                    </div>
                  ))}
                </div>
              </section>
              {patterns.pattern && <section style={s.section}><div style={s.sectionLabel}>главный паттерн</div><p style={s.patternText}>{patterns.pattern}</p></section>}
              {patterns.tension && <section style={{ ...s.section, ...s.tensionBlock }}><div style={{ ...s.sectionLabel, color: '#6A4A9E' }}>внутреннее противоречие</div><p style={s.tensionText}>{patterns.tension}</p></section>}
              {patterns.question && <section style={s.section}><div style={s.sectionLabel}>вопрос который объединяет всё</div><p style={s.bigQuestion}>{patterns.question}</p></section>}
              <div style={{ marginTop: 48 }}>
                <button className="j-analyze-btn ghost" style={{ ...s.analyzeBtn, ...s.ghostBtn }} onClick={() => analyze(activeTag ? tagFiltered : null)}>обновить анализ</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── СТИЛИ ─────────────────────────────────────────────────────────────── */

const s = {
  root: { minHeight: '100vh', padding: '48px 0 120px', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, color: '#EDE8FF' },
  header: { maxWidth: 620, margin: '0 auto 0', padding: '0 24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: 16 },
  brand: { fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 300, fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#6A5FB5' },
  streakWrap: { display: 'flex', alignItems: 'baseline', gap: 5 },
  streakNum: { fontSize: 12, letterSpacing: '0.06em', transition: 'color 0.3s' },
  streakLabel: { fontSize: 10, color: '#2A2660', letterSpacing: '0.08em' },
  nav: { display: 'flex', gap: 2, alignItems: 'center' },
  tab: { background: 'transparent', border: 'none', padding: '6px 10px', fontSize: 12, letterSpacing: '0.08em', color: '#2E2B60', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, borderRadius: 2, transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: 6 },
  badge: { background: '#1E1B45', color: '#534AA0', fontSize: 10, padding: '1px 6px', borderRadius: 10 },
  searchWrap: { maxWidth: 620, margin: '0 auto 24px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeDown 0.2s ease' },
  searchIcon: { fontSize: 15, color: '#3D3870', flexShrink: 0 },
  searchInput: { flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #1F1D46', color: '#EDE8FF', fontSize: 14, padding: '6px 0', outline: 'none', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 },
  searchCount: { fontSize: 11, color: '#3D3870', letterSpacing: '0.06em', flexShrink: 0 },
  searchClose: { background: 'transparent', border: 'none', color: '#2E2B60', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 },
  compose: { maxWidth: 620, margin: '0 auto', padding: '0 24px' },
  replyBar: { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#0F0E28', border: '1px solid #1F1845', borderBottom: 'none', borderRadius: '3px 3px 0 0', padding: '10px 14px' },
  replyLabel: { fontSize: 12, color: '#534AA0', flexShrink: 0, marginTop: 1 },
  replyText: { flex: 1, fontSize: 12, color: '#6B6490', lineHeight: 1.6, fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic' },
  replyClose: { background: 'transparent', border: 'none', color: '#2E2B60', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 },
  textarea: { width: '100%', minHeight: 180, background: '#111129', border: '1px solid #1F1D46', borderRadius: 3, padding: '20px 22px', color: '#EDE8FF', fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 20, fontWeight: 300, lineHeight: 1.8, resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, minHeight: 36 },
  hint: { fontSize: 11, color: '#1E1C42', letterSpacing: '0.05em' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 10 },
  wordCount: { fontSize: 11, color: '#2A2760', letterSpacing: '0.06em' },
  btn: { background: 'transparent', border: '1px solid #6A5FB5', color: '#C0B0FF', width: 40, height: 36, borderRadius: 2, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', fontFamily: 'inherit' },
  filterWrap: { maxWidth: 620, margin: '20px auto 0', padding: '0 24px', display: 'flex', flexWrap: 'wrap', gap: 6 },
  filterPill: { background: 'transparent', border: '1px solid #1F1D46', color: '#3D3870', padding: '4px 10px', borderRadius: 20, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 },
  tagCount: { color: '#2A2660', fontSize: 10 },
  divider: { height: 1, background: '#17163A' },
  listHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  count: { fontSize: 11, color: '#2E2B60', letterSpacing: '0.08em' },
  clearLink: { fontSize: 11, color: '#3D3870', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#252250' },
  clearConfirm: { fontSize: 11, color: '#3D3870' },
  card: { maxWidth: 620, margin: '0 auto 48px', padding: '24px 24px 0' },
  entryMeta: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: '#2E2B60', letterSpacing: '0.08em' },
  toneMark: { fontSize: 10, color: '#2A2660', fontStyle: 'italic' },
  entryTags: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  entryTag: { background: '#131230', border: '1px solid #1F1D46', color: '#3D3870', padding: '2px 8px', borderRadius: 20, fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s' },
  replyRef: { fontSize: 12, color: '#2A2760', fontStyle: 'italic', margin: '0 0 12px', lineHeight: 1.5, fontFamily: "'Crimson Pro', Georgia, serif" },
  entryText: { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 19, fontWeight: 300, lineHeight: 1.85, color: '#9E97C4', margin: '0 0 20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  qBlock: { borderLeft: '2px solid #534AA0', paddingLeft: 16, display: 'flex', gap: 10, alignItems: 'flex-start' },
  qArrow: { fontSize: 14, color: '#534AA0', marginTop: 5, flexShrink: 0, lineHeight: 1 },
  qText: { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 22, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.6, color: '#C4B3FF', margin: '0 0 10px' },
  replyBtn: { background: 'transparent', border: 'none', color: '#2E2B60', fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', padding: 0, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, transition: 'color 0.15s', display: 'block' },
  empty: { textAlign: 'center', color: '#1E1C42', fontSize: 13, marginTop: 48, fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic' },
  pane: { maxWidth: 620, margin: '0 auto', padding: '0 24px' },
  patternTagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 32 },
  patternTagLabel: { fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2E2B60', marginRight: 4 },
  analysisMeta: { fontSize: 12, color: '#3D3870', letterSpacing: '0.06em', marginBottom: 36 },
  analyzeWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 24 },
  analyzeHint: { fontSize: 13, color: '#2E2B60', letterSpacing: '0.06em', margin: 0 },
  analyzeBtn: { background: 'transparent', border: '1px solid #534AA0', color: '#B8ABFF', padding: '10px 28px', borderRadius: 2, fontSize: 13, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, transition: 'all 0.15s' },
  ghostBtn: { borderColor: '#2E2B60', color: '#3D3870' },
  section: { marginBottom: 48 },
  sectionLabel: { fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3D3870', marginBottom: 20 },
  themes: { display: 'flex', flexDirection: 'column', gap: 20 },
  themeRow: { borderLeft: '1px solid #1F1D46', paddingLeft: 16 },
  themeTop: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  themeName: { fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 400, color: '#C4B3FF' },
  themeCount: { fontSize: 11, color: '#3D3870', letterSpacing: '0.06em' },
  themeInsight: { fontSize: 13, color: '#6B6490', lineHeight: 1.7, margin: 0 },
  patternText: { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 20, fontWeight: 300, lineHeight: 1.8, color: '#ABA4D0', margin: 0 },
  tensionBlock: { background: '#0F0E28', border: '1px solid #1F1845', borderRadius: 3, padding: '20px 22px' },
  tensionText: { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 19, fontWeight: 300, lineHeight: 1.8, color: '#9B7FCC', margin: 0 },
  bigQuestion: { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 26, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.55, color: '#C4B3FF', margin: 0 },
}

const css = `
  * { box-sizing: border-box; }
  .j-textarea::placeholder { color: #1E1C42; font-style: italic; }
  .j-textarea:focus { border-color: #342F72 !important; }
  .j-textarea.has-reply { border-radius: 0 0 3px 3px !important; border-top-color: #0F0E28 !important; }
  .j-btn:hover:not(:disabled) { background: #191744 !important; border-color: #C0B0FF !important; }
  .j-btn:disabled { opacity: 0.3; cursor: default; }
  .j-tab.active { color: #9B8FD8 !important; }
  .j-tab:hover { color: #6A5FB5 !important; }
  .j-search-toggle.active { color: #9B8FD8 !important; }
  .j-export-btn { font-size: 11px !important; letter-spacing: 0.1em !important; color: #2A2760 !important; }
  .j-export-btn:hover { color: #9B8FD8 !important; }
  .j-search-input::placeholder { color: #1E1C42; }
  .j-search-input:focus { border-bottom-color: #534AA0 !important; }
  .j-close-btn:hover { color: #9B8FD8 !important; }
  .j-tag-filter:hover { border-color: #534AA0 !important; color: #9B8FD8 !important; }
  .j-tag-filter.active { border-color: #534AA0 !important; color: #B8ABFF !important; background: #1C1A42 !important; }
  .j-entry-tag:hover { border-color: #534AA0 !important; color: #9B8FD8 !important; }
  .j-entry-tag.active { border-color: #534AA0 !important; color: #B8ABFF !important; background: #1C1A42 !important; }
  .j-reply-btn:hover { color: #9B8FD8 !important; }
  .j-tone-btn:hover { border-color: #534AA0 !important; color: #9B8FD8 !important; }
  .j-tone-btn.open { border-color: #534AA0 !important; color: #B8ABFF !important; background: #1C1A42 !important; }
  .j-tone-opt:hover { background: #1C1A42 !important; }
  .j-tone-opt.active { background: #1A1840 !important; }
  .j-timer-btn:hover { color: #7467C0 !important; }
  .j-timer-btn.active { color: #9B8FD8 !important; }
  .j-timer-opt:hover { border-color: #534AA0 !important; color: #B8ABFF !important; background: #1C1A42 !important; }
  .j-timer-stop:hover { color: #9B8FD8 !important; }
  .j-analyze-btn:hover { background: #1C1A42 !important; border-color: #C4B3FF !important; color: #C4B3FF !important; }
  .j-analyze-btn.ghost:hover { background: #111129 !important; border-color: #534AA0 !important; color: #6A5FB5 !important; }
  .j-card { animation: fadeUp 0.4s ease; }
  .j-question { animation: slideIn 0.55s ease; }
  .j-patterns { animation: fadeUp 0.4s ease; }
  .j-onboarding { animation: fadeUp 0.7s ease; }
  .j-search-bar { animation: fadeDown 0.2s ease; }
  .j-theme-row:hover { border-left-color: #534AA0 !important; }
  .j-pulse { animation: pulse 0.6s ease; }
  .j-timer-done { animation: timerDone 0.5s ease; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; border-left-color: transparent !important; } to { opacity: 1; border-left-color: #534AA0 !important; } }
  @keyframes timerDone { 0% { opacity: 0.6; } 100% { opacity: 1; } }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(123,188,126,0.15); } 50% { box-shadow: 0 0 0 6px rgba(123,188,126,0); } 100% { box-shadow: none; } }
  .dots { display: inline-flex; gap: 3px; align-items: center; }
  .dots span { width: 4px; height: 4px; border-radius: 50%; background: #6A5FB5; display: block; animation: blink 1.2s ease-in-out infinite; }
  .dots.big span { width: 6px; height: 6px; }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,60%,100% { opacity: 0.2; } 30% { opacity: 1; } }
`
