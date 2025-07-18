module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run serve',
      url: ['http://localhost:3000'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: ['uses-http2'],
        chromeFlags: '--no-sandbox --disable-dev-shm-usage'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        
        // Mobile specific
        'viewport': 'error',
        'tap-targets': 'error',
        
        // PWA
        'service-worker': 'warn',
        'installable-manifest': 'warn',
        'apple-touch-icon': 'warn',
        
        // Performance
        'uses-text-compression': 'warn',
        'uses-responsive-images': 'warn',
        'efficient-animated-content': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'warn',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'uses-webp-images': 'warn',
        'uses-optimized-images': 'warn',
        
        // Security
        'is-on-https': 'error',
        'no-vulnerable-libraries': 'error'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};