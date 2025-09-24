// LazyMedia component for efficient image and video loading
import React, { useState, useRef, useEffect, memo } from 'react';
import { Play } from 'lucide-react';

const LazyMedia = memo(({
  src,
  type = 'image',
  alt = '',
  className = '',
  style = {},
  placeholder,
  onLoad,
  onError,
  autoPlay = false,
  muted = true,
  controls = true,
  preload = 'metadata',
  adaptiveQuality = true,
  mobileOptimized = true,
  hoverToPlay = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('high');
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const mediaRef = useRef(null);

  const MAX_RETRIES = 2;

  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Detect network quality
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const updateNetworkQuality = () => {
        if (connection.effectiveType === '4g') {
          setNetworkQuality('high');
        } else if (connection.effectiveType === '3g') {
          setNetworkQuality('medium');
        } else {
          setNetworkQuality('low');
        }
      };
      
      updateNetworkQuality();
      connection.addEventListener('change', updateNetworkQuality);
      
      return () => {
        connection.removeEventListener('change', updateNetworkQuality);
      };
    }
  }, []);

  // Get optimized video attributes for mobile
  const getVideoAttributes = () => {
    const baseAttrs = {
      playsInline: true,
      webkit_playsinline: true,
      'x5-video-player-type': 'h5',
      'x5-video-player-fullscreen': 'true'
    };

    if (mobileOptimized && isMobile) {
      return {
        ...baseAttrs,
        poster: '', // Remove poster for faster loading
        preload: networkQuality === 'low' ? 'none' : preload,
        controlsList: 'nodownload noremoteplayback',
        disablePictureInPicture: true,
        crossOrigin: 'anonymous'
      };
    }

    return baseAttrs;
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px 0px'
      }
    );

    if (mediaRef.current) {
      observer.observe(mediaRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    setIsError(false);
    if (onLoad) onLoad();
  };

  const retryLoad = () => {
    if (retryCount < MAX_RETRIES) {
      setIsRetrying(true);
      setIsError(false);
      setRetryCount(prev => prev + 1);

      setTimeout(() => {
        setIsRetrying(false);
        if (mediaRef.current) {
          if (type === 'video') {
            mediaRef.current.load();
          } else {
            const currentSrc = mediaRef.current.src;
            mediaRef.current.src = '';
            mediaRef.current.src = currentSrc;
          }
        }
      }, 1000 * retryCount); // Exponential backoff
    }
  };

  const handleError = (event) => {
    const errorMsg = event.target?.error?.message || 'Network error';
    console.log(`🚨 Media load error (attempt ${retryCount + 1}):`, errorMsg);

    if (retryCount < MAX_RETRIES && errorMsg.includes('network')) {
      console.log(`📡 Retrying in ${1000 * (retryCount + 1)}ms...`);
      retryLoad();
    } else {
      setIsError(true);
      setIsLoaded(false);
      if (onError) onError(event);
    }
  };

  // Handle hover-to-play functionality
  const handleMouseEnter = () => {
    if (hoverToPlay && type === 'video' && mediaRef.current) {
      setIsHovering(true);
      mediaRef.current.play().catch(() => {
        console.log('Hover play prevented, user interaction required');
      });
    }
  };

  const handleMouseLeave = () => {
    if (hoverToPlay && type === 'video' && mediaRef.current) {
      setIsHovering(false);
      mediaRef.current.pause();
      mediaRef.current.currentTime = 0; // Reset to beginning
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <div 
        className="flex items-center justify-center bg-gray-100"
        style={{ 
          width: '100%', 
          height: '200px',
          ...style 
        }}
      >
        <div className="text-center">
          {!isError && !isRetrying ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading {type}...</p>
            </>
          ) : isRetrying ? (
            <>
              <div className="animate-pulse h-8 w-8 bg-orange-200 rounded-full mx-auto mb-2 flex items-center justify-center">
                <span className="text-sm">📡</span>
              </div>
              <p className="text-sm text-orange-600">Retrying... ({retryCount}/{MAX_RETRIES})</p>
            </>
          ) : (
            <>
              <div className="text-gray-400 text-4xl mb-2">
                {type === 'video' ? '📹' : '🖼️'}
              </div>
              <p className="text-sm text-gray-500">Network error loading {type}</p>
              {retryCount >= MAX_RETRIES && (
                <button
                  onClick={() => {
                    setRetryCount(0);
                    setIsError(false);
                    retryLoad();
                  }}
                  className="mt-2 px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                >
                  Try Again
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderMedia = () => {
    if (!isVisible || !src) {
      return renderPlaceholder();
    }

    if (type === 'video') {
      const videoAttrs = getVideoAttributes();
      
      return (
        <div 
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {!isLoaded && !isError && renderPlaceholder()}
          <video
            ref={mediaRef}
            src={src}
            className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
              ...style,
              transition: 'opacity 0.3s ease',
              // Mobile-specific optimizations
              ...(isMobile && mobileOptimized && {
                objectFit: 'contain',
                width: '100%',
                height: 'auto',
                maxHeight: '60vh'
              })
            }}
            onLoadedData={handleLoad}
            onError={handleError}
            onPlay={handlePlay}
            onPause={handlePause}
            onLoadStart={() => {
              // Adaptive quality: reduce autoplay on slow networks
              if (networkQuality === 'low' && autoPlay) {
                console.log('Slow network detected, reducing video quality');
              }
            }}
            onCanPlay={() => {
              // Video is ready to play
              if (isMobile && autoPlay && muted && !hoverToPlay) {
                // Ensure autoplay works on mobile (only if not hover-to-play)
                mediaRef.current?.play().catch(() => {
                  console.log('Autoplay prevented, user interaction required');
                });
              }
            }}
            autoPlay={autoPlay && networkQuality !== 'low' && !hoverToPlay}
            muted={muted}
            controls={controls && !hoverToPlay}
            preload={videoAttrs.preload}
            playsInline={videoAttrs.playsInline}
            webkitPlaysinline={videoAttrs.webkit_playsinline}
            x5VideoPlayerType={videoAttrs['x5-video-player-type']}
            x5VideoPlayerFullscreen={videoAttrs['x5-video-player-fullscreen']}
            controlsList={videoAttrs.controlsList}
            disablePictureInPicture={videoAttrs.disablePictureInPicture}
            crossOrigin={videoAttrs.crossOrigin}
            {...props}
          >
            Your browser does not support the video tag.
          </video>
          
          {/* Hover overlay for hover-to-play */}
          {hoverToPlay && !isPlaying && !isHovering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity">
              <div className="bg-white bg-opacity-90 rounded-full p-3">
                <Play className="w-6 h-6 text-gray-800" />
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default to image
    return (
      <div className="relative">
        {!isLoaded && !isError && renderPlaceholder()}
        <img
          ref={mediaRef}
          src={src}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            ...style,
            transition: 'opacity 0.3s ease'
          }}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          {...props}
        />
      </div>
    );
  };

  return (
    <div ref={mediaRef} className="lazy-media-container">
      {renderMedia()}
    </div>
  );
});

LazyMedia.displayName = 'LazyMedia';

export default LazyMedia;