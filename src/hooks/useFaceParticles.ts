import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FACE_OPTIONS,
  FACE_PARTICLE_COUNT,
  FACE_PARTICLE_DURATION_MIN,
  FACE_PARTICLE_DURATION_RANGE,
  FACE_PARTICLE_REMOVAL_BUFFER,
  GRID_SIZE,
} from '../game/constants';
import type { FaceParticle } from '../game/types';

interface UseFaceParticlesResult {
  faceParticles: FaceParticle[];
  spawnFaceParticles: (x: number, y: number) => void;
  clearFaceParticles: () => void;
}

let faceParticleId = 0;
let faceBurstId = 0;

export const useFaceParticles = (): UseFaceParticlesResult => {
  const [faceParticles, setFaceParticles] = useState<FaceParticle[]>([]);
  const faceParticleTimersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    faceParticleTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    faceParticleTimersRef.current = [];
  }, []);

  useEffect(() => {
    const images = FACE_OPTIONS.map((source) => {
      const image = new Image();
      image.src = source;
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {});
      }
      return image;
    });

    return () => {
      images.length = 0;
      clearTimers();
    };
  }, [clearTimers]);

  const clearFaceParticles = useCallback(() => {
    clearTimers();
    setFaceParticles([]);
  }, [clearTimers]);

  const spawnFaceParticles = useCallback((x: number, y: number) => {
    if (FACE_OPTIONS.length === 0) return;

    const face = FACE_OPTIONS[Math.floor(Math.random() * FACE_OPTIONS.length)];
    const left = ((x + 0.5) / GRID_SIZE) * 100;
    const top = ((y + 0.5) / GRID_SIZE) * 100;
    const burstId = `face-burst-${(faceBurstId += 1)}`;

    const particles: FaceParticle[] = Array.from({ length: FACE_PARTICLE_COUNT }).map((_, index) => ({
      id: `face-particle-${(faceParticleId += 1)}`,
      burstId,
      face,
      left,
      top,
      dx: Math.round(Math.random() * 130 - 65),
      dy: Math.round(-(60 + Math.random() * 90)),
      rot: Math.round(Math.random() * 180 - 90),
      scale: 0.82 + Math.random() * 0.58,
      delay: index * 28,
      duration: FACE_PARTICLE_DURATION_MIN + Math.round(Math.random() * FACE_PARTICLE_DURATION_RANGE),
    }));

    setFaceParticles((current) => [...current, ...particles]);

    const removeAfter =
      Math.max(...particles.map((particle) => particle.duration + particle.delay)) +
      FACE_PARTICLE_REMOVAL_BUFFER;

    const timer = window.setTimeout(() => {
      setFaceParticles((current) => current.filter((entry) => entry.burstId !== burstId));
      faceParticleTimersRef.current = faceParticleTimersRef.current.filter((entry) => entry !== timer);
    }, removeAfter);

    faceParticleTimersRef.current.push(timer);
  }, []);

  return {
    faceParticles,
    spawnFaceParticles,
    clearFaceParticles,
  };
};
