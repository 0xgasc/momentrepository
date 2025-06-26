// Wallet Connection Component
// File: src/components/WalletConnect.js

import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { Wallet, LogOut, AlertCircle, CheckCircle } from 'lucide-react';
import { NETWORKS } from '../../config/web3Config';

const WalletConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  const { data: balance } = useBalance({
    address: address,
  });

  const isCorrectNetwork = chainId === 84532; // Base Sepolia

  const handleConnect = async (connector) => {
    setIsConnecting(true);
    try {
      await connect({ connector });
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleNetworkSwitch = async () => {
    try {
      await switchChain({ chainId: 84532 });
    } catch (err) {
      console.error('Network switch failed:', err);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal) => {
    if (!bal) return '0';
    return parseFloat(bal.formatted).toFixed(4);
  };

  if (isConnected) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-gray-800">Connected</span>
          </div>
          <button
            onClick={() => disconnect()}
            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Address:</span>
            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
              {formatAddress(address)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Balance:</span>
            <span className="text-sm font-semibold">
              {formatBalance(balance)} ETH
            </span>
          </div>
        </div>

        {!isCorrectNetwork && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Wrong Network
              </span>
            </div>
            <p className="text-xs text-yellow-700 mb-2">
              Please switch to Base Sepolia testnet to mint moments.
            </p>
            <button
              onClick={handleNetworkSwitch}
              className="w-full bg-yellow-600 text-white text-xs py-2 px-3 rounded-md hover:bg-yellow-700 transition-colors"
            >
              Switch to Base Sepolia
            </button>
          </div>
        )}

        {isCorrectNetwork && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Ready to mint on Base Sepolia
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm">
      <div className="text-center mb-6">
        <Wallet className="w-12 h-12 text-blue-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Connect Wallet
        </h3>
        <p className="text-sm text-gray-600">
          Connect your wallet to mint UMO moments as NFTs
        </p>
      </div>

      <div className="space-y-3">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isConnecting}
            className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                <span>Connect with {connector.name}</span>
              </>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              Connection Error
            </span>
          </div>
          <p className="text-xs text-red-700 mt-1">
            {error.message}
          </p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          New to Web3?{' '}
          <a
            href="https://www.coinbase.com/wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Get Coinbase Wallet
          </a>
        </p>
      </div>
    </div>
  );
};

// Compact version for header/mobile
export const WalletConnectCompact = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === 84532;

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="text-sm font-mono">
          {address?.slice(0, 6)}...
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-gray-500 hover:text-red-500"
        >
          <LogOut className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm hover:bg-blue-700 transition-colors">
      <Wallet className="w-3 h-3" />
      <span>Connect</span>
    </button>
  );
};

export default WalletConnect;