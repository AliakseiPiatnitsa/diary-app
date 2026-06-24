'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={s.root}>
      <style>{css}</style>
      <div style={s.card}>

        <div style={s.logo}>д</div>
        <h1 style={s.title}>дневник</h1>
        <p style={s.sub}>самопознание без структуры</p>

        {sent ? (
          <div style={s.sentBox}>
            <p style={s.sentIcon}>✦</p>
            <p style={s.sentTitle}>письмо отправлено</p>
            <p style={s.sentText}>
              Проверь почту — там ссылка для входа.<br />
              Папку «Спам» тоже посмотри.
            </p>
          </div>
        ) : (
          <div style={s.form}>
            <input
              className="l-input"
              style={s.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="твой email"
              autoFocus
            />
            {error && (
              <p style={s.error}>
                {error.includes('rate') || error.includes('429')
                  ? 'Слишком много попыток. Подожди минуту и попробуй снова.'
                  : 'Не получилось отправить письмо. Проверь email и попробуй снова.'}
              </p>
            )}
            <button
              className="l-btn"
              style={s.btn}
              onClick={handleSubmit}
              disabled={!email.trim() || loading}
            >
              {loading
                ? <span className="dots"><span/><span/><span/></span>
                : 'войти без пароля →'}
            </button>
            <p style={s.note}>
              Первый раз? Аккаунт создастся автоматически.<br />
              Пароль не нужен — только ссылка в письме.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#0C0C1E',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
  },
  logo: {
    fontFamily: "'Crimson Pro', Georgia, serif",
    fontSize: 48,
    color: '#7B6FBE',
    lineHeight: 1,
    marginBottom: 12,
  },
  title: {
    fontFamily: "'Crimson Pro', Georgia, serif",
    fontWeight: 300,
    fontSize: 13,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color: '#C4B3FF',
    marginBottom: 8,
  },
  sub: {
    fontSize: 13,
    color: '#6B6490',
    letterSpacing: '0.06em',
    marginBottom: 48,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  input: {
    width: '100%',
    background: '#131230',
    border: '1px solid #2D2B5E',
    borderRadius: 4,
    padding: '14px 16px',
    color: '#EDE8FF',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 15,
    fontWeight: 300,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    background: '#4A3F9E',
    border: 'none',
    borderRadius: 4,
    padding: '14px 20px',
    color: '#EDE8FF',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    fontWeight: 400,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  note: {
    fontSize: 12,
    color: '#4A4580',
    lineHeight: 1.7,
    textAlign: 'center',
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: '#C47B7B',
    lineHeight: 1.6,
    textAlign: 'center',
    padding: '8px 12px',
    background: '#1F0F0F',
    borderRadius: 4,
    border: '1px solid #3D1515',
  },
  sentBox: {
    textAlign: 'center',
    padding: '32px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  sentIcon: { fontSize: 24, color: '#7B6FBE' },
  sentTitle: {
    fontFamily: "'Crimson Pro', Georgia, serif",
    fontSize: 22,
    color: '#C4B3FF',
    fontWeight: 300,
  },
  sentText: {
    fontSize: 13,
    color: '#6B6490',
    lineHeight: 1.7,
  },
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400&family=Inter:wght@300;400&display=swap');
  .l-input::placeholder { color: #3D3870; }
  .l-input:focus { border-color: #6A5FB5 !important; }
  .l-btn:hover:not(:disabled) { background: #5A4FBE !important; }
  .l-btn:disabled { opacity: 0.4; cursor: default; }
  .dots { display: inline-flex; gap: 4px; align-items: center; }
  .dots span { width: 5px; height: 5px; border-radius: 50%; background: #C4B3FF; display: block; animation: blink 1.2s ease-in-out infinite; }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,60%,100% { opacity: 0.2; } 30% { opacity: 1; } }
`
