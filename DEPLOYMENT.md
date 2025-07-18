# UMO Archive Deployment Guide

This guide covers deploying the UMO Archive application with mobile PWA optimizations to various platforms.

## Quick Deploy

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
npm run deploy:vercel
```

### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
npm run deploy:netlify
```

## Pre-deployment Checklist

### 1. Build Optimization
```bash
# Test optimized mobile build
npm run build:mobile

# Analyze bundle size
npm run build:analyze

# Run performance audit
npm run lighthouse
```

### 2. Performance Targets
- **Performance Score**: ≥ 80
- **Accessibility Score**: ≥ 90
- **First Contentful Paint**: < 2.0s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Total Blocking Time**: < 300ms

### 3. Mobile PWA Features
- ✅ Service Worker registered
- ✅ Manifest.json configured
- ✅ Touch targets ≥ 44px
- ✅ Responsive design
- ✅ Lazy loading implemented
- ✅ Code splitting for Web3 components

## Platform-Specific Configuration

### Vercel
Configuration in `vercel.json`:
- Static asset caching (1 year)
- Security headers
- SPA routing
- Mobile-optimized compression

### Netlify
Configuration in `netlify.toml`:
- Build optimization
- Plugin for Lighthouse CI
- PWA support
- Image compression

## Environment Variables

Required environment variables:
```bash
REACT_APP_ENVIRONMENT=production
GENERATE_SOURCEMAP=false
INLINE_RUNTIME_CHUNK=false
```

## Performance Monitoring

### Lighthouse CI
Automated performance testing in CI/CD:
- Desktop and mobile audits
- Core Web Vitals monitoring
- PWA compliance checking
- Accessibility testing

### Bundle Analysis
```bash
# Check bundle sizes
npm run build:analyze

# Bundle size limits:
# - JS: 500kB (gzipped)
# - CSS: 50kB (gzipped)
```

## Troubleshooting

### Large Bundle Size
1. Check for duplicate dependencies
2. Verify code splitting is working
3. Remove unused imports
4. Use dynamic imports for heavy libraries

### Poor Performance Scores
1. Optimize images (WebP format)
2. Implement lazy loading
3. Minimize render-blocking resources
4. Use compression

### PWA Issues
1. Verify service worker registration
2. Check manifest.json validity
3. Ensure HTTPS deployment
4. Test offline functionality

## CI/CD Pipeline

The GitHub Actions workflow automatically:
1. Runs tests on multiple Node.js versions
2. Builds optimized production bundle
3. Performs Lighthouse CI audits
4. Deploys to Vercel and Netlify
5. Runs post-deployment performance checks

## Mobile-Specific Optimizations

### Service Worker
- Caches static assets for offline access
- Implements network-first strategy for API calls
- Provides background sync for failed uploads

### Lazy Loading
- Images and videos load only when visible
- Web3 components split into separate chunks
- Intersection Observer for optimal performance

### Touch Targets
- All interactive elements ≥ 44px
- Proper spacing between clickable elements
- Accessible focus states

### Responsive Design
- Mobile-first hamburger navigation
- Slide-up modals for mobile
- Optimized typography and spacing

## Post-Deployment Verification

1. **PWA Test**: Install app on mobile device
2. **Performance Test**: Run Lighthouse audit
3. **Functionality Test**: Test core features
4. **Offline Test**: Verify offline functionality
5. **Touch Test**: Verify all touch targets work properly

## Monitoring and Analytics

Consider integrating:
- Web Vitals monitoring
- Error tracking (Sentry)
- Performance monitoring (SpeedCurve)
- User analytics (Google Analytics 4)

## Security Considerations

- All deployments use HTTPS
- Security headers configured
- No source maps in production
- Environment variables secured
- XSS and CSRF protection enabled