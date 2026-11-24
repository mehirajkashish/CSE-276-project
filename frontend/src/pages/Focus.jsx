import React, { useState, useEffect, useRef } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Coffee,
  Brain,
  CheckCircle2,
  Sliders,
  Flame
} from 'lucide-react';

export default function Focus() {
  const [mode, setMode] = useState('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(() => {
    return parseInt(localStorage.getItem('studymind_focus_sessions') || '3', 10);
  });

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [soundType, setSoundType] = useState('binaural');
  const audioCtxRef = useRef(null);
  const soundNodesRef = useRef([]);

  useEffect(() => {
    let interval = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  const handleTimerComplete = () => {
    setIsRunning(false);
    if (mode === 'focus' || mode === 'deep') {
      const updated = completedSessions + 1;
      setCompletedSessions(updated);
      localStorage.setItem('studymind_focus_sessions', String(updated));
      alert('🎉 Focus Session Completed! Take a refreshing break.');
    } else {
      alert('⏰ Break is over! Ready to resume studying?');
    }
  };

  const setTimerPreset = (newMode, minutes) => {
    setIsRunning(false);
    setMode(newMode);
    setSecondsLeft(minutes * 60);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (mode === 'focus') setSecondsLeft(25 * 60);
    else if (mode === 'deep') setSecondsLeft(50 * 60);
    else if (mode === 'shortBreak') setSecondsLeft(5 * 60);
    else if (mode === 'longBreak') setSecondsLeft(15 * 60);
  };

  const stopAmbientSound = () => {
    try {
      soundNodesRef.current.forEach((node) => {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      });
      soundNodesRef.current = [];
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
    } catch (e) {
      console.warn('Audio cleanup error:', e);
    }
    setIsPlayingAudio(false);
  };

  const startAmbientSound = () => {
    try {
      stopAmbientSound();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.connect(ctx.destination);

      if (soundType === 'binaural') {
        const oscLeft = ctx.createOscillator();
        const oscRight = ctx.createOscillator();
        const panLeft = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const panRight = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        oscLeft.type = 'sine';
        oscLeft.frequency.value = 216;
        oscRight.type = 'sine';
        oscRight.frequency.value = 256;

        if (panLeft && panRight) {
          panLeft.pan.value = -1;
          panRight.pan.value = 1;
          oscLeft.connect(panLeft).connect(gain);
          oscRight.connect(panRight).connect(gain);
        } else {
          oscLeft.connect(gain);
          oscRight.connect(gain);
        }

        oscLeft.start();
        oscRight.start();
        soundNodesRef.current = [oscLeft, oscRight, gain];
      } else {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        noise.connect(gain);
        noise.start();
        soundNodesRef.current = [noise, gain];
      }

      setIsPlayingAudio(true);
    } catch (e) {
      console.warn('Web Audio startup error:', e);
      setIsPlayingAudio(false);
    }
  };

  const toggleSound = () => {
    if (isPlayingAudio) stopAmbientSound();
    else startAmbientSound();
  };

  useEffect(() => {
    return () => stopAmbientSound();
  }, []);

  const formatDisplay = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalTimeForMode = mode === 'focus' ? 25 * 60 : mode === 'deep' ? 50 * 60 : mode === 'shortBreak' ? 5 * 60 : 15 * 60;
  const progressPercent = Math.round(((totalTimeForMode - secondsLeft) / totalTimeForMode) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#1A1A1A] border border-[#262626] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Focus Mode &{' '}
              <span className="font-serif italic font-normal text-white">Pomodoro Study</span>
            </h1>
            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#141414] text-white border border-[#262626]">
              Flow State
            </span>
          </div>
          <p className="text-xs text-[#9A9A9A] mt-1">
            Eliminate distractions with timed study intervals and synthesized binaural focus frequencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition shadow-sm ${
              isPlayingAudio
                ? 'bg-white text-black border-white font-semibold animate-pulse'
                : 'bg-[#0D0D0D] border-[#262626] text-[#9A9A9A] hover:text-white'
            }`}
          >
            {isPlayingAudio ? <Volume2 className="w-4 h-4 text-black" /> : <VolumeX className="w-4 h-4" />}
            <span>{isPlayingAudio ? 'Focus Audio Playing' : 'Play Ambient Sound'}</span>
          </button>
        </div>
      </div>

      {/* Mode Presets */}
      <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-[#1A1A1A] border border-[#262626] max-w-lg mx-auto text-xs shadow-sm">
        {[
          { id: 'focus', label: 'Standard Focus (25m)', mins: 25, icon: Brain },
          { id: 'deep', label: 'Deep Work (50m)', mins: 50, icon: Flame },
          { id: 'shortBreak', label: 'Short Break (5m)', mins: 5, icon: Coffee },
          { id: 'longBreak', label: 'Long Break (15m)', mins: 15, icon: Coffee },
        ].map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => setTimerPreset(p.id, p.mins)}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                mode === p.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-[#9A9A9A] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Giant Circular Digital Timer */}
      <div className="relative rounded-3xl border border-[#262626] bg-[#1A1A1A] p-12 text-center shadow-lg overflow-hidden max-w-lg mx-auto">
        <div className="relative z-10 space-y-6">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#9A9A9A]">
            {mode === 'focus' ? '🎯 Focus Session' : mode === 'deep' ? '🔥 Deep Work Session' : '☕ Rest & Refresh'}
          </div>

          <div className="text-6xl sm:text-7xl font-bold font-mono tracking-tighter text-white">
            {formatDisplay(secondsLeft)}
          </div>

          {/* Progress Bar */}
          <div className="w-64 mx-auto h-2 bg-[#0D0D0D] rounded-full overflow-hidden border border-[#262626]">
            <div
              className="h-full bg-white transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls: Play/Pause/Reset */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="px-8 py-3 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition shadow-sm active:scale-95 flex items-center gap-2"
            >
              {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current stroke-[2.5]" />}
              <span>{isRunning ? 'Pause' : 'Start Focus'}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-3 rounded-lg bg-[#0D0D0D] hover:bg-[#1F1F1F] text-[#9A9A9A] hover:text-white border border-[#262626] transition active:scale-95"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Focus Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#262626] space-y-1 shadow-sm">
          <span className="text-xs text-[#9A9A9A]">Sessions Completed Today</span>
          <div className="text-2xl font-bold text-white font-mono">{completedSessions}</div>
          <span className="text-[11px] text-emerald-400 font-medium">Top 5% student focus consistency</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#262626] space-y-1 shadow-sm">
          <span className="text-xs text-[#9A9A9A]">Total Focus Time</span>
          <div className="text-2xl font-bold text-white font-mono">
            {completedSessions * 25} mins
          </div>
          <span className="text-[11px] text-[#9A9A9A]">Equivalent to ~{(completedSessions * 25 / 60).toFixed(1)} study hours</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#262626] space-y-1 shadow-sm">
          <span className="text-xs text-[#9A9A9A]">Ambient Audio Frequency</span>
          <div className="text-2xl font-bold text-white font-mono">40 Hz</div>
          <span className="text-[11px] text-[#9A9A9A]">Gamma band cognitive stimulation</span>
        </div>
      </div>
    </div>
  );
}
