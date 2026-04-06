// src/components/UI/AsciiVideoOverlay.jsx — Reusable ASCII effect overlay for video elements
import React, { useState, useEffect, useRef, useCallback } from 'react';

const ASCII_CHARS = ' .:-=+*#%@';

const AsciiVideoOverlay = ({ videoRef, active, cols: propCols, isMobile }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [asciiOutput, setAsciiOutput] = useState([]);
  const startedRef = useRef(false);

  const getAsciiChar = useCallback((brightness) => {
    const index = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
    return ASCII_CHARS[index];
  }, []);

  const processFrame = useCallback(() => {
    if (!active) return;

    const video = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Wait for video to have actual frames
    if (video.readyState < 2 || video.videoWidth === 0) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const baseCols = propCols || (isMobile ? 40 : 80);
    const aspectRatio = video.videoHeight / video.videoWidth;
    const rows = Math.floor(baseCols * aspectRatio * 0.5);

    if (rows <= 0) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = baseCols;
    canvas.height = rows;

    try {
      ctx.drawImage(video, 0, 0, baseCols, rows);
      const imageData = ctx.getImageData(0, 0, baseCols, rows);
      const pixels = imageData.data;

      const newRows = [];
      for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < baseCols; x++) {
          const i = (y * baseCols + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const brightness = (r + g + b) / 3;
          row.push({ char: getAsciiChar(brightness), color: `rgb(${r},${g},${b})` });
        }
        newRows.push(row);
      }
      setAsciiOutput(newRows);
    } catch (e) {
      // Canvas tainted — likely CORS issue with cached video
      // Try ONE more time by forcing video to reload with crossOrigin
      console.warn('ASCII: canvas error —', e.message);
      if (!startedRef.current) {
        startedRef.current = true;
        // Force reload video with CORS
        const currentTime = video.currentTime;
        const src = video.src;
        video.crossOrigin = 'anonymous';
        video.src = src + (src.includes('?') ? '&' : '?') + '_cors=1';
        video.currentTime = currentTime;
        video.play().catch(() => {});
      }
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, active, propCols, isMobile, getAsciiChar]);

  useEffect(() => {
    if (active) {
      startedRef.current = false;
      animationRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active, processFrame]);

  useEffect(() => {
    if (!active) setAsciiOutput([]);
  }, [active]);

  if (!active || asciiOutput.length === 0) return null;

  const fontSize = isMobile ? 5 : 7;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '8px',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <pre style={{
          fontFamily: 'monospace',
          fontSize: `${fontSize}px`,
          lineHeight: `${fontSize + 1}px`,
          letterSpacing: '1px',
          whiteSpace: 'pre',
          margin: 0
        }}>
          {asciiOutput.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((pixel, x) => (
                <span key={x} style={{ color: pixel.color }}>{pixel.char}</span>
              ))}
            </div>
          ))}
        </pre>
      </div>
    </>
  );
};

export default AsciiVideoOverlay;
