# Backend Update Guide for V2 Contract

## 1. Update Contract Reference

In `setlist-proxy/server.js`, update the contract import:

```javascript
// OLD:
const UMOMomentsERC1155Contract = require('../src/contracts/UMOMomentsERC1155.json');

// NEW (add both):
const UMOMomentsERC1155Contract = require('../src/contracts/UMOMomentsERC1155.json'); // Keep for old NFTs
const UMOMomentsERC1155V2Contract = require('../src/contracts/UMOMomentsERC1155V2.json'); // New NFTs
```

## 2. Update NFT Creation Function

In the `create-nft-edition-proxy` endpoint, change:

```javascript
// OLD:
const contract = new ethers.Contract(
  UMOMomentsERC1155Contract.address,
  UMOMomentsERC1155Contract.abi,
  devWallet
);

const transaction = await contract.createMomentEdition(
  moment._id.toString(),
  nftMetadataHash,
  mintPriceWei,
  mintDurationSeconds,
  0, // maxSupply (0 = unlimited)
  mockSplitsAddress, // This was the problem!
  rarityScore
);

// NEW:
const contract = new ethers.Contract(
  UMOMomentsERC1155V2Contract.address,
  UMOMomentsERC1155V2Contract.abi,
  devWallet
);

const transaction = await contract.createMomentEdition(
  moment._id.toString(),
  nftMetadataHash,
  mintPriceWei,
  mintDurationSeconds,
  0, // maxSupply (0 = unlimited)
  '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF', // UMO wallet
  uploaderAddress, // Creator wallet
  '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96' // Platform wallet (or your preferred platform wallet)
);
```

## 3. Frontend Updates

Update frontend minting to use new contract:

```javascript
// In MomentMint.js, add option to use V2 for new NFTs
const useV2Contract = moment.nftContractAddress === UMOMomentsERC1155V2Contract.address;
const contractConfig = useV2Contract ? UMOMomentsERC1155V2Contract : UMOMomentsERC1155Contract;
```

## 4. Testing Checklist

- [ ] Deploy V2 contract via Remix
- [ ] Update contract JSON with address and ABI
- [ ] Test creating new NFT (should use built-in splits)
- [ ] Test minting NFT (should auto-split revenue)
- [ ] Verify UMO gets 65%, creator gets 30%, platform gets 5%
- [ ] Verify unlimited minting works
- [ ] Keep old NFTs working on V1 contract