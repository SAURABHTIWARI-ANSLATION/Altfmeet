import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, Link2, Lock, Radio, Sparkles, Users, Video, Zap } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { api } from '../services/api';
import { auth } from '../services/firebase';

const features = [
  {
    icon: Video,
    title: 'Live video that feels immediate',
    description: 'Peer-to-peer rooms keep calls direct, responsive, and clear for fast-moving teams.',
  },
  {
    icon: Users,
    title: 'Identity-first meetings',
    description: 'Names, avatars, mute state, camera state, and presence stay visible across the room.',
  },
  {
    icon: Radio,
    title: 'Built for real-time flow',
    description: 'Socket-powered signaling, chat, and participant updates keep everyone in sync.',
  },
  {
    icon: Lock,
    title: 'No heavy setup',
    description: 'Create a room, share the invite, and start talking with a clean browser experience.',
  },
];

const steps = [
  ['01', 'Enter your name', 'Your meeting identity appears everywhere it matters.'],
  ['02', 'Share the link', 'Copy the room invite and bring people in instantly.'],
  ['03', 'Talk', 'Video, chat, presence, and controls stay one click away.'],
];

const Landing = () => {
  const [meetingId, setMeetingId] = useState('');
  const [title, setTitle] = useState('');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('altfmeet:name') || '');
  const [loading, setLoading] = useState(false);
  const featuresRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    signInAnonymously(auth).catch((err) => console.error('Auth error:', err));
  }, []);

  useEffect(() => {
    const cards = Array.from(featuresRef.current?.querySelectorAll('.feature-card') || []);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    cards.forEach((card) => observer.observe(card));
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

  return (
    <div className="app-shell overflow-hidden">
      <section className="relative min-h-screen">
        <div className="mesh-bg" />
        <div className="noise-layer" />
        <div className="container-xl relative z-10 flex min-h-screen flex-col">
          <header className="flex items-center justify-between py-6">
            <div className="wordmark">
              <div className="logo-mark">A</div>
              <span>Alt+F Meet</span>
            </div>
            <a className="btn-ghost hidden sm:inline-flex" href="https://github.com/SAURABHTIWARI-ANSLATION/Altfmeet" target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              GitHub
            </a>
          </header>

          <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="max-w-3xl">
              <div className="eyebrow mb-6">
                <Sparkles size={14} />
                Production-grade meeting rooms
              </div>
              <h1 className="h1">Video meetings that stay sharp, named, and in sync.</h1>
              <p className="body-lg mt-6 max-w-2xl">
                Alt+F Meet gives teams a polished real-time room with video, chat, participant presence, and meeting controls that feel effortless from the first click.
              </p>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr]">
                <div>
                  <label className="floating-label mb-2 block">Your name</label>
                  <input
                    className="input-field"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Ada Lovelace"
                  />
                </div>
                <div>
                  <label className="floating-label mb-2 block">Meeting title</label>
                  <input
                    className="input-field"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Weekly sync"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button className="btn-primary" disabled={loading || !displayName.trim()} onClick={handleCreateMeeting}>
                  {loading ? 'Starting...' : 'Start a Meeting'}
                  <ArrowRight size={18} />
                </button>
                <div className="flex min-w-0 flex-1 gap-3">
                  <input
                    className="input-field"
                    value={meetingId}
                    onChange={(event) => setMeetingId(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleJoinMeeting();
                    }}
                    placeholder="Join with code"
                  />
                  <button className="btn-secondary shrink-0" disabled={!displayName.trim() || !meetingId.trim()} onClick={handleJoinMeeting}>
                    <Link2 size={18} />
                    <span className="hidden sm:inline">Join</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mock-window">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-danger" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-success" />
                </div>
                <div className="pill">room/focused-sync</div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {['Maya Chen', 'Sam Rivera', 'You', 'Noah Lee'].map((name, index) => (
                  <div key={name} className={`video-tile min-h-36 ${index === 2 ? 'speaking' : ''}`}>
                    <div className="flex h-full items-center justify-center bg-app-surface-2">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-black text-black">
                        {name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                      </div>
                    </div>
                    <div className="tile-overlay">
                      {name}
                      {name === 'You' && <span className="text-primary">You</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3 border-t border-white/10 p-4">
                {[Video, Users, Zap].map((Icon, index) => (
                  <div key={index} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-primary">
                    <Icon size={18} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={featuresRef} className="container-xl py-20">
        <div className="mb-10 max-w-2xl">
          <div className="eyebrow mb-4">Why teams use it</div>
          <h2 className="h2">Everything visible, nothing in the way.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title: featureTitle, description }, index) => (
            <article key={featureTitle} className="feature-card" style={{ transitionDelay: `${index * 90}ms` }}>
              <div className="feature-icon"><Icon size={22} /></div>
              <h3 className="h3">{featureTitle}</h3>
              <p className="mt-3 text-sm leading-6 text-app-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-xl pb-20">
        <div className="surface rounded-2xl p-6 sm:p-8">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="eyebrow mb-4">How it works</div>
              <h2 className="h2">Start, share, talk.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-app-muted">The fastest meeting flow is the one nobody has to explain.</p>
          </div>
          <div className="relative grid gap-5 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-7 hidden border-t border-dashed border-white/15 md:block" />
            {steps.map(([number, stepTitle, description]) => (
              <div key={stepTitle} className="relative rounded-2xl border border-white/10 bg-app-surface-2 p-5">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary-soft text-sm font-black text-primary">{number}</div>
                <h3 className="h3">{stepTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-app-muted">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="container-xl flex flex-col justify-between gap-3 text-sm text-app-muted sm:flex-row">
          <span className="font-bold text-app-text">Alt+F Meet</span>
          <span>Focused video rooms for teams that move fast.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
