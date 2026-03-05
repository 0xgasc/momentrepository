// Direct import to avoid lazy loading issues in production
import React from 'react';
import UploaderNFTCreator from './UploaderNFTCreator';

const LazyUploaderNFTCreator = (props) => {
  return <UploaderNFTCreator {...props} />;
};

LazyUploaderNFTCreator.displayName = 'LazyUploaderNFTCreator';

export default LazyUploaderNFTCreator;