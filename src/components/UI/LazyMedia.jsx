// LazyMedia component for efficient image and video loading
import React, { useState, useRef, useEffect, memo } from 'react';

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
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('high');
  const mediaRef = useRef(null);

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

  const handleError = () => {
    setIsError(true);
    setIsLoaded(false);
    if (onError) onError();
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
          {!isError ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading {type}...</p>
            </>
          ) : (
            <>
              <div className="text-gray-400 text-4xl mb-2">
                {type === 'video' ? '📹' : '🖼️'}
              </div>
              <p className="text-sm text-gray-500">Failed to load {type}</p>
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
        <div className="relative">
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
            onLoadStart={() => {
              // Adaptive quality: reduce autoplay on slow networks
              if (networkQuality === 'low' && autoPlay) {
                console.log('Slow network detected, reducing video quality');
              }
            }}
            onCanPlay={() => {
              // Video is ready to play
              if (isMobile && autoPlay && muted) {
                // Ensure autoplay works on mobile
                mediaRef.current?.play().catch(() => {
                  console.log('Autoplay prevented, user interaction required');
                });
              }
            }}
            autoPlay={autoPlay && networkQuality !== 'low'}
            muted={muted}
            controls={controls}
            preload={videoAttrs.preload}
            playsInline={videoAttrs.playsInline}
            webkit-playsinline={videoAttrs.webkit_playsinline}
            x5-video-player-type={videoAttrs['x5-video-player-type']}
            x5-video-player-fullscreen={videoAttrs['x5-video-player-fullscreen']}
            controlsList={videoAttrs.controlsList}
            disablePictureInPicture={videoAttrs.disablePictureInPicture}
            crossOrigin={videoAttrs.crossOrigin}
            {...props}
          >
            Your browser does not support the video tag.
          </video>
          
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