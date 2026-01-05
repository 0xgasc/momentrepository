// src/components/UI/UMOEffect.jsx
// UMO Trippy Effect - Psychedelic visual overlay for videos
import React, { useState, useEffect, useRef, memo } from 'react';

const UMOEffect = memo(({ intensity = 50, className = '' }) => {
  const [glitchOffset, setGlitchOffset] = useState({ x: 0, y: 0 });
  const [colorShift, setColorShift] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);
  const [glitchBars, setGlitchBars] = useState([]);
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const [rippleCenter, setRippleCenter] = useState({ x: 50, y: 50 });
  const [plasmaPhase, setPlasmaPhase] = useState(0);
  const animationRef = useRef(null);
  const glitchIntervalRef = useRef(null);

  // Normalized intensity (0-1)
  const i = intensity / 100;

  // Random glitch effects - more intense at higher levels
  useEffect(() => {
    if (intensity < 30) {
      setGlitchOffset({ x: 0, y: 0 });
      setGlitchBars([]);
      return;
    }

    // Glitch interval - more frequent at higher intensity
    const glitchFrequency = Math.max(50, 1500 - (intensity * 12));

    glitchIntervalRef.current = setInterval(() => {
      // Random chance of glitch based on intensity
      if (Math.random() < (intensity / 100)) {
        // RGB split glitch
        setGlitchOffset({
          x: (Math.random() - 0.5) * intensity * 0.5,
          y: (Math.random() - 0.5) * intensity * 0.25
        });

        // Random horizontal glitch bars
        if (intensity > 50 && Math.random() < 0.6) {
          const numBars = Math.floor(Math.random() * 8) + 2;
          const bars = Array.from({ length: numBars }, () => ({
            top: Math.random() * 100,
            height: Math.random() * 5 + 0.5,
            offset: (Math.random() - 0.5) * 40,
            color: ['cyan', 'magenta', 'lime', 'yellow', 'red'][Math.floor(Math.random() * 5)]
          }));
          setGlitchBars(bars);
        }

        // Screen flicker
        if (intensity > 60 && Math.random() < 0.5) {
          setFlickerOpacity(0.5 + Math.random() * 0.5);
        }

        // Move ripple center randomly
        if (intensity > 70) {
          setRippleCenter({
            x: 30 + Math.random() * 40,
            y: 30 + Math.random() * 40
          });
        }

        // Reset after glitch duration
        setTimeout(() => {
          setGlitchOffset({ x: 0, y: 0 });
          setGlitchBars([]);
          setFlickerOpacity(1);
        }, 30 + Math.random() * 80);
      }
    }, glitchFrequency);

    return () => {
      if (glitchIntervalRef.current) {
        clearInterval(glitchIntervalRef.current);
      }
    };
  }, [intensity]);

  // Continuous wave animation for liquid effect
  useEffect(() => {
    if (intensity < 10) return;

    let lastTime = 0;
    const animate = (time) => {
      if (time - lastTime > 30) {
        setWavePhase(prev => (prev + 0.08) % (Math.PI * 2));
        setColorShift(prev => (prev + 1) % 360);
        setPlasmaPhase(prev => (prev + 0.03) % (Math.PI * 2));
        lastTime = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity]);

  if (intensity === 0) return null;

  // Calculate wave distortion for liquid effect
  const waveDistortX = Math.sin(wavePhase) * i * 8;
  const waveDistortY = Math.cos(wavePhase * 1.3) * i * 5;
  const waveDistort2 = Math.sin(wavePhase * 2.1) * i * 4;

  // Plasma calculation for liquid effect
  const plasma1 = Math.sin(plasmaPhase * 3) * 50 + 50;
  const plasma2 = Math.cos(plasmaPhase * 2) * 50 + 50;

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ opacity: flickerOpacity }}
    >
      {/* LIQUID RIPPLE DISTORTION */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.3,
          background: `radial-gradient(
            ellipse ${80 + Math.sin(wavePhase) * 20}% ${80 + Math.cos(wavePhase) * 20}% at ${rippleCenter.x}% ${rippleCenter.y}%,
            transparent 0%,
            rgba(255, 200, 0, 0.08) ${10 + Math.sin(wavePhase * 2) * 5}%,
            transparent ${20 + Math.sin(wavePhase * 3) * 10}%,
            rgba(255, 100, 0, 0.05) ${35 + Math.cos(wavePhase * 2) * 10}%,
            transparent ${50 + Math.sin(wavePhase) * 15}%,
            rgba(255, 150, 50, 0.06) ${70 + Math.cos(wavePhase * 4) * 10}%,
            transparent 100%
          )`,
          mixBlendMode: 'screen',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      />

      {/* PLASMA LIQUID LAYER */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.25,
          background: `
            radial-gradient(circle at ${plasma1}% ${plasma2}%, rgba(255, 150, 0, 0.15) 0%, transparent 40%),
            radial-gradient(circle at ${100 - plasma1}% ${100 - plasma2}%, rgba(255, 200, 100, 0.15) 0%, transparent 40%),
            radial-gradient(circle at ${plasma2}% ${plasma1}%, rgba(200, 100, 0, 0.12) 0%, transparent 35%)
          `,
          mixBlendMode: 'screen',
          filter: `blur(${i * 15}px)`
        }}
      />

      {/* REFLECTION / GLASS EFFECT */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.2,
          background: `linear-gradient(
            ${135 + waveDistortX * 3}deg,
            transparent 0%,
            rgba(255, 255, 255, 0.08) ${20 + Math.sin(wavePhase) * 10}%,
            transparent ${35 + Math.cos(wavePhase) * 10}%,
            rgba(255, 255, 255, 0.05) ${60 + Math.sin(wavePhase * 2) * 15}%,
            transparent 75%
          )`,
          mixBlendMode: 'overlay'
        }}
      />

      {/* Base scanlines */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.5,
          background: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.4) 0px,
            rgba(0, 0, 0, 0.4) ${1 + i * 2}px,
            transparent ${1 + i * 2}px,
            transparent ${3 + i * 3}px
          )`,
          mixBlendMode: 'multiply'
        }}
      />

      {/* RGB vertical pixel columns - UMO orange/gold tint */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.4,
          background: `repeating-linear-gradient(
            90deg,
            rgba(255, 150, 0, 0.1) 0px,
            rgba(255, 200, 100, 0.1) 2px,
            rgba(200, 100, 50, 0.1) 4px,
            transparent 6px
          )`
        }}
      />

      {/* RGB Split / Chromatic aberration - ORANGE */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.35,
          background: 'rgba(255, 100, 0, 0.15)',
          mixBlendMode: 'screen',
          transform: `translate(${glitchOffset.x + waveDistortX}px, ${glitchOffset.y + waveDistort2}px) scale(${1 + i * 0.02})`
        }}
      />

      {/* RGB Split - GOLD */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.35,
          background: 'rgba(255, 200, 50, 0.12)',
          mixBlendMode: 'screen',
          transform: `translate(${-glitchOffset.x - waveDistortX}px, ${-glitchOffset.y - waveDistort2}px) scale(${1 + i * 0.02})`
        }}
      />

      {/* RGB Split - WARM */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.25,
          background: 'rgba(255, 150, 100, 0.08)',
          mixBlendMode: 'screen',
          transform: `translate(${waveDistort2}px, ${-waveDistortX}px)`
        }}
      />

      {/* Liquid wave distortion overlay */}
      {intensity > 30 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: i * 0.5,
            background: `linear-gradient(
              ${45 + wavePhase * 30}deg,
              transparent 0%,
              rgba(255, 200, 0, 0.25) ${15 + Math.sin(wavePhase) * 15}%,
              transparent ${30 + Math.sin(wavePhase * 2) * 20}%,
              rgba(255, 100, 0, 0.2) ${50 + Math.cos(wavePhase) * 15}%,
              transparent ${70 + Math.sin(wavePhase * 3) * 10}%,
              rgba(200, 150, 0, 0.15) ${85 + Math.cos(wavePhase * 2) * 10}%,
              transparent 100%
            )`,
            mixBlendMode: 'overlay',
            transform: `skewX(${waveDistortX}deg) skewY(${waveDistortY * 0.5}deg)`
          }}
        />
      )}

      {/* WATER CAUSTICS EFFECT */}
      {intensity > 50 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: i * 0.4,
            background: `
              repeating-conic-gradient(
                from ${wavePhase * 60}deg at ${50 + Math.sin(wavePhase) * 20}% ${50 + Math.cos(wavePhase) * 20}%,
                transparent 0deg,
                rgba(255, 200, 100, 0.1) 15deg,
                transparent 30deg
              )
            `,
            mixBlendMode: 'screen',
            filter: `blur(${i * 10}px)`
          }}
        />
      )}

      {/* Blur layer - fuzzy look */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: `blur(${i * 2}px) saturate(${100 + i * 80}%) contrast(${100 + i * 20}%)`,
          WebkitBackdropFilter: `blur(${i * 2}px) saturate(${100 + i * 80}%) contrast(${100 + i * 20}%)`
        }}
      />

      {/* Heavy vignette */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i,
          background: 'radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.9) 100%)'
        }}
      />

      {/* Animated color wash - UMO gold/orange palette */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.4,
          background: `linear-gradient(
            ${135 + colorShift * 2}deg,
            hsla(${30 + (colorShift % 40)}, 100%, 50%, 0.2) 0%,
            hsla(${40 + (colorShift % 30)}, 100%, 50%, 0.15) 25%,
            hsla(${20 + (colorShift % 50)}, 100%, 50%, 0.12) 50%,
            hsla(${35 + (colorShift % 35)}, 100%, 50%, 0.15) 75%,
            hsla(${30 + (colorShift % 40)}, 100%, 50%, 0.2) 100%
          )`,
          mixBlendMode: 'color'
        }}
      />

      {/* Phosphor glow - pulsing */}
      <div
        className="absolute inset-0"
        style={{
          opacity: (0.15 + Math.sin(wavePhase * 2) * 0.1) * i,
          background: `radial-gradient(
            ellipse at ${50 + Math.sin(wavePhase) * 20}% ${50 + Math.cos(wavePhase) * 20}%,
            rgba(255, 200, 100, 0.4) 0%,
            transparent 50%
          )`,
          mixBlendMode: 'screen'
        }}
      />

      {/* Static noise grain */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.5,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.2\' numOctaves=\'5\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          backgroundPosition: `${Math.random() * 100}% ${Math.random() * 100}%`,
          mixBlendMode: 'overlay'
        }}
      />

      {/* Screen curvature */}
      <div
        className="absolute inset-0"
        style={{
          opacity: i * 0.8,
          background: 'radial-gradient(ellipse 150% 150% at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
          borderRadius: '5%'
        }}
      />

      {/* Random glitch bars */}
      {glitchBars.map((bar, idx) => (
        <div
          key={idx}
          className="absolute left-0 right-0"
          style={{
            top: `${bar.top}%`,
            height: `${bar.height}%`,
            background: bar.color === 'cyan' ? 'rgba(0, 255, 255, 0.5)'
              : bar.color === 'magenta' ? 'rgba(255, 0, 255, 0.5)'
              : bar.color === 'lime' ? 'rgba(200, 255, 0, 0.5)'
              : bar.color === 'yellow' ? 'rgba(255, 200, 0, 0.5)'
              : 'rgba(255, 100, 0, 0.5)',
            transform: `translateX(${bar.offset}px) skewX(${bar.offset * 0.5}deg)`,
            mixBlendMode: 'screen',
            filter: 'blur(1px)'
          }}
        />
      ))}

      {/* High intensity mode (70%+) */}
      {intensity > 70 && (
        <>
          {/* Double vision / ghost image */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.7) * 3,
              background: 'transparent',
              boxShadow: `
                ${8 + waveDistortX * 3}px ${5 + waveDistortY * 2}px 0 rgba(255, 150, 0, 0.25),
                ${-8 - waveDistortX * 3}px ${-5 - waveDistortY * 2}px 0 rgba(255, 200, 100, 0.25),
                ${waveDistort2 * 2}px ${-waveDistortX * 2}px 0 rgba(200, 100, 0, 0.2)
              `
            }}
          />

          {/* Vertical rolling bar (like old TVs) */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${(wavePhase / (Math.PI * 2)) * 130 - 15}%`,
              height: '12%',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), rgba(255,255,255,0.2), rgba(255,255,255,0.15), transparent)',
              opacity: 0.7
            }}
          />

          {/* Edge distortion */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.7) * 4,
              background: `linear-gradient(90deg,
                rgba(255,150,0,0.35) 0%,
                transparent 8%,
                transparent 92%,
                rgba(255,200,100,0.35) 100%
              )`
            }}
          />

          {/* HOLOGRAPHIC SHEEN */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.7) * 2,
              background: `linear-gradient(
                ${45 + colorShift}deg,
                transparent 30%,
                rgba(255, 255, 255, 0.1) 45%,
                rgba(255, 200, 150, 0.15) 50%,
                rgba(200, 200, 150, 0.15) 55%,
                transparent 70%
              )`,
              mixBlendMode: 'overlay'
            }}
          />
        </>
      )}

      {/* MAXIMUM UMO MODE (85%+) */}
      {intensity > 85 && (
        <>
          {/* Color inversion flashes */}
          <div
            className="absolute inset-0"
            style={{
              opacity: Math.random() < 0.15 ? 0.4 : 0,
              background: 'white',
              mixBlendMode: 'difference'
            }}
          />

          {/* Extreme chromatic separation */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.6,
              boxShadow: `
                inset ${15 + Math.sin(wavePhase * 3) * 10}px 0 30px rgba(255, 150, 0, 0.5),
                inset ${-15 - Math.sin(wavePhase * 3) * 10}px 0 30px rgba(255, 200, 100, 0.5),
                inset 0 ${10 + Math.cos(wavePhase * 2) * 5}px 20px rgba(200, 100, 0, 0.3)
              `
            }}
          />

          {/* DIGITAL DECAY */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.85) * 5,
              background: `repeating-linear-gradient(
                ${90 + waveDistortX * 10}deg,
                transparent 0px,
                rgba(255, 200, 100, 0.3) 1px,
                transparent 2px,
                transparent ${8 + Math.random() * 4}px
              )`,
              mixBlendMode: 'screen'
            }}
          />

          {/* MELTING EFFECT */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.85) * 3,
              background: `linear-gradient(
                180deg,
                transparent 0%,
                transparent ${50 + Math.sin(wavePhase) * 20}%,
                rgba(255, 150, 0, 0.2) ${60 + Math.sin(wavePhase) * 15}%,
                rgba(255, 200, 100, 0.3) ${75 + Math.cos(wavePhase) * 10}%,
                rgba(200, 150, 0, 0.2) 100%
              )`,
              filter: `blur(${i * 15}px)`,
              transform: `translateY(${Math.sin(wavePhase) * 10}px)`,
              mixBlendMode: 'screen'
            }}
          />
        </>
      )}

      {/* ABSOLUTE MAXIMUM (95%+) */}
      {intensity > 95 && (
        <>
          {/* REALITY BREAKDOWN */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.5,
              background: `
                repeating-linear-gradient(
                  ${wavePhase * 100}deg,
                  transparent,
                  rgba(255, 150, 0, 0.3) 2px,
                  transparent 4px
                ),
                repeating-linear-gradient(
                  ${-wavePhase * 100}deg,
                  transparent,
                  rgba(255, 200, 100, 0.3) 2px,
                  transparent 4px
                )
              `,
              mixBlendMode: 'screen'
            }}
          />

          {/* COMPLETE CHAOS FLICKER */}
          <div
            className="absolute inset-0"
            style={{
              opacity: Math.random() * 0.3,
              background: `hsl(${30 + Math.random() * 30}, 100%, 50%)`,
              mixBlendMode: 'overlay'
            }}
          />
        </>
      )}
    </div>
  );
});

UMOEffect.displayName = 'UMOEffect';

export default UMOEffect;
