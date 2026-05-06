import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Link2, Lock, Menu, Radio, Users, Video, X, Zap } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { api } from '../services/api';
import { auth } from '../services/firebase';

const features = [
  ['HD video rooms', 'Join fast with browser-native video that keeps teams moving.', Video],
  ['Live participant state', 'Names, camera state, mute state, and presence stay readable.', Users],
  ['Realtime chat', 'Socket-powered chat keeps every message attributed and current.', Radio],
  ['Secure by default', 'Simple room links, clean identity flow, and no noisy setup.', Lock],
];

const steps = [
  ['01', 'Enter your name', 'Choose the identity everyone sees in the meeting.'],
  ['02', 'Share the link', 'Copy the room invite from the top bar in one click.'],
  ['03', 'Talk', 'Video, chat, screen share, and presence stay close at hand.'],
];

const stats = [
  [0, 'teams onboarded'],
  [3, 'steps to start'],
  [10, 'messages / 5s rate guard'],
  [100, 'percent browser based'],
];

function CountUp({ value, active }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const duration = 900;
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setCount(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);

  return <span>{count}</span>;
}

const Landing = () => {
  const [meetingId, setMeetingId] = useState('');
  const [title, setTitle] = useState('');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('altfmeet:name') || '');
  const [loading, setLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [statsActive, setStatsActive] = useState(false);
  const revealRef = useRef(null);
  const statsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    signInAnonymously(auth).catch((err) => console.error('Auth error:', err));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const items = Array.from(revealRef.current?.querySelectorAll('.feature-card, .step-card') || []);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });
    items.forEach((item, index) => {
      item.style.transitionDelay = `${index * 60}ms`;
      observer.observe(item);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStatsActive(true);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const persistName = () => {
    const name = displayName.trim();
    if (!name) return '';
    localStorage.setItem('altfmeet:name', name);
    return name;
  };

  const handleCreateMeeting = async () => {
    const name = persistName();
    if (!name) return;
    setLoading(true);
    try {
      const userId = `user_${Math.random().toString(36).slice(2, 11)}`;
      const res = await api.createMeeting(userId, title || 'Alt+F Meeting');
      if (res.meetingId) {
        navigate(`/room/${res.meetingId}?userId=${userId}&name=${encodeURIComponent(name)}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = () => {
    const name = persistName();
    if (!name || !meetingId.trim()) return;
    const userId = `user_${Math.random().toString(36).slice(2, 11)}`;
    navigate(`/room/${meetingId.trim()}?userId=${userId}&name=${encodeURIComponent(name)}`);
  };

  const navLinks = ['Features', 'How it Works', 'Pricing'];

  return (
    <div className="page-shell">
      <nav className={`nav-shell ${scrolled ? 'scrolled py-2' : 'py-4'}`}>
        <div className="container-xl flex items-center justify-between">
          <div className="wordmark">
            <div className="logo-mark">A</div>
            <span>Alt+F Meet</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link} className="nav-link" href={`#${link.toLowerCase().replaceAll(' ', '-')}`}>{link}</a>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button className="btn-ghost">Sign In</button>
            <button className="btn-primary" onClick={handleCreateMeeting} disabled={loading || !displayName.trim()}>
              Get Started Free
            </button>
          </div>
          <button className="btn-ghost px-3 md:hidden" onClick={() => setNavOpen((open) => !open)} aria-label="Toggle navigation">
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {navOpen && (
          <div className="container-xl mt-3 grid gap-2 border-t border-border pt-3 md:hidden">
            {navLinks.map((link) => <a key={link} className="nav-link py-2" href={`#${link.toLowerCase().replaceAll(' ', '-')}`}>{link}</a>)}
            <button className="btn-primary mt-2" onClick={handleCreateMeeting} disabled={loading || !displayName.trim()}>Get Started Free</button>
          </div>
        )}
      </nav>

      <main ref={revealRef}>
        <section className="hero-bg min-h-screen">
          <div className="hero-blob one" />
          <div className="hero-blob two" />
          <div className="hero-blob three" />
          <div className="container-xl relative z-10 grid min-h-screen items-center gap-12 py-16 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="mx-auto max-w-3xl text-center lg:text-left">
              <div className="badge mb-6">
                <span className="pulse-dot" />
                Now in Beta · Free to Use
              </div>
              <h1 className="display-title text-text">
                Meet faster with <span className="gradient-text">crystal-clear video rooms</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-xl leading-8 text-secondary lg:mx-0">
                Alt+F Meet is a polished browser meeting room with names, chat, screen sharing, and live participant presence built in.
              </p>

              <div className="mt-8 grid gap-3 rounded-2xl border border-border bg-white/80 p-3 shadow-[var(--shadow-md-blue)] backdrop-blur sm:grid-cols-2">
                <input className="input-field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
                <input className="input-field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Meeting title" />
              </div>

              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <button className="btn-gradient px-6 py-4 text-base" disabled={loading || !displayName.trim()} onClick={handleCreateMeeting}>
                  {loading ? 'Starting...' : 'Start a Meeting'}
                  <ArrowRight size={20} />
                </button>
                <div className="flex min-w-0 gap-3">
                  <input className="input-field" value={meetingId} onChange={(event) => setMeetingId(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleJoinMeeting()} placeholder="Join with code" />
                  <button className="btn-secondary shrink-0 px-5" disabled={!displayName.trim() || !meetingId.trim()} onClick={handleJoinMeeting}>
                    <Link2 size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-center gap-3 text-sm text-muted lg:justify-start">
                <div className="flex -space-x-2">
                  {['A', 'M', 'S', 'N'].map((avatar) => <div key={avatar} className="avatar-soft border-2 border-white">{avatar}</div>)}
                </div>
                <span>Trusted by 0 teams while the beta gets sharper.</span>
              </div>
            </div>

            <div className="browser-mockup">
              <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-error" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-success" />
                </div>
                <div className="pill">room/product-sync</div>
              </div>
              <div className="bg-slate-900 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {['Maya Chen', 'Sam Rivera', 'You', 'Noah Lee'].map((name, index) => (
                    <div key={name} className={`video-tile ${index === 2 ? 'speaking' : ''}`}>
                      <div className="flex h-full items-center justify-center bg-slate-800">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
                          {name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                        </div>
                      </div>
                      {name === 'You' && <div className="you-pill">You</div>}
                      <div className="tile-overlay">{name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 border-t border-border bg-white p-4">
                {[Video, Users, Zap].map((Icon, index) => (
                  <div key={index} className="control-button active min-w-14"><Icon size={18} /></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-section py-24">
          <div className="container-xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <div className="badge mb-4">FEATURES</div>
              <h2 className="h2">Everything a real meeting room needs.</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map(([featureTitle, description, Icon], index) => (
                <article key={featureTitle} className="feature-card card" style={{ transitionDelay: `${index * 60}ms` }}>
                  <div className="icon-square mb-5"><Icon size={22} /></div>
                  <h3 className="h4">{featureTitle}</h3>
                  <p className="mt-3 small leading-6">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-24">
          <div className="container-xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="h2">Three steps from idea to conversation.</h2>
            </div>
            <div className="relative grid gap-6 md:grid-cols-3">
              <div className="absolute left-[16%] right-[16%] top-8 hidden border-t border-dashed border-blue-200 md:block" />
              {steps.map(([number, stepTitle, description], index) => (
                <article key={stepTitle} className="step-card relative rounded-2xl border border-border bg-white p-7 text-center shadow-[var(--shadow-sm-blue)]" style={{ transitionDelay: `${index * 60}ms` }}>
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: 'var(--accent-gradient)' }}>{number}</div>
                  <h3 className="h4">{stepTitle}</h3>
                  <p className="mt-3 small leading-6">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section ref={statsRef} className="bg-brand-soft py-20">
          <div className="container-xl grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label} className="stat-card">
                <div className="text-4xl font-bold text-brand"><CountUp value={value} active={statsActive} />{label.includes('percent') ? '%' : ''}</div>
                <div className="mt-2 small">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="relative overflow-hidden py-24 text-white" style={{ background: 'var(--accent-gradient)' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '18px 18px' }} />
          <div className="container-xl relative z-10 text-center">
            <h2 className="h1 text-white">Start a room before the thought disappears.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/82">Beta access is free. Create a room, invite someone, and feel the difference in the first minute.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button className="btn-primary bg-white text-brand hover:bg-blue-50" onClick={handleCreateMeeting} disabled={loading || !displayName.trim()}>
                Start free
              </button>
              <button className="btn-ghost border border-white/40 text-white hover:bg-white/10">
                <CheckCircle2 size={18} />
                No credit card
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white py-8">
        <div className="container-xl flex flex-col justify-between gap-4 text-sm text-secondary md:flex-row md:items-center">
          <div><strong className="text-text">Alt+F Meet</strong> · Focused video rooms for teams that move fast.</div>
          <div className="flex gap-5">
            {navLinks.map((link) => <a key={link} className="hover:text-brand" href={`#${link.toLowerCase().replaceAll(' ', '-')}`}>{link}</a>)}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
