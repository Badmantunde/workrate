import { useState } from 'react';
import { login, register } from '../api/client.js';

const C = {
  bg:'#F7F6F3', surface:'#FFFFFF', border:'#E3E0D9', borderLight:'#EEECE8',
  text:'#18170F', sub:'#6A6760', muted:'#A5A29A',
  accent:'#1B7A50', accentLight:'#EDF6F1', accentBorder:'#BEE0CE', accentDark:'#0D5535',
  danger:'#BE1A1A', dangerLight:'#FDEAEA',
};

const inp = {
  width:'100%', padding:'11px 14px', borderRadius:9,
  border:`1.5px solid ${C.border}`, fontSize:14, color:C.text,
  background:C.bg, fontFamily:'inherit', outline:'none', boxSizing:'border-box',
  transition:'border-color .15s',
};

export default function Login({ onAuth }) {
  const [mode, setMode]     = useState('login'); // 'login' | 'register'
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [name,  setName]    = useState('');
  const [err,   setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await login(email, pass)
        : await register(email, pass, name);
      onAuth(data.user);
    } catch (ex) {
      setErr(ex.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
      <div style={{width:'100%', maxWidth:400}}>

        {/* Logo */}
        <div style={{display:'flex', alignItems:'center', gap:9, justifyContent:'center', marginBottom:36}}>
          <div style={{width:32, height:32, borderRadius:9, background:C.accent, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="6" width="2" height="7" rx="1" fill="white" opacity=".65"/>
              <rect x="4.5" y="3" width="2" height="10" rx="1" fill="white" opacity=".8"/>
              <rect x="8" y="1" width="2" height="12" rx="1" fill="white"/>
              <rect x="11.5" y="4" width="2" height="9" rx="1" fill="white" opacity=".7"/>
            </svg>
          </div>
          <span style={{fontSize:18, fontWeight:700, letterSpacing:'-0.02em', color:C.text}}>WorkRate</span>
        </div>

        {/* Card */}
        <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:'32px 28px', boxShadow:'0 4px 32px rgba(24,23,15,.07)'}}>
          <h1 style={{fontSize:20, fontWeight:600, letterSpacing:'-0.02em', color:C.text, marginBottom:6}}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{fontSize:13, color:C.sub, marginBottom:24}}>
            {mode === 'login' ? 'Log in to your WorkRate dashboard.' : 'Start tracking verified time for free.'}
          </p>

          <form onSubmit={submit} style={{display:'flex', flexDirection:'column', gap:12}}>
            {mode === 'register' && (
              <input
                style={inp} type="text" placeholder="Your name"
                value={name} onChange={e => setName(e.target.value)}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e  => e.target.style.borderColor = C.border}
                required
              />
            )}
            <input
              style={inp} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e  => e.target.style.borderColor = C.border}
              required autoComplete="email"
            />
            <input
              style={inp} type="password" placeholder="Password"
              value={pass} onChange={e => setPass(e.target.value)}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e  => e.target.style.borderColor = C.border}
              required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {err && (
              <div style={{fontSize:13, color:C.danger, background:C.dangerLight, padding:'9px 12px', borderRadius:8, border:`1px solid rgba(190,26,26,.2)`}}>
                {err}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                marginTop:4, padding:'13px', borderRadius:9, border:'none',
                background: loading ? C.muted : C.accent, color:'#fff',
                fontSize:14, fontWeight:600, cursor: loading ? 'wait' : 'pointer',
                fontFamily:'inherit', transition:'background .15s',
              }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <div style={{marginTop:20, textAlign:'center', fontSize:13, color:C.sub}}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); }}
              style={{background:'none', border:'none', color:C.accent, fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit'}}
            >
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </div>
        </div>

        <p style={{textAlign:'center', fontSize:12, color:C.muted, marginTop:20}}>
          By continuing you agree to our{' '}
          <a href="/privacy" style={{color:C.sub}}>Privacy Policy</a>
          {' '}and{' '}
          <a href="/terms" style={{color:C.sub}}>Terms</a>.
        </p>
      </div>
    </div>
  );
}
