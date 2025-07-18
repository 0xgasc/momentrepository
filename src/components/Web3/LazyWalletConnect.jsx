// Lazy-loaded WalletConnect component for code splitting
import React, { Suspense, lazy } from 'react';

// Lazy load the WalletConnect component
const WalletConnect = lazy(() => import('./WalletConnect'));

// Loading fallback component
const WalletLoadingFallback = () => (
  <div className="flex items-center justify-center p-2">
    <div className="text-center">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-1"></div>
      <p className="text-xs text-gray-500">Loading wallet...</p>
    </div>
  </div>
);

// Wrapper component that handles lazy loading
const LazyWalletConnect = (props) => {
  return (
    <Suspense fallback={<WalletLoadingFallback />}>
      <WalletConnect {...props} />
    </Suspense>
  );
};

LazyWalletConnect.displayName = 'LazyWalletConnect';

export default LazyWalletConnect;