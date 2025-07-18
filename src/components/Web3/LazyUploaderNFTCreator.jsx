// Lazy-loaded UploaderNFTCreator component for code splitting
import React, { Suspense, lazy } from 'react';

// Lazy load the UploaderNFTCreator component
const UploaderNFTCreator = lazy(() => import('./UploaderNFTCreator'));

// Loading fallback component
const CreatorLoadingFallback = () => (
  <div className="flex items-center justify-center p-4">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-sm text-gray-500">Loading NFT creator...</p>
    </div>
  </div>
);

// Wrapper component that handles lazy loading
const LazyUploaderNFTCreator = (props) => {
  return (
    <Suspense fallback={<CreatorLoadingFallback />}>
      <UploaderNFTCreator {...props} />
    </Suspense>
  );
};

LazyUploaderNFTCreator.displayName = 'LazyUploaderNFTCreator';

export default LazyUploaderNFTCreator;