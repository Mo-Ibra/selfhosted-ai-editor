import { useEffect, useRef, useCallback } from 'react';

const SOUND_FILES = [
  '/assets/sounds/keyboard/1.wav',
  '/assets/sounds/keyboard/2.wav',
];

export function useKeyboardSound(enabled: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<AudioBuffer[]>([]);
  const isEnabledRef = useRef(enabled);

  isEnabledRef.current = enabled;

  useEffect(() => {
    // Only initialize if enabled
    if (!enabled && !audioCtxRef.current) return;

    // Create AudioContext on first enable
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }

    // Load buffers once
    if (audioCtxRef.current && buffersRef.current.length === 0) {
      Promise.all(
        SOUND_FILES.map(async (url) => {
          try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await audioCtxRef.current!.decodeAudioData(arrayBuffer);
          } catch (e) {
            console.error("Failed to load sound", url, e);
            return null;
          }
        })
      ).then((buffers) => {
        buffersRef.current = buffers.filter(Boolean) as AudioBuffer[];
      });
    }
  }, [enabled]);

  const play = useCallback(() => {
    if (!isEnabledRef.current || !audioCtxRef.current || buffersRef.current.length === 0) return;

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const buffer = buffersRef.current[Math.floor(Math.random() * buffersRef.current.length)];
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;

    // Add slight pitch variation for a more natural feel
    source.playbackRate.value = 0.95 + Math.random() * 0.1;

    // Adjust volume slightly
    const gainNode = audioCtxRef.current.createGain();
    gainNode.gain.value = 0.5 + Math.random() * 0.2;

    source.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    source.start(0);
  }, []);

  return { play };
}
