// src/components/UI/AsciiVideoOverlay.jsx — ASCII effect overlay using blob URL to bypass CORS taint
import React, { useState, useEffect, useRef, useCallback } from 'react';

const ASCII_CHARS = ' .:-=+*#%@';

const AsciiVideoOverlay = ({ videoRef, active, cols: propCols, isMobile, src }) => {
  const canvasRef = useRef(null);
  const blobVideoRef = useRef(null);
  const animationRef = useRef(null);
  const [asciiOutput, setAsciiOutput] = useState([]);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const getAsciiChar = useCallback((brightness) => {
    const index = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
    return ASCII_CHARS[index];
  }, []);

  // Fetch video as blob to get same-origin URL (bypasses canvas taint)
  useEffect(() => {
    if (!active || !src || blobUrl) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetch(src)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [active, src, blobUrl]);

  // Clean up blob URL
  useEffect(() => {
    if (!active && blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  }, [active, blobUrl]);

  const processFrame = useCallback(() => {
    if (!active) return;

    const video = blobVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended || video.readyState < 2 || video.videoWidth === 0) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Sync blob video time with the main video
    const mainVideo = videoRef?.current;
    if (mainVideo && Math.abs(video.currentTime - mainVideo.currentTime) > 0.5) {
      video.currentTime = mainVideo.currentTime;
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
      console.warn('ASCII frame error:', e.message);
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, active, propCols, isMobile, getAsciiChar]);

  // Start animation loop when blob video is playing
  useEffect(() => {
    if (!active || !blobUrl) return;

    const video = blobVideoRef.current;
    if (!video) return;

    const startLoop = () => {
      animationRef.current = requestAnimationFrame(processFrame);
    };

    // Sync with main video position
    const mainVideo = videoRef?.current;
    if (mainVideo) {
      video.currentTime = mainVideo.currentTime;
      video.muted = true;
      video.play().then(startLoop).catch(() => {
        // Autoplay blocked, start loop anyway (will wait for readyState)
        startLoop();
      });
    } else {
      video.muted = true;
      video.play().then(startLoop).catch(startLoop);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active, blobUrl, processFrame, videoRef]);

  // Clean up on deactivate
  useEffect(() => {
    if (!active) {
      setAsciiOutput([]);
      if (blobVideoRef.current) {
        blobVideoRef.current.pause();
      }
    }
  }, [active]);

  if (!active) return null;

  const fontSize = isMobile ? 5 : 7;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* Hidden blob video for canvas reading (same-origin, no taint) */}
      {blobUrl && (
        <video
          ref={blobVideoRef}
          src={blobUrl}
          muted
          playsInline
          style={{ display: 'none' }}
        />
      )}

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
        {loading && (
          <div style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: '14px' }}>
            Loading ASCII...
          </div>
        )}
        {failed && (
          <div style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '12px' }}>
            ASCII unavailable for this video
          </div>
        )}
        {asciiOutput.length > 0 && (
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
        )}
      </div>
    </>
  );
};

export default AsciiVideoOverlay;
