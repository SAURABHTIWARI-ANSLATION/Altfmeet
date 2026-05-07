import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  ChevronDown,
  Check,
  Activity,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  Copy,
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
import { SfuSession } from '../services/sfu';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const SFU_ENABLED = import.meta.env.VITE_ENABLE_SFU === 'true';

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  latency: { ideal: 0.02 },
};

const CAMERA_CONSTRAINTS = {
  width: { ideal: 640, max: 960 },
  height: { ideal: 360, max: 540 },
  frameRate: { ideal: 20, max: 24 },
};

const SCREEN_CONSTRAINTS = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 12, max: 15 },
};

const QUALITY_LABELS = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  reconnecting: 'Reconnecting',
};

const qualityForStats = ({ rtt = 0, jitter = 0, packetLoss = 0 } = {}) => {
  if (packetLoss > 8 || rtt > 650 || jitter > 80) return 'poor';
  if (packetLoss > 3 || rtt > 300 || jitter > 35) return 'fair';
  return 'good';
};

const qualityModeFor = (participantCount, networkQuality) => {
  if (networkQuality === 'poor' || participantCount >= 14) return 'audio-first';
  if (networkQuality === 'fair' || participantCount >= 8) return 'low';
  if (participantCount >= 5) return 'medium';
  return 'high';
};

const bitrateFor = (kind, mode, screenSharing = false) => {
  if (kind === 'audio') return 32000;
  if (screenSharing) {
    if (mode === 'audio-first') return 650000;
    if (mode === 'low') return 900000;
    return 1400000;
  }
  if (mode === 'audio-first') return 90000;
  if (mode === 'low') return 160000;
  if (mode === 'medium') return 280000;
  return 450000;
};

const clampTrack = async (track, constraints) => {
  try {
    await track?.applyConstraints?.(constraints);
  } catch (err) {
    console.warn('Track constraints could not be applied:', err);
  }
};

function cleanName(name) {
  const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  return trimmed || 'Guest User';
}

function initialsFor(name) {
  const parts = cleanName(name).split(' ').filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'GU';
}

function colorForName(name) {
  const colors = ['#2563eb', '#1d4ed8', '#3b82f6', '#1e40af', '#7c3aed', '#0ea5e9', '#0284c7', '#4338ca'];
  const hash = cleanName(name).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp || Date.now()));
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function VideoTile({ participant, stream, isLocal, isSpeaking }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const name = cleanName(participant?.name);
  const media = participant?.media || {};
  const audioTrackCount = stream?.getAudioTracks?.().length || 0;
  const videoTrackCount = stream?.getVideoTracks?.().length || 0;
  const showVideo = Boolean(videoTrackCount && media.camOn !== false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play?.().catch(() => {});
    }
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
      audioRef.current.play?.().catch(() => {});
    }
  }, [audioTrackCount, isLocal, stream, videoTrackCount]);

  return (
    <div className={`video-tile ${isSpeaking ? 'speaking' : ''}`}>
      {!isLocal && audioTrackCount > 0 && (
        <audio ref={audioRef} autoPlay playsInline />
      )}

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-black text-white shadow-2xl"
            style={{ backgroundColor: colorForName(name) }}
          >
            {initialsFor(name)}
          </div>
        </div>
      )}

      {media.screenSharing && (
        <div className="absolute left-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          Presenting
        </div>
      )}

      {!media.micOn && (
        <div className="tile-status">
          <MicOff size={16} />
        </div>
      )}

      {isLocal && <div className="you-pill">You</div>}

      <div className="tile-overlay">
        <span>{name}</span>
      </div>
    </div>
  );
}

const tileStreamFor = (participant, localParticipant, localStream, remoteStreams) => (
  participant.socketId === localParticipant.socketId ? localStream : remoteStreams[participant.socketId]
);

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
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [connectionError, setConnectionError] = useState('');
  const [networkQuality, setNetworkQuality] = useState('good');
  const [qualityMode, setQualityMode] = useState('high');
  const [mediaStats, setMediaStats] = useState({ rtt: 0, jitter: 0, packetLoss: 0, bitrate: 0, droppedFrames: 0 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);

  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const peersRef = useRef(new Map());
  const sfuSessionRef = useRef(null);
  const remoteTracksRef = useRef(new Map());
  const participantsRef = useRef(new Map());
  const messagesRef = useRef([]);
  const isChatOpenRef = useRef(false);
  const chatScrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const audioContextRef = useRef(null);
  const analyserCleanupRef = useRef(new Map());
  const controlsTimerRef = useRef(null);
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);
  const statsSnapshotRef = useRef(new Map());
  const participantCountRef = useRef(1);
  const qualityModeRef = useRef('high');

  const displayName = cleanName(preJoinName);
  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  const addToast = useCallback((message, tone = 'default') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, message, tone }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

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

  const presentingParticipant = useMemo(() => (
    visibleParticipants.find((participant) => participant.media?.screenSharing) || null
  ), [visibleParticipants]);

  const filmstripParticipants = useMemo(() => {
    if (!presentingParticipant) return [];
    return visibleParticipants.filter((participant) => participant.socketId !== presentingParticipant.socketId);
  }, [presentingParticipant, visibleParticipants]);

  useEffect(() => {
    participantCountRef.current = visibleParticipants.length;
    const nextMode = qualityModeFor(visibleParticipants.length, networkQuality);
    qualityModeRef.current = nextMode;
    setQualityMode(nextMode);
  }, [networkQuality, visibleParticipants.length]);

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
    if (id !== 'local' && participantCountRef.current > 8) return;

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

  const configureSender = useCallback(async (sender, screenSharing = false) => {
    if (!sender?.track) return;
    const params = sender.getParameters();
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    params.encodings[0].maxBitrate = bitrateFor(sender.track.kind, qualityModeRef.current, screenSharing);
    params.degradationPreference = screenSharing ? 'maintain-resolution' : 'maintain-framerate';
    if (sender.track.kind === 'audio') {
      params.encodings[0].priority = 'high';
      params.encodings[0].networkPriority = 'high';
    }
    try {
      await sender.setParameters(params);
    } catch (err) {
      console.warn('Sender parameters could not be applied:', err);
    }
  }, []);

  const tunePeerSenders = useCallback(() => {
    peersRef.current.forEach(({ pc }) => {
      pc.getSenders().forEach((sender) => {
        configureSender(sender, sender.track?.id === screenTrackRef.current?.id);
      });
    });
  }, [configureSender]);

  useEffect(() => {
    tunePeerSenders();
  }, [qualityMode, tunePeerSenders]);

  const attachRemoteTrack = useCallback(({ socketId, source, kind, track }) => {
    if (!socketId || !track) return;
    const tracks = remoteTracksRef.current.get(socketId) || {};
    tracks[source || kind] = track;
    remoteTracksRef.current.set(socketId, tracks);

    const stream = new MediaStream();
    const videoTrack = tracks.screen || tracks.video;
    if (videoTrack) stream.addTrack(videoTrack);
    if (tracks.audio) stream.addTrack(tracks.audio);
    setRemoteStreams((current) => ({ ...current, [socketId]: stream }));

    if (kind === 'audio') {
      setTimeout(() => {
        setRemoteStreams((current) => {
          const stream = current[socketId];
          if (stream) monitorAudio(socketId, stream);
          return current;
        });
      }, 0);
    }
    if (source === 'screen') {
      setParticipants((current) => current.map((participant) => (
        participant.socketId === socketId
          ? { ...participant, media: { ...participant.media, screenSharing: true, camOn: true } }
          : participant
      )));
    }
  }, [monitorAudio]);

  const removeRemoteProducer = useCallback(({ socketId, source } = {}) => {
    if (!socketId) return;
    const tracks = remoteTracksRef.current.get(socketId);
    if (source && tracks) {
      delete tracks[source];
      const stream = new MediaStream();
      const videoTrack = tracks.screen || tracks.video;
      if (videoTrack) stream.addTrack(videoTrack);
      if (tracks.audio) stream.addTrack(tracks.audio);
      remoteTracksRef.current.set(socketId, tracks);
      setRemoteStreams((current) => {
        const next = { ...current };
        if (stream.getTracks().length) next[socketId] = stream;
        else delete next[socketId];
        return next;
      });
    }
    if (source === 'screen') {
      setParticipants((current) => current.map((participant) => (
        participant.socketId === socketId
          ? { ...participant, media: { ...participant.media, screenSharing: false } }
          : participant
      )));
      return;
    }
    if (!source) {
      analyserCleanupRef.current.get(socketId)?.();
      analyserCleanupRef.current.delete(socketId);
      remoteTracksRef.current.delete(socketId);
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    }
  }, []);

  const initializeSfu = useCallback(async (stream) => {
    if (sfuSessionRef.current) return;
    const session = new SfuSession({
      roomId,
      onTrack: attachRemoteTrack,
      onProducerClosed: removeRemoteProducer,
      maxCameraConsumers: window.matchMedia('(max-width: 768px)').matches ? 4 : 12,
    });
    sfuSessionRef.current = session;
    await session.init();

    const audioTrack = stream?.getAudioTracks()[0];
    const videoTrack = stream?.getVideoTracks()[0];
    if (audioTrack) await session.publishTrack(audioTrack, 'audio');
    if (videoTrack) await session.publishTrack(videoTrack, 'video');
    await session.consumeExistingProducers();
  }, [attachRemoteTrack, removeRemoteProducer, roomId]);

  const startPreview = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: CAMERA_CONSTRAINTS,
        audio: AUDIO_CONSTRAINTS,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      await clampTrack(cameraTrackRef.current, CAMERA_CONSTRAINTS);
      await clampTrack(stream.getAudioTracks()[0], AUDIO_CONSTRAINTS);
      monitorAudio('local', stream);
      return stream;
    } catch (err) {
      console.error('Preview media error:', err);
      setConnectionError('Camera or microphone access was blocked. You can retry after allowing permissions.');
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        setMediaState((current) => ({ ...current, camOn: false }));
        await clampTrack(audioOnly.getAudioTracks()[0], AUDIO_CONSTRAINTS);
        monitorAudio('local', audioOnly);
        return audioOnly;
      } catch (audioErr) {
        console.error('Audio fallback failed:', audioErr);
        return null;
      }
    }
  }, [monitorAudio]);

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

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 4,
    });
    const peer = { pc, pendingIce: [], restarted: false, videoSender: null };
    peersRef.current.set(peerId, peer);

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStreamRef.current);
      configureSender(sender, false);
    });

    const outgoingVideoTrack = screenTrackRef.current || cameraTrackRef.current;
    if (outgoingVideoTrack) {
      const sender = pc.addTrack(outgoingVideoTrack, localStreamRef.current || new MediaStream([outgoingVideoTrack]));
      peer.videoSender = sender;
      configureSender(sender, outgoingVideoTrack.id === screenTrackRef.current?.id);
    }

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
      const nextStream = new MediaStream(stream.getTracks());
      setRemoteStreams((current) => ({ ...current, [peerId]: nextStream }));
      monitorAudio(peerId, nextStream);
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
      if (pc.connectionState === 'connected') setConnectionStatus('connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setNetworkQuality('reconnecting');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') restartOnce();
    };

    return peer;
  }, [configureSender, monitorAudio, setSpeaking]);

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
    peersRef.current.forEach((peer, peerId) => {
      const { pc } = peer;
      const sender = peer.videoSender || pc.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) {
        peer.videoSender = sender;
        sender.replaceTrack(track)
          .then(() => configureSender(sender, track?.id === screenTrackRef.current?.id))
          .catch((err) => console.error('replaceTrack failed:', err));
        return;
      }

      if (!track) return;
      const nextSender = pc.addTrack(track, localStreamRef.current || new MediaStream([track]));
      peer.videoSender = nextSender;
      configureSender(nextSender, track.id === screenTrackRef.current?.id);
      createOffer(peerId);
    });
  }, [configureSender, createOffer]);

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
    sfuSessionRef.current?.close();
    sfuSessionRef.current = null;
    peersRef.current.forEach((_, peerId) => cleanupPeer(peerId));
    analyserCleanupRef.current.forEach((cleanup) => cleanup());
    analyserCleanupRef.current.clear();
    remoteTracksRef.current.clear();
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
    setConnectionStatus('connecting');
    setConnectionError('');
    setHasJoined(true);

    try {
      const iceConfig = await api.getIceServers();
      if (Array.isArray(iceConfig?.iceServers) && iceConfig.iceServers.length) {
        iceServersRef.current = iceConfig.iceServers;
      }
    } catch (err) {
      console.warn('Using fallback ICE servers:', err);
      iceServersRef.current = DEFAULT_ICE_SERVERS;
    }

    const stream = localStreamRef.current || await startPreview();
    if (!stream?.getVideoTracks().length) {
      joinMedia = { ...joinMedia, camOn: false };
    }

    const socket = initiateSocketConnection();
    let sfuStarted = false;
    socket.off('connect');
    socket.off('connect_error');
    socket.off('room:participants');
    socket.off('room:existing-participants');
    socket.off('USER_JOINED');
    socket.off('OFFER');
    socket.off('ANSWER');
    socket.off('ICE_CANDIDATE');
    socket.off('USER_LEFT');
    socket.off('participant:media-state');
    socket.off('CHAT_HISTORY');
    socket.off('CHAT_MESSAGE');

    const emitJoin = () => {
      setConnectionStatus('connected');
      setLocalSocketId(socket.id);
      joinMeeting({
        meetingId: roomId,
        userId,
        name,
        media: joinMedia,
      });
      if (SFU_ENABLED && !sfuStarted) {
        sfuStarted = true;
        initializeSfu(stream).catch((err) => {
          console.error('SFU initialization failed:', err);
          setConnectionStatus('error');
          setConnectionError('Media server connection failed. Please retry the meeting.');
        });
      }
    };

    socket.on('connect', () => {
      emitJoin();
    });

    socket.on('connect_error', () => {
      setConnectionStatus('error');
      setConnectionError('Could not connect to the meeting server. Check that the backend is running and try again.');
    });

    if (socket.connected) emitJoin();

    socket.on('room:participants', ({ participants: nextParticipants }) => {
      if (Array.isArray(nextParticipants)) setParticipants(nextParticipants);
    });

    socket.on('room:existing-participants', ({ participants: existingParticipants }) => {
      if (Array.isArray(existingParticipants)) {
        setParticipants((current) => {
          const byId = new Map(current.map((participant) => [participant.socketId, participant]));
          existingParticipants.forEach((participant) => byId.set(participant.socketId, participant));
          return Array.from(byId.values());
        });
        if (!SFU_ENABLED) {
          existingParticipants.forEach((participant) => {
            if (participant.socketId !== socket.id) createPeer(participant.socketId);
          });
        }
      }
    });

    socket.on('USER_JOINED', (participant) => {
      addToast(`${cleanName(participant.name)} joined`, 'success');
      setParticipants((current) => {
        const withoutDuplicate = current.filter((item) => item.socketId !== participant.socketId);
        return [...withoutDuplicate, participant];
      });
      if (!SFU_ENABLED) createOffer(participant.socketId);
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
      const leavingName = cleanName(participantsRef.current.get(socketId)?.name);
      addToast(`${leavingName} left`, 'default');
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
    addToast,
    createOffer,
    createPeer,
    flushPendingIce,
    initializeSfu,
    mediaState,
    preJoinName,
    roomId,
    startPreview,
    userId,
  ]);

  useEffect(() => {
    api.getMeetingDetails(roomId).then((res) => {
      if (res.success) setMeetingDetails(res.data);
    }).catch((err) => console.error('Meeting details failed:', err));
  }, [roomId]);

  useEffect(() => {
    if (hasJoined) return undefined;
    const previewTimer = window.setTimeout(() => {
      startPreview();
    }, 0);
    return () => window.clearTimeout(previewTimer);
  }, [hasJoined, startPreview]);

  useEffect(() => {
    return cleanupMeeting;
  }, [cleanupMeeting]);

  useEffect(() => {
    if (!hasJoined) return undefined;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasJoined]);

  useEffect(() => {
    if (!hasJoined) return undefined;

    const collectStats = async () => {
      let outboundBytes = 0;
      let inboundPacketsLost = 0;
      let inboundPackets = 0;
      let jitterTotal = 0;
      let jitterSamples = 0;
      let rttTotal = 0;
      let rttSamples = 0;
      let droppedFrames = 0;
      const now = performance.now();

      await Promise.all(Array.from(peersRef.current.values()).map(async ({ pc }) => {
        if (pc.connectionState === 'closed') return;
        const report = await pc.getStats();
        report.forEach((stat) => {
          if (stat.type === 'outbound-rtp' && !stat.isRemote) {
            outboundBytes += stat.bytesSent || 0;
            droppedFrames += stat.framesDropped || 0;
          }
          if (stat.type === 'inbound-rtp' && !stat.isRemote) {
            inboundPacketsLost += Math.max(0, stat.packetsLost || 0);
            inboundPackets += Math.max(0, stat.packetsReceived || 0) + Math.max(0, stat.packetsLost || 0);
            if (typeof stat.jitter === 'number') {
              jitterTotal += stat.jitter * 1000;
              jitterSamples += 1;
            }
            droppedFrames += stat.framesDropped || 0;
          }
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated && typeof stat.currentRoundTripTime === 'number') {
            rttTotal += stat.currentRoundTripTime * 1000;
            rttSamples += 1;
          }
        });
      }));

      const previous = statsSnapshotRef.current.get('room');
      const bitrate = previous
        ? Math.max(0, ((outboundBytes - previous.bytes) * 8) / ((now - previous.at) / 1000))
        : 0;
      statsSnapshotRef.current.set('room', { bytes: outboundBytes, at: now });

      const packetLoss = inboundPackets > 0 ? (inboundPacketsLost / inboundPackets) * 100 : 0;
      const nextStats = {
        rtt: rttSamples ? Math.round(rttTotal / rttSamples) : 0,
        jitter: jitterSamples ? Math.round(jitterTotal / jitterSamples) : 0,
        packetLoss: Number(packetLoss.toFixed(1)),
        bitrate: Math.round(bitrate / 1000),
        droppedFrames,
      };
      setMediaStats(nextStats);

      const nextQuality = qualityForStats(nextStats);
      setNetworkQuality((current) => (current === 'reconnecting' && nextQuality === 'good' ? 'fair' : nextQuality));
    };

    const statsTimer = window.setInterval(() => {
      collectStats().catch((err) => console.warn('WebRTC stats collection failed:', err));
    }, 2000);

    return () => window.clearInterval(statsTimer);
  }, [hasJoined]);

  useEffect(() => {
    if (!hasJoined) return undefined;
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
    return () => window.clearTimeout(controlsTimerRef.current);
  }, [hasJoined]);

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
    addToast(nextMicOn ? 'Microphone unmuted' : 'Microphone muted', nextMicOn ? 'success' : 'default');
  };

  const toggleCamera = async () => {
    if (mediaState.camOn) {
      const track = cameraTrackRef.current;
      if (!screenTrackRef.current) replaceVideoTrack(null);
      if (track) {
        localStreamRef.current?.removeTrack(track);
        track.stop();
        setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      }
      cameraTrackRef.current = null;
      sfuSessionRef.current?.closeProducer('video');
      updateMedia({ camOn: false });
      addToast('Camera off', 'default');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS });
      const [track] = stream.getVideoTracks();
      if (!track) return;
      await clampTrack(track, CAMERA_CONSTRAINTS);
      cameraTrackRef.current = track;
      if (!localStreamRef.current) localStreamRef.current = new MediaStream();
      localStreamRef.current.addTrack(track);
      setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      if (!screenTrackRef.current) replaceVideoTrack(track);
      await sfuSessionRef.current?.replaceProducerTrack('video', track);
      updateMedia({ camOn: true });
      addToast('Camera on', 'success');
    } catch (err) {
      console.error('Camera restart failed:', err);
      addToast('Camera could not start', 'error');
    }
  };

  const toggleScreenShare = async () => {
    if (mediaState.screenSharing) {
      screenTrackRef.current?.stop();
      sfuSessionRef.current?.closeProducer('screen');
      const cameraTrack = cameraTrackRef.current || localStreamRef.current?.getVideoTracks()[0] || null;
      if (cameraTrack) replaceVideoTrack(cameraTrack);
      setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      updateMedia({ screenSharing: false, camOn: Boolean(cameraTrack) });
      addToast('Screen share stopped', 'default');
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_CONSTRAINTS,
        audio: false,
      });
      const [screenTrack] = screenStream.getVideoTracks();
      await clampTrack(screenTrack, SCREEN_CONSTRAINTS);
      screenTrackRef.current = screenTrack;
      replaceVideoTrack(screenTrack);
      await sfuSessionRef.current?.replaceProducerTrack('screen', screenTrack);
      setLocalStream(new MediaStream([
        ...(localStreamRef.current?.getAudioTracks?.() || []),
        screenTrack,
      ]));
      updateMedia({ screenSharing: true, camOn: true });
      addToast('Screen share started', 'success');
      screenTrack.onended = () => {
        const cameraTrack = cameraTrackRef.current || localStreamRef.current?.getVideoTracks()[0] || null;
        sfuSessionRef.current?.closeProducer('screen');
        if (cameraTrack) replaceVideoTrack(cameraTrack);
        setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
        updateMedia({ screenSharing: false, camOn: Boolean(cameraTrack) });
        addToast('Screen share stopped', 'default');
      };
    } catch (err) {
      console.error('Screen share failed:', err);
      addToast('Screen share could not start', 'error');
    }
  };

  const scrollToLatest = () => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    isNearBottomRef.current = true;
    setShowNewMessageButton(false);
  };

  const revealControls = () => {
    setControlsVisible(true);
    window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      addToast('Invite link copied', 'success');
      window.setTimeout(() => setLinkCopied(false), 1600);
    } catch (err) {
      console.error('Copy failed:', err);
      addToast('Could not copy the invite link', 'error');
    }
  };

  const toggleChatPanel = () => {
    setIsChatOpen((open) => !open);
    setIsParticipantsOpen(false);
    setUnreadCount(0);
  };

  const toggleParticipantsPanel = () => {
    setIsParticipantsOpen((open) => !open);
    setIsChatOpen(false);
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
      <div className="prejoin-page">
        <div className="hero-blob one" />
        <div className="hero-blob two" />
        <div className="container-xl relative z-10">
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-white/80 px-4 py-3 backdrop-blur">
            <div className="wordmark">
              <div className="logo-mark">A</div>
              <span>Alt+F Meet</span>
            </div>
            <div className="pill max-w-[52vw] truncate">{roomId}</div>
          </div>

          <div className="prejoin-card">
            <div>
              <VideoTile
                participant={localParticipant}
                stream={localStream}
                isLocal
                isSpeaking={speakingIds.has('local')}
              />
              <div className="mt-4 flex items-center justify-center gap-3">
                <button className={`control-button ${mediaState.micOn ? 'active' : 'danger active'}`} onClick={toggleMic} title="Microphone">
                  {mediaState.micOn ? <Mic size={20} /> : <MicOff size={20} />}
                  <span className="label">{mediaState.micOn ? 'Mic on' : 'Muted'}</span>
                </button>
                <button className={`control-button ${mediaState.camOn ? 'active' : 'danger active'}`} onClick={toggleCamera} title="Camera">
                  {mediaState.camOn ? <Camera size={20} /> : <CameraOff size={20} />}
                  <span className="label">{mediaState.camOn ? 'Camera' : 'Cam off'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="badge mb-5 w-fit">Room · {roomId}</div>
              <h1 className="h2">Ready to join?</h1>
              <p className="mt-3 text-sm leading-6 text-secondary">Check your camera and microphone before entering the room.</p>

              <label className="floating-label mt-8 block">Your name</label>
              <input
                className="input-field mt-2 text-lg"
                value={preJoinName}
                onChange={(event) => setPreJoinName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && preJoinName.trim()) startMeeting();
                }}
                placeholder="Enter your name"
                autoFocus
              />

              {connectionError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {connectionError}
                </div>
              )}

              <button
                className="btn-gradient mt-6 w-full py-4"
                disabled={!preJoinName.trim()}
                onClick={startMeeting}
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-page" onMouseMove={revealControls} onFocus={revealControls}>
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'error' : toast.tone === 'success' ? 'success' : 'info'}`}>
            {toast.message}
          </div>
        ))}
      </div>
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="meeting-topbar">
          <div className="wordmark min-w-0">
            <div className="logo-mark">A</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black">Alt+F Meet</div>
              <div className="truncate text-xs text-muted">{meetingDetails?.title || 'Meeting Room'}</div>
            </div>
          </div>

          <button className="topbar-button justify-self-center" onClick={copyInviteLink} title="Copy invite link">
            {linkCopied ? <Check size={16} /> : <Copy size={16} />}
            <span className="max-w-[34vw] truncate">{roomId}</span>
          </button>

          <div className="flex min-w-0 justify-end gap-2">
            <div
              className={`health-pill ${networkQuality}`}
              title={`RTT ${mediaStats.rtt}ms · Jitter ${mediaStats.jitter}ms · Loss ${mediaStats.packetLoss}% · Up ${mediaStats.bitrate}kbps · Mode ${qualityMode}`}
            >
              <Activity size={16} />
              <span>{QUALITY_LABELS[networkQuality] || 'Good'}</span>
            </div>
            <div className="pill">
              {formatDuration(elapsedSeconds)}
            </div>
            <button
              className={`topbar-button ${isParticipantsOpen ? 'border-brand text-brand' : ''}`}
              onClick={toggleParticipantsPanel}
              title="Participants"
            >
              <Users size={18} />
              <span>{visibleParticipants.length}</span>
            </button>
          </div>
        </header>

        {presentingParticipant ? (
          <section className="presentation-layout">
            <div className="presentation-stage">
              <VideoTile
                participant={presentingParticipant}
                isLocal={presentingParticipant.socketId === localParticipant.socketId}
                isSpeaking={
                  presentingParticipant.socketId === localParticipant.socketId
                    ? speakingIds.has('local')
                    : speakingIds.has(presentingParticipant.socketId)
                }
                stream={tileStreamFor(presentingParticipant, localParticipant, localStream, remoteStreams)}
              />
            </div>
            {filmstripParticipants.length > 0 && (
              <div className="presentation-filmstrip">
                {filmstripParticipants.map((participant) => (
                  <VideoTile
                    key={participant.socketId}
                    participant={participant}
                    isLocal={participant.socketId === localParticipant.socketId}
                    isSpeaking={
                      participant.socketId === localParticipant.socketId
                        ? speakingIds.has('local')
                        : speakingIds.has(participant.socketId)
                    }
                    stream={tileStreamFor(participant, localParticipant, localStream, remoteStreams)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
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
                stream={tileStreamFor(participant, localParticipant, localStream, remoteStreams)}
              />
            ))}
          </section>
        )}

        {visibleParticipants.length === 1 && connectionStatus === 'connected' && (
          <div className="solo-empty">
            <h3 className="text-base font-bold text-text">Share the link to invite others</h3>
            <p className="text-sm">You are the only one here right now.</p>
            <button className="btn-gradient pointer-events-auto" onClick={copyInviteLink}>
              <Copy size={16} />
              Copy invite link
            </button>
          </div>
        )}

        {qualityMode === 'audio-first' && (
          <div className="network-advice">
            Weak network detected. Audio is prioritized and video bitrate is reduced.
          </div>
        )}

        {connectionStatus === 'connecting' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/86 backdrop-blur">
            <div className="card flex flex-col items-center rounded-2xl p-8 text-center">
              <div className="spinner" />
              <p className="mt-4 font-semibold text-secondary">Connecting...</p>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/90 p-5 backdrop-blur">
            <div className="card max-w-md rounded-2xl p-8 text-center">
              <h2 className="h3">Connection failed</h2>
              <p className="mt-3 text-sm leading-6 text-secondary">{connectionError}</p>
              <button className="btn-primary mt-6" onClick={startMeeting}>Retry</button>
            </div>
          </div>
        )}

        <div className={`control-bar ${controlsVisible ? '' : 'hidden-idle'}`}>
            <button className={`control-button ${mediaState.micOn ? 'active' : 'danger active'}`} onClick={toggleMic} title="Microphone">
              {mediaState.micOn ? <Mic size={20} /> : <MicOff size={20} />}
              <span className="label">{mediaState.micOn ? 'Mute' : 'Unmute'}</span>
            </button>
            <button className={`control-button ${mediaState.camOn ? 'active' : 'danger active'}`} onClick={toggleCamera} title="Camera">
              {mediaState.camOn ? <Camera size={20} /> : <CameraOff size={20} />}
              <span className="label">{mediaState.camOn ? 'Camera' : 'Cam off'}</span>
            </button>
            <button className={`control-button ${mediaState.screenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title="Screen share">
              <MonitorUp size={20} />
              <span className="label">Share</span>
            </button>
            <button className={`control-button ${isChatOpen ? 'active' : ''}`} onClick={toggleChatPanel} title="Chat">
              <MessageCircle size={20} />
              <span className="label">Chat</span>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <button className={`control-button ${isParticipantsOpen ? 'active' : ''}`} onClick={toggleParticipantsPanel} title="Participants">
              <PanelRight size={20} />
              <span className="label">People</span>
            </button>
            <button className="control-button leave" onClick={leaveRoom} title="Leave meeting">
              <LogOut size={20} />
              <span className="label">Leave</span>
            </button>
        </div>
      </main>

      {isParticipantsOpen && (
        <aside className="side-panel w-80">
          <div className="panel-header">
            <h3>Participants ({visibleParticipants.length})</h3>
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
                    <p className="truncate font-semibold text-text">{cleanName(participant.name)} {isLocal && <span className="text-brand">(You)</span>}</p>
                  </div>
                  {participant.media?.micOn === false ? <MicOff size={16} className="text-error" /> : <Mic size={16} className="text-muted" />}
                  {participant.media?.camOn === false ? <CameraOff size={16} className="text-error" /> : <Camera size={16} className="text-muted" />}
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
            <div className="flex items-end gap-2">
              <textarea
                placeholder="Message everyone"
                className="textarea-field min-h-12 max-h-32 resize-none"
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSendMessage(event);
                  }
                }}
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
