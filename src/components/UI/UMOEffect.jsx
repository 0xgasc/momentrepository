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

      {/* ENHANCED CHAOS MODE (80%+) */}
      {intensity > 80 && (
        <>
          {/* Screen tearing effect - horizontal slices offset */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ opacity: (i - 0.8) * 5 }}
          >
            {[0, 1, 2, 3].map((slice) => (
              <div
                key={`tear-${slice}`}
                className="absolute left-0 right-0"
                style={{
                  top: `${20 + slice * 20 + Math.sin(wavePhase * (slice + 1)) * 5}%`,
                  height: '8%',
                  transform: `translateX(${Math.sin(wavePhase * 2 + slice) * (10 + (i - 0.8) * 50)}px)`,
                  background: 'rgba(255, 200, 100, 0.08)',
                  boxShadow: `
                    ${5 + Math.random() * 5}px 0 0 rgba(255, 100, 0, 0.2),
                    ${-5 - Math.random() * 5}px 0 0 rgba(0, 255, 255, 0.15)
                  `,
                  mixBlendMode: 'screen'
                }}
              />
            ))}
          </div>

          {/* Aggressive RGB channel splitting */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.8) * 3,
              boxShadow: `
                inset ${12 + Math.sin(wavePhase * 4) * 8}px 0 0 rgba(255, 50, 0, 0.35),
                inset ${-12 - Math.sin(wavePhase * 4) * 8}px 0 0 rgba(0, 255, 200, 0.35),
                inset 0 ${6 + Math.cos(wavePhase * 3) * 4}px 0 rgba(255, 255, 0, 0.2)
              `
            }}
          />

          {/* Pulsing zoom effect */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.8) * 2,
              background: 'transparent',
              transform: `scale(${1 + Math.sin(wavePhase * 2) * (i - 0.8) * 0.1})`,
              boxShadow: 'inset 0 0 100px rgba(255, 150, 0, 0.3)'
            }}
          />
        </>
      )}

      {/* MAXIMUM UMO MODE (85%+) */}
      {intensity > 85 && (
        <>
          {/* Color inversion flashes - more frequent */}
          <div
            className="absolute inset-0"
            style={{
              opacity: Math.random() < 0.25 ? 0.5 : 0,
              background: 'white',
              mixBlendMode: 'difference'
            }}
          />

          {/* Extreme chromatic separation */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.7,
              boxShadow: `
                inset ${20 + Math.sin(wavePhase * 3) * 15}px 0 40px rgba(255, 100, 0, 0.6),
                inset ${-20 - Math.sin(wavePhase * 3) * 15}px 0 40px rgba(0, 255, 255, 0.5),
                inset 0 ${15 + Math.cos(wavePhase * 2) * 10}px 30px rgba(255, 0, 150, 0.4)
              `
            }}
          />

          {/* DIGITAL DECAY / Datamosh effect */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.85) * 6,
              background: `repeating-linear-gradient(
                ${90 + waveDistortX * 15}deg,
                transparent 0px,
                rgba(255, 200, 100, 0.4) 1px,
                rgba(0, 255, 255, 0.2) 2px,
                transparent 3px,
                transparent ${6 + Math.random() * 4}px
              )`,
              mixBlendMode: 'screen'
            }}
          />

          {/* MELTING EFFECT - enhanced */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.85) * 4,
              background: `linear-gradient(
                180deg,
                transparent 0%,
                transparent ${40 + Math.sin(wavePhase) * 25}%,
                rgba(255, 100, 0, 0.3) ${55 + Math.sin(wavePhase) * 20}%,
                rgba(255, 200, 100, 0.4) ${70 + Math.cos(wavePhase) * 15}%,
                rgba(200, 100, 0, 0.3) 100%
              )`,
              filter: `blur(${i * 20}px)`,
              transform: `translateY(${Math.sin(wavePhase) * 15}px) scaleY(${1 + Math.sin(wavePhase * 2) * 0.1})`,
              mixBlendMode: 'screen'
            }}
          />

          {/* Pixel sorting / glitch bands */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ opacity: (i - 0.85) * 5 }}
          >
            {[0, 1, 2, 3, 4, 5].map((band) => (
              <div
                key={`band-${band}`}
                className="absolute left-0 right-0"
                style={{
                  top: `${band * 16 + Math.sin(wavePhase * (band + 1)) * 8}%`,
                  height: `${3 + Math.random() * 5}%`,
                  background: `linear-gradient(90deg,
                    transparent ${Math.random() * 30}%,
                    rgba(255, ${150 + Math.random() * 100}, ${Math.random() * 100}, 0.4) ${30 + Math.random() * 20}%,
                    rgba(0, 255, 255, 0.3) ${60 + Math.random() * 20}%,
                    transparent ${80 + Math.random() * 20}%
                  )`,
                  transform: `skewX(${(Math.random() - 0.5) * 30}deg)`,
                  mixBlendMode: 'screen'
                }}
              />
            ))}
          </div>

          {/* Recursive zoom illusion */}
          <div
            className="absolute inset-0"
            style={{
              opacity: (i - 0.85) * 2,
              background: 'radial-gradient(circle at center, transparent 30%, rgba(255, 150, 0, 0.2) 60%, transparent 80%)',
              transform: `scale(${1 + Math.sin(wavePhase * 3) * 0.15})`,
              mixBlendMode: 'screen'
            }}
          />
        </>
      )}

      {/* ABSOLUTE MAXIMUM (95%+) - REALITY BREAKS DOWN */}
      {intensity > 95 && (
        <>
          {/* REALITY BREAKDOWN - intensified grid */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.7,
              background: `
                repeating-linear-gradient(
                  ${wavePhase * 150}deg,
                  transparent,
                  rgba(255, 100, 0, 0.5) 1px,
                  rgba(0, 255, 255, 0.3) 2px,
                  transparent 3px
                ),
                repeating-linear-gradient(
                  ${-wavePhase * 150}deg,
                  transparent,
                  rgba(255, 0, 150, 0.4) 1px,
                  rgba(150, 255, 0, 0.3) 2px,
                  transparent 3px
                )
              `,
              mixBlendMode: 'screen',
              animation: 'spin 0.5s linear infinite'
            }}
          />

          {/* COMPLETE CHAOS FLICKER - more aggressive */}
          <div
            className="absolute inset-0"
            style={{
              opacity: Math.random() * 0.5,
              background: `hsl(${Math.random() * 60}, 100%, 50%)`,
              mixBlendMode: Math.random() > 0.5 ? 'overlay' : 'difference'
            }}
          />

          {/* Kaleidoscope / mirror fragment effect */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.4,
              background: `conic-gradient(
                from ${wavePhase * 180}deg at 50% 50%,
                rgba(255, 100, 0, 0.4) 0deg,
                transparent 30deg,
                rgba(0, 255, 200, 0.3) 60deg,
                transparent 90deg,
                rgba(255, 0, 150, 0.3) 120deg,
                transparent 150deg,
                rgba(255, 200, 0, 0.4) 180deg,
                transparent 210deg,
                rgba(100, 255, 100, 0.3) 240deg,
                transparent 270deg,
                rgba(150, 100, 255, 0.3) 300deg,
                transparent 330deg,
                rgba(255, 100, 0, 0.4) 360deg
              )`,
              mixBlendMode: 'screen',
              transform: `rotate(${wavePhase * 30}deg) scale(${1.5 + Math.sin(wavePhase * 2) * 0.3})`
            }}
          />

          {/* Extreme screen distortion / wave warp */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.6,
              transform: `
                perspective(500px)
                rotateX(${Math.sin(wavePhase * 2) * 5}deg)
                rotateY(${Math.cos(wavePhase * 3) * 5}deg)
                skewX(${Math.sin(wavePhase) * 8}deg)
              `,
              background: 'transparent',
              boxShadow: `
                ${30 * Math.sin(wavePhase * 4)}px ${20 * Math.cos(wavePhase * 3)}px 60px rgba(255, 100, 0, 0.5),
                ${-30 * Math.sin(wavePhase * 4)}px ${-20 * Math.cos(wavePhase * 3)}px 60px rgba(0, 255, 255, 0.5)
              `
            }}
          />

          {/* Negative / solarize flash bursts */}
          {Math.random() > 0.85 && (
            <div
              className="absolute inset-0"
              style={{
                opacity: 0.6,
                filter: 'invert(1) hue-rotate(180deg)',
                mixBlendMode: 'exclusion'
              }}
            />
          )}

          {/* Strobing edge glow */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.5 + Math.sin(wavePhase * 8) * 0.3,
              boxShadow: `
                inset 0 0 80px rgba(255, 0, 100, 0.6),
                inset 0 0 40px rgba(0, 255, 200, 0.5),
                0 0 60px rgba(255, 150, 0, 0.8)
              `
            }}
          />

          {/* Converging lines / hypnotic spiral */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.3,
              background: `repeating-conic-gradient(
                from ${wavePhase * 90}deg at 50% 50%,
                transparent 0deg,
                rgba(255, 255, 255, 0.1) 5deg,
                transparent 10deg
              )`,
              transform: `scale(${2 + Math.sin(wavePhase) * 0.5})`,
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
