import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  ChevronDown,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  PanelRight,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  disconnectSocket,
  getSocket,
  initiateSocketConnection,
  joinMeeting,
  leaveMeeting,
  sendMediaState,
  sendMessage,
} from '../services/socket';
import { api } from '../services/api';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function cleanName(name) {
  const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  return trimmed || 'Guest User';
}

function initialsFor(name) {
  const parts = cleanName(name).split(' ').filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GU';
}

function colorForName(name) {
  const colors = ['#2563eb', '#0891b2', '#059669', '#7c3aed', '#c026d3', '#db2777', '#ea580c', '#4f46e5'];
  const hash = cleanName(name).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp || Date.now()));
}

function VideoTile({ participant, stream, isLocal, isSpeaking }) {
  const videoRef = useRef(null);
  const name = cleanName(participant?.name);
  const media = participant?.media || {};
  const showVideo = Boolean(stream && media.camOn !== false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`video-tile ${isSpeaking ? 'speaking' : ''}`}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-950">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-black text-white shadow-2xl"
            style={{ backgroundColor: colorForName(name) }}
          >
            {initialsFor(name)}
          </div>
        </div>
      )}

      {media.screenSharing && (
        <div className="absolute left-4 top-4 rounded-md bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white">
          Presenting
        </div>
      )}

      {!media.micOn && (
        <div className="absolute right-4 top-4 rounded-full bg-red-500/90 p-2 text-white">
          <MicOff size={16} />
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
        <span>{name}</span>
        {isLocal && <span className="text-sky-200">(You)</span>}
      </div>
    </div>
  );
}

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryName = searchParams.get('name') || localStorage.getItem('altfmeet:name') || '';
  const [userId] = useState(() => searchParams.get('userId') || `user_${Math.random().toString(36).slice(2, 10)}`);
  const [localJoinedAt] = useState(() => Date.now());

  const [preJoinName, setPreJoinName] = useState(queryName);
  const [hasJoined, setHasJoined] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [localSocketId, setLocalSocketId] = useState(null);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const [mediaState, setMediaState] = useState({ micOn: true, camOn: true, screenSharing: false });
  const [speakingIds, setSpeakingIds] = useState(new Set());

  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const peersRef = useRef(new Map());
  const participantsRef = useRef(new Map());
  const messagesRef = useRef([]);
  const isChatOpenRef = useRef(false);
  const chatScrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const audioContextRef = useRef(null);
  const analyserCleanupRef = useRef(new Map());

  const displayName = cleanName(preJoinName);

  const localParticipant = useMemo(() => ({
    socketId: localSocketId || 'local',
    id: localSocketId || 'local',
    userId,
    name: displayName,
    media: mediaState,
    joinedAt: localJoinedAt,
  }), [displayName, localJoinedAt, localSocketId, mediaState, userId]);

  const participantMap = useMemo(() => {
    const map = new Map(participants.map((participant) => [participant.socketId, participant]));
    map.set(localParticipant.socketId, localParticipant);
    return map;
  }, [participants, localParticipant]);

  useEffect(() => {
    participantsRef.current = participantMap;
  }, [participantMap]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  const visibleParticipants = useMemo(() => {
    const remote = participants
      .filter((participant) => participant.socketId !== localSocketId)
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    return [localParticipant, ...remote];
  }, [localParticipant, localSocketId, participants]);

  const gridClass = useMemo(() => {
    const count = visibleParticipants.length;
    if (count <= 1) return 'meeting-grid solo';
    if (count === 2) return 'meeting-grid two';
    if (count <= 4) return 'meeting-grid four';
    if (count <= 6) return 'meeting-grid six';
    return 'meeting-grid many';
  }, [visibleParticipants.length]);

  const setSpeaking = useCallback((id, speaking) => {
    setSpeakingIds((current) => {
      const next = new Set(current);
      if (speaking) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const monitorAudio = useCallback((id, stream) => {
    analyserCleanupRef.current.get(id)?.();
    if (!stream?.getAudioTracks().length) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const values = new Uint8Array(analyser.frequencyBinCount);
    let frameId;
    const tick = () => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      setSpeaking(id, average > 18);
      frameId = requestAnimationFrame(tick);
    };
    tick();

    analyserCleanupRef.current.set(id, () => {
      cancelAnimationFrame(frameId);
      source.disconnect();
      analyser.disconnect();
      setSpeaking(id, false);
    });
  }, [setSpeaking]);

  const cleanupPeer = useCallback((peerId) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.pc.ontrack = null;
      peer.pc.onicecandidate = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.oniceconnectionstatechange = null;
      peer.pc.close();
      peersRef.current.delete(peerId);
    }
    analyserCleanupRef.current.get(peerId)?.();
    analyserCleanupRef.current.delete(peerId);
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }, []);

  const createPeer = useCallback((peerId) => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, pendingIce: [], restarted: false };
    peersRef.current.set(peerId, peer);

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit('ICE_CANDIDATE', {
          target: peerId,
          candidate: event.candidate,
          from: getSocket()?.id,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams((current) => ({ ...current, [peerId]: stream }));
      monitorAudio(peerId, stream);
    };

    const restartOnce = async () => {
      if (peer.restarted || pc.signalingState === 'closed') return;
      peer.restarted = true;
      try {
        pc.restartIce();
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        getSocket()?.emit('OFFER', { target: peerId, sdp: pc.localDescription, from: getSocket()?.id });
      } catch (err) {
        console.error('ICE restart failed:', err);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') restartOnce();
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setSpeaking(peerId, false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') restartOnce();
    };

    return peer;
  }, [monitorAudio, setSpeaking]);

  const flushPendingIce = useCallback(async (peer) => {
    while (peer.pendingIce.length && peer.pc.remoteDescription) {
      const candidate = peer.pendingIce.shift();
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch (err) {
        console.error('Failed to add buffered ICE candidate:', err);
      }
    }
  }, []);

  const createOffer = useCallback(async (peerId) => {
    const peer = createPeer(peerId);
    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      getSocket()?.emit('OFFER', { target: peerId, sdp: peer.pc.localDescription, from: getSocket()?.id });
    } catch (err) {
      console.error('Offer failed:', err);
    }
  }, [createPeer]);

  const replaceVideoTrack = useCallback((track) => {
    peersRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
      sender?.replaceTrack(track).catch((err) => console.error('replaceTrack failed:', err));
    });
  }, []);

  const updateMedia = useCallback((nextMedia) => {
    setMediaState((current) => {
      const next = { ...current, ...nextMedia };
      sendMediaState(next);
      return next;
    });
  }, []);

  const stopAllMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    cameraTrackRef.current = null;
    screenTrackRef.current = null;
  }, []);

  const cleanupMeeting = useCallback(() => {
    leaveMeeting();
    peersRef.current.forEach((_, peerId) => cleanupPeer(peerId));
    analyserCleanupRef.current.forEach((cleanup) => cleanup());
    analyserCleanupRef.current.clear();
    stopAllMedia();
    disconnectSocket();
  }, [cleanupPeer, stopAllMedia]);

  const leaveRoom = useCallback(() => {
    cleanupMeeting();
    navigate('/');
  }, [cleanupMeeting, navigate]);

  const startMeeting = useCallback(async () => {
    const name = cleanName(preJoinName);
    let joinMedia = mediaState;
    localStorage.setItem('altfmeet:name', name);
    setHasJoined(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      monitorAudio('local', stream);
    } catch (err) {
      console.error('Media error:', err);
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (audioOnly) {
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        joinMedia = { ...joinMedia, camOn: false };
        updateMedia({ camOn: false });
        monitorAudio('local', audioOnly);
      }
    }

    const socket = initiateSocketConnection();
    socket.on('connect', () => {
      setLocalSocketId(socket.id);
      joinMeeting({
        meetingId: roomId,
        userId,
        name,
        media: joinMedia,
      });
    });

    socket.on('room:participants', ({ participants: nextParticipants }) => {
      if (Array.isArray(nextParticipants)) setParticipants(nextParticipants);
    });

    socket.on('room:existing-participants', ({ participants: existingParticipants }) => {
      existingParticipants?.forEach((participant) => {
        if (participant.socketId !== socket.id) createPeer(participant.socketId);
      });
    });

    socket.on('USER_JOINED', (participant) => {
      setParticipants((current) => {
        const withoutDuplicate = current.filter((item) => item.socketId !== participant.socketId);
        return [...withoutDuplicate, participant];
      });
      createOffer(participant.socketId);
    });

    socket.on('OFFER', async ({ from, sdp, fromName }) => {
      if (!from) return;
      const peer = createPeer(from);
      setParticipants((current) => {
        if (current.some((participant) => participant.socketId === from)) return current;
        return [...current, { socketId: from, id: from, name: cleanName(fromName), media: { micOn: true, camOn: true } }];
      });
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingIce(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit('ANSWER', { target: from, sdp: peer.pc.localDescription, from: socket.id });
      } catch (err) {
        console.error('Answer failed:', err);
      }
    });

    socket.on('ANSWER', async ({ from, sdp }) => {
      const peer = peersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingIce(peer);
      } catch (err) {
        console.error('Remote answer failed:', err);
      }
    });

    socket.on('ICE_CANDIDATE', async ({ from, candidate }) => {
      if (!from || !candidate) return;
      const peer = createPeer(from);
      const iceCandidate = new RTCIceCandidate(candidate);
      if (!peer.pc.remoteDescription) {
        peer.pendingIce.push(iceCandidate);
        return;
      }
      try {
        await peer.pc.addIceCandidate(iceCandidate);
      } catch (err) {
        console.error('ICE candidate failed:', err);
      }
    });

    socket.on('USER_LEFT', ({ socketId }) => {
      cleanupPeer(socketId);
      setParticipants((current) => current.filter((participant) => participant.socketId !== socketId));
    });

    socket.on('participant:media-state', ({ socketId, media }) => {
      setParticipants((current) => current.map((participant) => (
        participant.socketId === socketId
          ? { ...participant, media: { ...participant.media, ...media } }
          : participant
      )));
    });

    socket.on('CHAT_HISTORY', (history) => {
      if (Array.isArray(history)) {
        messagesRef.current = history;
        setMessages(history);
      }
    });

    socket.on('CHAT_MESSAGE', (message) => {
      messagesRef.current = [...messagesRef.current, message];
      setMessages(messagesRef.current);
      if (!isChatOpenRef.current) setUnreadCount((count) => count + 1);
      if (!isNearBottomRef.current) setShowNewMessageButton(true);
    });
  }, [
    cleanupPeer,
    createOffer,
    createPeer,
    flushPendingIce,
    mediaState,
    monitorAudio,
    preJoinName,
    roomId,
    updateMedia,
    userId,
  ]);

  useEffect(() => {
    api.getMeetingDetails(roomId).then((res) => {
      if (res.success) setMeetingDetails(res.data);
    }).catch((err) => console.error('Meeting details failed:', err));
  }, [roomId]);

  useEffect(() => {
    return cleanupMeeting;
  }, [cleanupMeeting]);

  useEffect(() => {
    if (isNearBottomRef.current && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  const handleChatScroll = () => {
    const element = chatScrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessageButton(false);
  };

  const handleSendMessage = (event) => {
    event.preventDefault();
    const content = newMessage.trim();
    if (!content) return;
    sendMessage({ meetingId: roomId, content });
    setNewMessage('');
  };

  const toggleMic = () => {
    const nextMicOn = !mediaState.micOn;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextMicOn;
    });
    updateMedia({ micOn: nextMicOn });
  };

  const toggleCamera = async () => {
    if (mediaState.camOn) {
      const track = cameraTrackRef.current;
      if (track) {
        localStreamRef.current?.removeTrack(track);
        track.stop();
        setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      }
      cameraTrackRef.current = null;
      updateMedia({ camOn: false });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const [track] = stream.getVideoTracks();
      if (!track) return;
      cameraTrackRef.current = track;
      localStreamRef.current?.addTrack(track);
      setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      replaceVideoTrack(track);
      updateMedia({ camOn: true });
    } catch (err) {
      console.error('Camera restart failed:', err);
    }
  };

  const toggleScreenShare = async () => {
    if (mediaState.screenSharing) {
      screenTrackRef.current?.stop();
      const cameraTrack = cameraTrackRef.current || localStreamRef.current?.getVideoTracks()[0] || null;
      if (cameraTrack) replaceVideoTrack(cameraTrack);
      updateMedia({ screenSharing: false, camOn: Boolean(cameraTrack) });
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [screenTrack] = screenStream.getVideoTracks();
      screenTrackRef.current = screenTrack;
      replaceVideoTrack(screenTrack);
      updateMedia({ screenSharing: true, camOn: true });
      screenTrack.onended = () => {
        const cameraTrack = cameraTrackRef.current || localStreamRef.current?.getVideoTracks()[0] || null;
        if (cameraTrack) replaceVideoTrack(cameraTrack);
        updateMedia({ screenSharing: false, camOn: Boolean(cameraTrack) });
      };
    } catch (err) {
      console.error('Screen share failed:', err);
    }
  };

  const scrollToLatest = () => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    isNearBottomRef.current = true;
    setShowNewMessageButton(false);
  };

  const renderMessages = () => messages.map((msg, index) => {
    const previous = messages[index - 1];
    const sameSender = previous?.senderId === msg.senderId;
    const withinMinute = previous && Math.abs((msg.timestamp || 0) - (previous.timestamp || 0)) < 60000;
    const grouped = sameSender && withinMinute;
    const mine = msg.senderId === localSocketId;
    return (
      <div key={msg.id || index} className={`chat-row ${mine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}>
        {!grouped && (
          <div className="chat-sender">{mine ? 'You' : cleanName(msg.senderName)}</div>
        )}
        <div className="chat-bubble">{msg.content}</div>
        <div className="chat-time">{formatTime(msg.timestamp)}</div>
      </div>
    );
  });

  if (!hasJoined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-dark-surface p-6 shadow-2xl">
          <h1 className="text-2xl font-black">Join meeting</h1>
          <p className="mt-2 text-sm text-slate-400">{roomId}</p>
          <label className="mt-6 block text-sm font-semibold text-slate-300">Your name</label>
          <input
            className="input-field mt-2"
            value={preJoinName}
            onChange={(event) => setPreJoinName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && preJoinName.trim()) startMeeting();
            }}
            autoFocus
          />
          <button
            className="btn-primary mt-6 w-full"
            disabled={!preJoinName.trim()}
            onClick={startMeeting}
          >
            Join now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg text-white">
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{meetingDetails?.title || 'Meeting Room'}</h2>
            <p className="truncate text-xs text-slate-400">{roomId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`toolbar-button ${isParticipantsOpen ? 'active' : ''}`}
              onClick={() => setIsParticipantsOpen((open) => !open)}
              title="Participants"
            >
              <Users size={18} />
              <span>{visibleParticipants.length}</span>
            </button>
            <button
              className={`toolbar-button ${isChatOpen ? 'active' : ''}`}
              onClick={() => {
                setIsChatOpen((open) => !open);
                setUnreadCount(0);
              }}
              title="Chat"
            >
              <MessageCircle size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
          </div>
        </header>

        <section className={gridClass}>
          {visibleParticipants.map((participant) => (
            <VideoTile
              key={participant.socketId}
              participant={participant}
              isLocal={participant.socketId === localParticipant.socketId}
              isSpeaking={
                participant.socketId === localParticipant.socketId
                  ? speakingIds.has('local')
                  : speakingIds.has(participant.socketId)
              }
              stream={participant.socketId === localParticipant.socketId ? localStream : remoteStreams[participant.socketId]}
            />
          ))}
        </section>

        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 shadow-2xl backdrop-blur">
            <button className={`control-button ${!mediaState.micOn ? 'danger active' : ''}`} onClick={toggleMic} title="Microphone">
              {mediaState.micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button className={`control-button ${!mediaState.camOn ? 'danger active' : ''}`} onClick={toggleCamera} title="Camera">
              {mediaState.camOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>
            <button className={`control-button ${mediaState.screenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title="Screen share">
              <MonitorUp size={20} />
            </button>
            <button className="control-button" onClick={() => setIsParticipantsOpen((open) => !open)} title="Participants">
              <PanelRight size={20} />
            </button>
            <button className="control-button leave" onClick={leaveRoom} title="Leave meeting">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </main>

      {isParticipantsOpen && (
        <aside className="side-panel w-80">
          <div className="panel-header">
            <h3>Participants</h3>
            <button onClick={() => setIsParticipantsOpen(false)}><X size={18} /></button>
          </div>
          <div className="space-y-2 p-4">
            {visibleParticipants.map((participant) => {
              const isLocal = participant.socketId === localParticipant.socketId;
              return (
                <div key={participant.socketId} className="participant-row">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                    style={{ backgroundColor: colorForName(participant.name) }}
                  >
                    {initialsFor(participant.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{cleanName(participant.name)} {isLocal && <span className="text-slate-400">(You)</span>}</p>
                  </div>
                  {participant.media?.micOn === false ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-slate-400" />}
                  {participant.media?.camOn === false ? <CameraOff size={16} className="text-red-400" /> : <Camera size={16} className="text-slate-400" />}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {isChatOpen && (
        <aside className="side-panel w-96">
          <div className="panel-header">
            <h3>Chat</h3>
            <button onClick={() => setIsChatOpen(false)}><X size={18} /></button>
          </div>
          <div ref={chatScrollRef} onScroll={handleChatScroll} className="relative flex-1 overflow-y-auto p-4">
            <div className="space-y-2">{renderMessages()}</div>
            {showNewMessageButton && (
              <button className="new-message-button" onClick={scrollToLatest}>
                New message <ChevronDown size={16} />
              </button>
            )}
          </div>
          <form onSubmit={handleSendMessage} className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Message everyone"
                className="input-field"
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
              />
              <button type="submit" className="control-button active" title="Send">
                <Send size={18} />
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  );
};

export default Room;
