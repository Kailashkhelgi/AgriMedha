import React, { useState } from 'react';
import RegisterPage from './pages/auth/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import SoilProfilePage from './pages/SoilProfilePage';
import CropAdvisoryPage from './pages/CropAdvisoryPage';
import FertilizerPage from './pages/FertilizerPage';
import WeatherPage from './pages/WeatherPage';
import ImageAnalysisPage from './pages/ImageAnalysisPage';
import MarketPricePage from './pages/MarketPricePage';
import DashboardPage from './pages/DashboardPage';
import { type Lang, LANGUAGES, t } from './i18n';
import AIChatbot from './components/AIChatbot';


type Page =
  | 'home' | 'register' | 'login'
  | 'dashboard' | 'profile' | 'soil-profile' | 'crop-advisory'
  | 'fertilizer' | 'weather' | 'image-analysis' | 'market-price'
  | 'admin-dashboard';

export default function App() {
  const [page, setPage] = useState<Page>(() =>
    localStorage.getItem('accessToken') ? 'dashboard' : 'home'
  );
  const [routeState, setRouteState] = useState<Record<string, string>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('accessToken'));
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) ?? 'en');

  function changeLang(l: Lang) {
    setLang(l);
    localStorage.setItem('lang', l);
  }

  function navigate(target: string, state?: Record<string, string>) {
    setPage(target as Page);
    if (state) setRouteState(state);
    window.scrollTo(0, 0);
  }

  function handleLogout() {
    // Preserve saved credentials (Remember Me feature)
    const savedMobile = localStorage.getItem('savedMobile');
    const savedPassword = localStorage.getItem('savedPassword');
    
    // Clear all auth data
    localStorage.clear();
    
    // Restore saved credentials if they existed
    if (savedMobile) localStorage.setItem('savedMobile', savedMobile);
    if (savedPassword) localStorage.setItem('savedPassword', savedPassword);
    
    setIsLoggedIn(false);
    navigate('home');
  }

  const SIDEBAR_ITEMS_TRANSLATED = [
    { icon: '🏠', label: t(lang, 'dashboard'), page: 'dashboard' },
    { icon: '👤', label: t(lang, 'myProfile'), page: 'profile' },
    { icon: '🌱', label: t(lang, 'soilProfile'), page: 'soil-profile' },
    { icon: '🌾', label: t(lang, 'cropAdvisory'), page: 'crop-advisory' },
    { icon: '🧪', label: t(lang, 'fertilizer'), page: 'fertilizer' },
    { icon: '🌤', label: t(lang, 'weather'), page: 'weather' },
    { icon: '📷', label: t(lang, 'imageAnalysis'), page: 'image-analysis' },
    { icon: '💰', label: t(lang, 'marketPrices'), page: 'market-price' },
  ];

  // ── Navbar ──────────────────────────────────────────────────────────────
  const Navbar = () => (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('home')} style={{ cursor: 'pointer' }}>
        <span>🌿</span> AgriMedha
      </div>
      <div className="navbar-links">
        {isLoggedIn ? (
          <>
            <button onClick={() => navigate('dashboard')}>{t(lang, 'dashboard')}</button>
            <button onClick={() => navigate('crop-advisory')}>{t(lang, 'cropAdvisory')}</button>
            <button onClick={() => navigate('weather')}>{t(lang, 'weather')}</button>
            {/* Language Switcher */}
            <select value={lang} onChange={e => changeLang(e.target.value as Lang)}
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '4px 8px', fontSize: '0.85rem', cursor: 'pointer' }}>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code} style={{ background: '#1b5e20', color: '#fff' }}>
                  {l.native}
                </option>
              ))}
            </select>
            <button onClick={handleLogout}>{t(lang, 'logout')}</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('home')}>Home</button>
            <button onClick={() => navigate('login')}>Login</button>
            <button className="btn-nav-cta" onClick={() => navigate('register')}>Register Free</button>
          </>
        )}
      </div>
    </nav>
  );

  // ── Home / Landing ───────────────────────────────────────────────────────
  if (page === 'home') {
    return <LandingPage navigate={navigate} onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  // ── Auth pages ───────────────────────────────────────────────────────────
  if (page === 'register' || page === 'login') {
    return (
      <>
        <Navbar />
        <RegisterPage
          mode={page === 'login' ? 'login' : 'register'}
          onNavigate={(target) => {
            if (target === 'home' || target === 'dashboard') {
              setIsLoggedIn(true);
              setPage('dashboard');
              window.scrollTo(0, 0);
            } else {
              navigate(target);
            }
          }}
        />
      </>
    );
  }
  // ── Authenticated app layout ─────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div className="app-layout">
        <aside className="sidebar">          {SIDEBAR_ITEMS_TRANSLATED.map(item => (
            <div
              key={item.page}
              className={`sidebar-item ${page === item.page ? 'active' : ''}`}
              onClick={() => navigate(item.page)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
          <div className="sidebar-item" onClick={handleLogout} style={{ marginTop: 'auto', color: '#c62828' }}>
            <span className="icon">🚪</span> {t(lang, 'logout')}
          </div>
        </aside>

        <main className="main-content">
          {page === 'dashboard' && <HomeDashboard navigate={navigate} lang={lang} />}
          {page === 'profile' && <ProfilePage onNavigate={navigate} />}
          {page === 'soil-profile' && <SoilProfilePage onNavigate={navigate} />}
          {page === 'crop-advisory' && <CropAdvisoryPage plotId="" onNavigate={navigate} />}
          {page === 'fertilizer' && <FertilizerPage plotId="" cropId="wheat" onNavigate={navigate} />}
          {page === 'weather' && <WeatherPage />}
          {page === 'image-analysis' && <ImageAnalysisPage onNavigate={navigate} />}
          {page === 'market-price' && <MarketPricePage />}
          {page === 'admin-dashboard' && <DashboardPage role="officer" onNavigate={navigate} />}
        </main>
      </div>
      <AIChatbot />
    </>
  );
}

function HomeDashboard({ navigate, lang }: { navigate: (p: string) => void; lang: Lang }) {
  return (
    <div>
      <h1 className="page-title">{t(lang, 'welcomeBack')}</h1>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">3</div><div className="stat-label">{t(lang, 'soilProfiles')}</div></div>
        <div className="stat-card"><div className="stat-value">8</div><div className="stat-label">{t(lang, 'advisorySessions')}</div></div>
        <div className="stat-card"><div className="stat-value">5</div><div className="stat-label">{t(lang, 'weatherAlerts')}</div></div>
        <div className="stat-card"><div className="stat-value">4.2⭐</div><div className="stat-label">{t(lang, 'avgRating')}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { icon: '🌾', label: t(lang, 'getCropAdvice'), page: 'crop-advisory' },
          { icon: '🧪', label: t(lang, 'fertilizerGuide'), page: 'fertilizer' },
          { icon: '🌤', label: t(lang, 'weatherAlerts'), page: 'weather' },
          { icon: '📷', label: t(lang, 'detectPests'), page: 'image-analysis' },
          { icon: '💰', label: t(lang, 'marketPrices'), page: 'market-price' },
        ].map(item => (
          <div key={item.page} className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate(item.page)}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
            <div style={{ fontWeight: 600, color: 'var(--green-dark)' }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ navigate, onLoginSuccess }: { navigate: (p: string) => void; onLoginSuccess: () => void }) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [mobile, setMobile] = useState(() => localStorage.getItem('savedMobile') ?? '');
  const [password, setPassword] = useState(() => localStorage.getItem('savedPassword') ?? '');
  const [confirm, setConfirm] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('savedMobile'));
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    if (!mobile || !password) { setAuthError('Please fill all fields.'); return; }
    if (authTab === 'register' && password !== confirm) { setAuthError('Passwords do not match.'); return; }
    setAuthLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const url = authTab === 'login'
        ? `${baseUrl}/auth/login`
        : `${baseUrl}/auth/register`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? data?.message ?? 'Failed');
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('farmerId', data.data.farmerId);
      // Save credentials if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('savedMobile', mobile);
        localStorage.setItem('savedPassword', password);
      } else {
        localStorage.removeItem('savedMobile');
        localStorage.removeItem('savedPassword');
      }
      onLoginSuccess();
      navigate('dashboard');
    } catch (err: unknown) {
      setAuthError((err as Error).message ?? 'Something went wrong.');
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1a1a1a' }}>
      {/* Navbar */}
      <nav style={{ background: '#1b5e20', padding: '0 2rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🌿</span> AgriMedha
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {['About', 'How it Works', 'Features'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`}
              style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '0.9rem' }}>{l}</a>
          ))}
          <button onClick={() => setAuthTab('register')}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#fff', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.9rem' }}>
            Sign Up
          </button>
          <button onClick={() => setAuthTab('login')}
            style={{ background: '#fff', border: 'none', color: '#1b5e20', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero + Auth */}
      <section style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 60%, #c8e6c9 100%)', padding: '4rem 2rem 3rem', minHeight: '85vh', display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-block', background: '#c8e6c9', color: '#1b5e20', borderRadius: 20, padding: '4px 14px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
              🇮🇳 Made for Indian Farmers
            </div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1.2, color: '#1b5e20', marginBottom: '1rem' }}>
              Empowering Indian Farmers<br />with Smart Decisions
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#4a7c59', marginBottom: '2rem', lineHeight: 1.6 }}>
              Data-driven crop, soil, and farm management using advanced technology. Get personalized guidance on crops, fertilizers, weather, and market prices.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <button onClick={() => { setAuthTab('register'); document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth' }); }}
                style={{ background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                Get Started (Free)
              </button>
              <a href="#how-it-works"
                style={{ background: 'transparent', color: '#1b5e20', border: '2px solid #1b5e20', borderRadius: 8, padding: '12px 28px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Learn More
              </a>
            </div>
            {/* Farmer illustration placeholder */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b5e20' }}>10,000+</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Farmers</div>
              </div>
              <div style={{ width: 1, height: 36, background: '#ccc' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b5e20' }}>50k+</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Advisory Sessions</div>
              </div>
              <div style={{ width: 1, height: 36, background: '#ccc' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b5e20' }}>4.5⭐</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Average Rating</div>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div id="auth-card" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', padding: '2rem', maxWidth: 420, width: '100%', justifySelf: 'end' }}>
            <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '1.5rem' }}>
              {(['login', 'register'] as const).map(tab => (
                <button key={tab} onClick={() => { setAuthTab(tab); setAuthError(''); }}
                  style={{ flex: 1, padding: '10px', border: 'none', background: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: authTab === tab ? '#1b5e20' : '#999', borderBottom: authTab === tab ? '2px solid #1b5e20' : '2px solid transparent', marginBottom: -2 }}>
                  {tab === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {authError && <div style={{ background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', fontSize: '0.85rem' }}>{authError}</div>}

            <form onSubmit={handleAuth}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: 6 }}>Mobile Number</label>
                <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 98765 43210"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: authTab === 'register' ? '1rem' : '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              {authTab === 'register' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: 6 }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm Password"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }} />
                  <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#888' }}>
                    <input type="checkbox" id="terms" style={{ marginRight: 6 }} />
                    <label htmlFor="terms">I agree to <span style={{ color: '#1b5e20', cursor: 'pointer' }}>Terms of Service</span></label>
                  </div>
                </div>
              )}
              {authTab === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember Me
                  </label>
                  <span style={{ color: '#1b5e20', cursor: 'pointer' }}>Forgot Password?</span>
                </div>
              )}
              <button type="submit" disabled={authLoading}
                style={{ width: '100%', background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: '1rem', fontWeight: 600, cursor: authLoading ? 'not-allowed' : 'pointer' }}>
                {authLoading ? '⏳ Please wait…' : authTab === 'login' ? 'Sign In' : 'Register'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#888' }}>
              {authTab === 'login' ? <>New to AgriMedha? <span style={{ color: '#1b5e20', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAuthTab('register')}>Sign Up here</span></> : <>Already have an account? <span style={{ color: '#1b5e20', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAuthTab('login')}>Sign In</span></>}
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: '4rem 2rem', background: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b5e20', marginBottom: '0.5rem' }}>How It Works</h2>
          <p style={{ color: '#666', marginBottom: '3rem' }}>Four simple steps to smarter farming</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: '🌱', step: '1', title: 'Create Profile', sub: 'Soil + Details' },
              { icon: '🌾', step: '2', title: 'Get Expert Recommendations', sub: 'Crop + Fertilizer' },
              { icon: '🌤', step: '3', title: 'Stay Updated', sub: 'Weather + Prices' },
              { icon: '📷', step: '4', title: 'Diagnose Pests', sub: 'AI Image Analysis' },
            ].map(item => (
              <div key={item.step} style={{ background: '#f9f9f9', borderRadius: 12, padding: '2rem 1.5rem', border: '1px solid #eee', transition: 'transform 0.2s' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{item.icon}</div>
                <div style={{ background: '#1b5e20', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', margin: '0 auto 0.75rem' }}>{item.step}</div>
                <h3 style={{ fontWeight: 700, color: '#1b5e20', marginBottom: 4, fontSize: '1rem' }}>{item.title}</h3>
                <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>({item.sub})</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '4rem 2rem', background: '#f1f8e9' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b5e20', textAlign: 'center', marginBottom: '0.5rem' }}>Everything a Farmer Needs</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: '3rem' }}>All tools in one platform, designed for Indian agriculture</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: '🌾', title: 'Crop Advisory', desc: 'AI-powered crop recommendations based on your soil pH, NPK values, and location. Get top 5 crops with yield estimates and input costs.' },
              { icon: '🧪', title: 'Fertilizer Guidance', desc: 'Precise Urea, DAP, and MOP quantities calculated from your soil deficiency. Includes timing schedule and organic alternatives.' },
              { icon: '🌤', title: 'Weather Alerts', desc: 'Live 5-day forecast with farming-specific alerts for thunderstorms, heavy rain, and strong winds. Powered by OpenWeatherMap.' },
              { icon: '📷', title: 'Pest & Disease Detection', desc: 'Upload a crop photo to detect leaf yellowing, brown blight, powdery mildew, and more. Get treatment and prevention advice instantly.' },
              { icon: '💰', title: 'Market Prices', desc: 'Live mandi prices for 15+ commodities across major Indian markets. Filter by state, search by crop, track price trends.' },
              { icon: '📍', title: 'GPS Field Location', desc: 'Detect your exact field location using GPS. Auto-fills coordinates and reverse geocodes to show your village and district name.' },
            ].map(f => (
              <div key={f.title} style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e8f5e9' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, color: '#1b5e20', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" style={{ padding: '4rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b5e20', marginBottom: '1rem' }}>About the Project</h2>
            <p style={{ color: '#555', lineHeight: 1.8, marginBottom: '1rem' }}>
              AgriMedha is a final year project developed at Sharnbasva University, Kalaburagi, under the Department of Computer Science. It aims to bridge the technology gap for small and marginal farmers across India.
            </p>
            <p style={{ color: '#555', lineHeight: 1.8, marginBottom: '1.5rem' }}>
              The system uses rule-based agronomic algorithms, real-time weather data, and image analysis to provide actionable, personalized guidance — completely free of cost.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {['Spring Boot', 'React', 'TypeScript', 'PostgreSQL', 'Vercel', 'Render', 'Supabase'].map(t => (
                <span key={t} style={{ background: '#e8f5e9', color: '#1b5e20', borderRadius: 20, padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              { val: '10,000+', label: 'Registered Farmers', icon: '👨‍🌾' },
              { val: '50k+', label: 'Advisory Sessions', icon: '📊' },
              { val: '4.5⭐', label: 'Average Rating', icon: '⭐' },
              { val: '15+', label: 'Crops Supported', icon: '🌾' },
            ].map(m => (
              <div key={m.label} style={{ background: '#f1f8e9', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b5e20' }}>{m.val}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', padding: '4rem 2rem', textAlign: 'center', color: '#fff' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Ready to Farm Smarter?</h2>
        <p style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: '2rem' }}>Join thousands of farmers already using AgriMedha</p>
        <button onClick={() => { setAuthTab('register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{ background: '#fff', color: '#1b5e20', border: 'none', borderRadius: 8, padding: '14px 36px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>
          Get Started Free →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ background: '#1b5e20', color: 'rgba(255,255,255,0.8)', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ cursor: 'pointer' }}>Contact Us</span>
            <span style={{ cursor: 'pointer' }}>Terms of Service</span>
            <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
            © 2026 AgriMedha · Sharnbasva University, Kalaburagi
          </p>
        </div>
      </footer>
    </div>
  );
}
