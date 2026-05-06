import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { initiateSocketConnection, disconnectSocket, joinMeeting, subscribeToParticipants } from '../services/socket';
import { api } from '../services/api';
import { chatService } from '../services/chat.firebase';

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const localVideoRef = useRef(null);

  useEffect(() => {
    if (!roomId || !userId) {
      navigate('/');
      return;
    }

    // Fetch meeting details
    api.getMeetingDetails(roomId).then(res => {
      if (res.success) setMeetingDetails(res.data);
    });

    // Setup Socket (for signaling and participants)
    initiateSocketConnection(roomId, userId);
    joinMeeting(roomId, userId);

    // Subscribe to Firebase Chat
    const unsubscribeChat = chatService.subscribeToMessages(roomId, (msgs) => {
      setMessages(msgs);
    });

    subscribeToParticipants((err, data) => {
      if (data) setParticipants(data);
    });

    // Local Media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error("Media error:", err));

    return () => {
      disconnectSocket();
      unsubscribeChat();
    };
  }, [roomId, userId, navigate]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await chatService.sendMessage(roomId, userId, newMessage);
    setNewMessage('');
  };

  return (
    <div className="h-screen bg-dark-bg flex overflow-hidden">
      {/* Main Video Area */}
      <div className="flex-grow flex flex-col relative">
        {/* Header */}
        <div className="p-4 flex justify-between items-center glass m-4 rounded-2xl absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 animate-pulse rounded-full"></div>
            <h2 className="font-bold">{meetingDetails?.title || 'Meeting Room'}</h2>
            <span className="text-sm text-slate-400">| {roomId}</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex -space-x-2">
                {participants.slice(0, 3).map((p, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-primary border-2 border-dark-bg flex items-center justify-center text-xs font-bold uppercase">
                    {p[0]}
                  </div>
                ))}
                {participants.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-dark-surface border-2 border-dark-bg flex items-center justify-center text-xs text-slate-400">
                    +{participants.length - 3}
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-grow p-4 mt-20 mb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Local User */}
          <div className="relative rounded-3xl overflow-hidden bg-dark-surface group aspect-video">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 glass px-3 py-1 rounded-lg text-sm">
              You (Host)
            </div>
          </div>

          {/* Participant Placeholders */}
          {participants.filter(p => p !== userId).map((p, i) => (
            <div key={i} className="relative rounded-3xl overflow-hidden bg-dark-surface flex items-center justify-center aspect-video border border-dark-border">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-3xl font-bold uppercase text-slate-500">
                {p[0]}
              </div>
              <div className="absolute bottom-4 left-4 glass px-3 py-1 rounded-lg text-sm">
                {p}
              </div>
            </div>
          ))}
        </div>

        {/* Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center items-center pointer-events-none">
          <div className="glass px-8 py-4 rounded-3xl flex items-center gap-6 pointer-events-auto">
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-dark-surface hover:bg-dark-border text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
            >
              {isMicOn ? 'Mute' : 'Unmute'}
            </button>
            <button 
              onClick={() => setIsCamOn(!isCamOn)}
              className={`p-4 rounded-2xl transition-all ${isCamOn ? 'bg-dark-surface hover:bg-dark-border text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
            >
              {isCamOn ? 'Cam Off' : 'Cam On'}
            </button>
            <button 
              onClick={() => navigate('/')}
              className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white px-8"
            >
              Leave
            </button>
            <div className="w-px h-8 bg-dark-border"></div>
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-4 rounded-2xl transition-all ${isChatOpen ? 'bg-primary text-white' : 'bg-dark-surface hover:bg-dark-border text-white'}`}
            >
              Chat
            </button>
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      {isChatOpen && (
        <div className="w-96 glass border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-bottom border-white/10 flex justify-between items-center">
            <h3 className="text-xl font-bold">Chat</h3>
            <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.userId === userId ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-500 mb-1 px-2">{msg.userId === userId ? 'You' : msg.userId}</span>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.userId === userId 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-dark-accent text-slate-200 rounded-tl-none'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="p-6 border-top border-white/10">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type a message..."
                className="input-field"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="btn-primary p-3">Send</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Room;
