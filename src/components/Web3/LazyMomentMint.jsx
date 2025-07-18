// Lazy-loaded MomentMint component for code splitting
import React, { Suspense, lazy } from 'react';

// Lazy load the MomentMint component
const MomentMint = lazy(() => import('./MomentMint'));

// Loading fallback component
const MintLoadingFallback = () => (
  <div className="flex items-center justify-center p-4">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-sm text-gray-500">Loading NFT controls...</p>
    </div>
  </div>
);

// Wrapper component that handles lazy loading
const LazyMomentMint = (props) => {
  return (
    <Suspense fallback={<MintLoadingFallback />}>
      <MomentMint {...props} />
    </Suspense>
  );
};

LazyMomentMint.displayName = 'LazyMomentMint';

export default LazyMomentMint;