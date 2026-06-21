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
    if (error) setError('Что-то пошло не так. Попробуй ещё раз.')
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={s.root}>
      <style>{css}</style>
      <div style={s.card}>
        <p style={s.brand}>дневник</p>
        <p style={s.tagline}>самопознание без структуры</p>

        {sent ? (
          <div style={s.sent}>
            <p style={s.sentTitle}>письмо отправлено</p>
            <p style={s.sentHint}>проверь почту — там ссылка для входа. спам тоже посмотри.</p>
          </div>
        ) : (
          <>
            <div style={s.field}>
              <input
                className="login-input"
                style={s.input}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="твой email"
                autoFocus
              />
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button
              className="login-btn"
              style={s.btn}
              onClick={handleSubmit}
              disabled={!email.trim() || loading}
            >
              {loading
                ? <span className="dots"><span /><span /><span /></span>
                : 'войти без пароля →'}
            </button>
            <p style={s.note}>получишь письмо со ссылкой — никакого пароля</p>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  root: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 0 },
  brand: { fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 300, fontSize: 13, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#6A5FB5', marginBottom: 8 },
  tagline: { fontSize: 13, color: '#2A2760', letterSpacing: '0.06em', marginBottom: 40 },
  field: { marginBottom: 12 },
  input: { width: '100%', background: '#111129', border: '1px solid #1F1D46', borderRadius: 3, padding: '12px 16px', color: '#EDE8FF', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, fontWeight: 300, outline: 'none', transition: 'border-color 0.2s' },
  btn: { width: '100%', background: 'transparent', border: '1px solid #6A5FB5', color: '#C0B0FF', padding: '11px 20px', borderRadius: 2, fontSize: 13, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  note: { fontSize: 11, color: '#1E1C42', letterSpacing: '0.05em', textAlign: 'center' },
  error: { fontSize: 12, color: '#9B4A4A', marginBottom: 12, letterSpacing: '0.04em' },
  sent: { padding: '24px 0' },
  sentTitle: { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 20, color: '#9B8FD8', marginBottom: 10 },
  sentHint: { fontSize: 13, color: '#3D3870', lineHeight: 1.65 },
}

const css = `
  .login-input::placeholder { color: #1E1C42; }
  .login-input:focus { border-color: #534AA0 !important; }
  .login-btn:hover:not(:disabled) { background: #191744 !important; border-color: #C0B0FF !important; }
  .login-btn:disabled { opacity: 0.3; cursor: default; }
  .dots { display: inline-flex; gap: 3px; align-items: center; }
  .dots span { width: 4px; height: 4px; border-radius: 50%; background: #6A5FB5; display: block; animation: blink 1.2s ease-in-out infinite; }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,60%,100% { opacity: 0.2; } 30% { opacity: 1; } }
`
