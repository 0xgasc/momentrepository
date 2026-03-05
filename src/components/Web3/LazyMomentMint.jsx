// Direct import to avoid lazy loading issues in production
import React from 'react';
import MomentMint from './MomentMint';

const LazyMomentMint = (props) => {
  return <MomentMint {...props} />;
};

LazyMomentMint.displayName = 'LazyMomentMint';

export default LazyMomentMint;