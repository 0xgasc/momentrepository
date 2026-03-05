// Direct import to avoid lazy loading issues in production
import React from 'react';
import WalletConnect from './WalletConnect';

const LazyWalletConnect = (props) => {
  return <WalletConnect {...props} />;
};

LazyWalletConnect.displayName = 'LazyWalletConnect';

export default LazyWalletConnect;