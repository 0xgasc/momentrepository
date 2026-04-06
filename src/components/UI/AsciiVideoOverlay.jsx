// src/components/UI/AsciiVideoOverlay.jsx — Reusable ASCII effect overlay for video elements
import React, { useState, useEffect, useRef, useCallback } from 'react';

const ASCII_CHARS = ' .:-=+*#%@';

const AsciiVideoOverlay = ({ videoRef, active, cols: propCols, isMobile }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [asciiOutput, setAsciiOutput] = useState([]);
  const [error, setError] = useState(false);

  const getAsciiChar = useCallback((brightness) => {
    const index = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
    return ASCII_CHARS[index];
  }, []);

  const processFrame = useCallback(() => {
    if (!active || error) return;

    const video = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended || video.readyState < 2) {
      // Video not ready yet, retry
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const baseCols = propCols || (isMobile ? 40 : 80);
      const aspectRatio = (video.videoHeight || 720) / (video.videoWidth || 1280);
      const rows = Math.floor(baseCols * aspectRatio * 0.5);

      if (rows <= 0 || baseCols <= 0) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      canvas.width = baseCols;
      canvas.height = rows;
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
      // Canvas tainted by cross-origin video — fall back
      console.warn('ASCII overlay: canvas tainted, disabling', e.message);
      setError(true);
      return;
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, active, propCols, isMobile, getAsciiChar, error]);

  useEffect(() => {
    if (active && !error) {
      // Wait for video to be playing before starting
      const video = videoRef?.current;
      if (video) {
        const startLoop = () => {
          animationRef.current = requestAnimationFrame(processFrame);
        };
        if (video.readyState >= 2 && !video.paused) {
          startLoop();
        } else {
          video.addEventListener('playing', startLoop, { once: true });
          // Also try to play if paused
          if (video.paused) {
            video.play().catch(() => {});
          }
          return () => video.removeEventListener('playing', startLoop);
        }
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active, processFrame, videoRef, error]);

  useEffect(() => {
    if (!active) {
      setAsciiOutput([]);
      setError(false);
    }
  }, [active]);

  if (!active || asciiOutput.length === 0) return null;
  if (error) return null;

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
