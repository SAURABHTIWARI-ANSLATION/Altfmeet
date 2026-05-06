import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { auth } from '../services/firebase';
import { signInAnonymously } from 'firebase/auth';

const Landing = () => {
  const [meetingId, setMeetingId] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Production Security: Ensure user is authenticated before interacting with Firestore
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));
  }, []);

  const handleCreateMeeting = async () => {
    setLoading(true);
    try {
      const userId = `user_${Math.random().toString(36).substr(2, 9)}`;
      const res = await api.createMeeting(userId, title || "New Meeting");
      if (res.meetingId) {
        navigate(`/room/${res.meetingId}?userId=${userId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create meeting");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = () => {
    if (!meetingId) return alert("Please enter a Meeting ID");
    const userId = `user_${Math.random().toString(36).substr(2, 9)}`;
    navigate(`/room/${meetingId}?userId=${userId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-radial-[at_50%_50%,_var(--color-dark-surface)_0%,_var(--color-dark-bg)_100%]">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary animate-gradient">
            Alt+F Meet
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Experience the next generation of seamless, secure, and ultra-fast video conferencing. 
            Connect with anyone, anywhere, in high fidelity.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Create Meeting */}
          <div className="glass p-8 rounded-3xl space-y-6 text-left">
            <h2 className="text-2xl font-bold">Start a Meeting</h2>
            <p className="text-slate-400">Create a new room and invite others with a single click.</p>
            <input 
              type="text" 
              placeholder="Meeting Title (Optional)"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button 
              onClick={handleCreateMeeting}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? "Creating..." : "Create New Meeting"}
            </button>
          </div>

          {/* Join Meeting */}
          <div className="glass p-8 rounded-3xl space-y-6 text-left">
            <h2 className="text-2xl font-bold">Join a Meeting</h2>
            <p className="text-slate-400">Enter a meeting code or link to join an existing session.</p>
            <input 
              type="text" 
              placeholder="Enter Meeting ID"
              className="input-field"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
            />
            <button 
              onClick={handleJoinMeeting}
              className="btn-secondary w-full"
            >
              Join Meeting
            </button>
          </div>
        </div>

        <div className="pt-12 text-slate-500 text-sm">
          Trusted by teams at Alt+F Labs
        </div>
      </div>
    </div>
  );
};

export default Landing;
