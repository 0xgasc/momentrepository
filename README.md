# 🎵 UMO Archive - Decentralized Concert Moment Platform

A full-stack Web3 platform for uploading, sharing, and minting concert moments from Unknown Mortal Orchestra (UMO) performances. Built with React, Node.js, MongoDB, and Ethereum smart contracts.

## 🌟 Overview

UMO Archive allows fans to upload high-quality audio, video, and photos from UMO concerts, automatically calculates rarity scores based on performance frequency and content quality, and enables creators to mint their moments as NFTs with revenue sharing.

### Key Features

- **📁 Massive File Support**: Upload files up to 6GB to decentralized storage (Arweave/IPFS)
- **🎯 Smart Rarity System**: 3-factor scoring (file quality + song rarity + metadata completeness)
- **📊 Performance Database**: 300+ cached UMO performances from setlist.fm
- **🎨 NFT Minting**: ERC1155 editions with automatic revenue sharing via 0xSplits
- **🔍 Advanced Search**: Find performances by city, venue, song, or year
- **📱 Mobile-Responsive**: Optimized for all devices

## 🏗️ Architecture

```
┌─ Frontend (React) ─────────────────┐
│  • Web3 Integration (Wagmi)        │
│  • Performance Search & Discovery  │
│  • Moment Upload & Management      │
│  • NFT Minting Interface          │
└────────────────────────────────────┘
            │
┌─ Backend (Node.js/Express) ────────┐
│  • MongoDB Database                │
│  • setlist.fm API Integration     │
│  • Arweave/IPFS File Storage      │
│  • Smart 3-Factor Rarity Engine   │
│  • NFT Metadata Generation        │
└────────────────────────────────────┘
            │
┌─ Blockchain (Ethereum) ────────────┐
│  • ERC1155 NFT Smart Contracts    │
│  • 0xSplits Revenue Sharing       │
│  • Decentralized Metadata Storage │
└────────────────────────────────────┘
```

## 🚀 Tech Stack

### Frontend
- **React 19** - Modern React with hooks and concurrent features
- **Wagmi v2** - Web3 React hooks for Ethereum interaction
- **TanStack Query** - Server state management and caching
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Modern icon library

### Backend
- **Node.js + Express** - RESTful API server
- **MongoDB + Mongoose** - Document database with ODM
- **Multer** - Large file upload handling (6GB limit)
- **JWT** - Authentication and authorization
- **Irys (Arweave)** - Decentralized file storage

### Blockchain
- **Hardhat** - Ethereum development environment
- **OpenZeppelin** - Secure smart contract standards
- **ethers.js** - Ethereum library for backend integration
- **0xSplits** - Revenue sharing protocol

### External APIs
- **setlist.fm API** - Concert data and performance history
- **Arweave/IPFS** - Decentralized storage networks

## 📁 Project Structure

```
umo-archive/
├── src/                          # React Frontend
│   ├── components/
│   │   ├── Auth/                 # Authentication components
│   │   ├── Moment/               # Moment upload/display
│   │   ├── Performance/          # Concert performance views
│   │   ├── Song/                 # Song browser and details
│   │   └── Web3/                 # NFT minting components
│   ├── hooks/                    # Custom React hooks
│   ├── contracts/                # Contract ABIs for frontend
│   ├── config/                   # Configuration files
│   └── utils/                    # Utility functions
├── setlist-proxy/                # Node.js Backend
│   ├── server.js                 # Main Express server (47KB)
│   ├── models/                   # MongoDB schemas
│   │   ├── User.js               # User authentication
│   │   └── Moment.js             # Concert moment data
│   ├── utils/                    # Server utilities
│   │   ├── umoCache.js           # Performance caching
│   │   └── irysUploader.js       # File upload handling
│   └── umo-cache.json            # Cached performance data (2.4MB)
├── contracts/                    # Smart Contracts
│   ├── UMOMoments.sol            # Original ERC721 contract
│   └── UMOMomentsERC1155.sol     # Current ERC1155 edition contract
├── scripts/                      # Deployment scripts
├── test/                         # Smart contract tests
└── artifacts/                    # Compiled contract artifacts
```

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js 18+**
- **MongoDB** (local or Atlas)
- **Git**
- **MetaMask** browser extension

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/umo-archive.git
cd umo-archive
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd setlist-proxy
npm install
cd ..
```

### 3. Environment Configuration

Create `.env` in root directory:
```env
# Blockchain
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_wallet_private_key

# Database
MONGO_URI=mongodb://localhost:27017/umo-archive

# APIs
SETLIST_FM_API_KEY=your_setlist_fm_api_key
IRYS_PRIVATE_KEY=your_irys_private_key

# Authentication
JWT_SECRET=your_jwt_secret_key
```

Create `setlist-proxy/.env`:
```env
MONGO_URI=mongodb://localhost:27017/umo-archive
SETLIST_FM_API_KEY=your_setlist_fm_api_key
IRYS_PRIVATE_KEY=your_irys_private_key
JWT_SECRET=your_jwt_secret_key
```

### 4. Deploy Smart Contracts
```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

### 5. Start Development Servers

**Backend (Terminal 1):**
```bash
cd setlist-proxy
npm start
# Server runs on http://localhost:5050
```

**Frontend (Terminal 2):**
```bash
npm start
# App runs on http://localhost:3000
```

## 🎯 Key Features Deep Dive

### 3-Factor Rarity System
Our simplified rarity engine scores moments on three factors (0-6 points total):

**1. File Size Quality (0-2 points)**
- 500MB+ = 2.0 points (excellent quality)
- 100-500MB = 1.5 points (great quality)  
- 50-100MB = 1.0 point (good quality)
- 10-50MB = 0.5 points (decent quality)
- <10MB = 0.2 points (basic quality)

**2. Song/Content Rarity (0-2 points)**
- Based on setlist.fm performance frequency
- Ultra rare songs (1-10 performances) = 2.0 points
- Rare songs (11-50 performances) = 1.5 points
- Non-song content (jams, intros) scored by type

**3. Metadata Completeness (0-2 points)**
- 6 metadata fields: description, mood, occasion, instruments, crowd reaction, unique elements
- Score = (filled fields ÷ 6) × 2 points

**7-Tier Rarity Classification:**
- 🌟 **Legendary** (5.5-6.0) - Ultra rare, perfect quality
- 🔮 **Mythic** (4.8-5.4) - Extremely rare and well-documented  
- 💎 **Epic** (4.0-4.7) - Very rare with great quality
- 🔥 **Rare** (3.2-3.9) - Uncommon with good documentation
- ⭐ **Uncommon** (2.4-3.1) - Less common, decent quality
- 📀 **Common** (1.6-2.3) - Frequent performances, basic quality
- ⚪ **Basic** (0-1.5) - Very common, minimal metadata

### Smart Content Classification
The platform automatically distinguishes between:
- **🎵 Song Performances** - Actual songs from setlists
- **🎭 Intro/Outro Content** - Performance transitions
- **🎸 Jam/Improv Sections** - Extended musical explorations  
- **👥 Crowd Moments** - Audience reactions and interactions
- **🎪 Other Content** - Soundcheck, banter, technical moments

### NFT Edition System
- **ERC1155 Standard** - Efficient multi-edition NFTs
- **Revenue Sharing** - Automatic splits via 0xSplits protocol
- **Timed Minting** - Limited-time edition windows
- **Rich Metadata** - Comprehensive provenance and rarity data
- **Blockchain Proof** - Immutable ownership and authenticity

## 📡 API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User authentication
- `GET /profile` - User profile (authenticated)

### Moments
- `GET /moments` - Get all moments (paginated)
- `GET /moments/my` - Get user's moments (authenticated)
- `GET /moments/:momentId` - Get specific moment
- `GET /moments/performance/:performanceId` - Get moments for performance
- `GET /moments/song/:songName` - Get moments for song
- `POST /upload-moment` - Create new moment (authenticated)
- `PUT /moments/:momentId` - Update moment (authenticated)

### Performances
- `GET /cached/performances` - Get cached performance list
- `GET /cached/performance/:performanceId` - Get specific performance
- `GET /cached/songs` - Get song database with statistics

### File Upload
- `POST /upload-file` - Upload media file to Arweave (authenticated, 6GB limit)

### NFT Operations
- `GET /get-next-token-id` - Get next available token ID
- `POST /upload-metadata` - Store NFT metadata
- `GET /metadata/:metadataId` - Retrieve NFT metadata
- `POST /moments/:momentId/create-nft-edition-proxy` - Create NFT edition (authenticated)
- `GET /moments/:momentId/nft-status` - Check NFT status
- `POST /moments/:momentId/record-mint` - Record NFT mint (authenticated)

### Cache Management
- `GET /cache/status` - Check cache status
- `POST /cache/refresh` - Refresh performance cache

## 🗄️ Database Schema

### User Model
```javascript
{
  email: String (required, unique),
  displayName: String,
  passwordHash: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Moment Model
```javascript
{
  user: ObjectId (ref: 'User'),
  performanceId: String,
  performanceDate: String,
  venueName: String,
  venueCity: String,
  venueCountry: String,
  songName: String,
  contentType: enum ['song', 'intro', 'jam', 'crowd', 'other'],
  mediaUrl: String (Arweave/IPFS),
  mediaType: String,
  fileSize: Number,
  
  // Rarity Calculation
  rarityScore: Number (0-6),
  rarityTier: enum ['basic', 'common', 'uncommon', 'rare', 'epic', 'mythic', 'legendary'],
  songTotalPerformances: Number,
  
  // Metadata (6 fields for rarity)
  momentDescription: String,
  emotionalTags: String,
  specialOccasion: String,
  instruments: String,
  crowdReaction: String,
  uniqueElements: String,
  
  // NFT Data
  nftMinted: Boolean,
  nftTokenId: Number,
  nftContractAddress: String,
  nftMintPrice: String,
  nftMintDuration: Number,
  nftMintedCount: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 Development Commands

### Frontend
```bash
npm start              # Start development server
npm run build          # Build for production
npm test              # Run tests
```

### Backend
```bash
cd setlist-proxy
npm start              # Start Express server
npm run dev            # Start with nodemon (if configured)
```

### Smart Contracts
```bash
npx hardhat compile                    # Compile contracts
npx hardhat test                      # Run tests
npx hardhat run scripts/deploy.js     # Deploy locally
npx hardhat node                      # Start local blockchain
```

## 🌐 Deployment

### Frontend (Vercel/Netlify)
1. Build the React app: `npm run build`
2. Deploy the `build/` directory
3. Set environment variables in hosting platform

### Backend (Railway/Heroku)
1. Set up MongoDB Atlas database
2. Configure environment variables
3. Deploy `setlist-proxy/` directory

### Smart Contracts
```bash
# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia CONTRACT_ADDRESS
```

## 🎵 Usage Guide

### For Fans (Uploading Moments)
1. **Connect Wallet** - Link MetaMask to authenticate
2. **Find Performance** - Search by city, venue, or date
3. **Upload Content** - Drag & drop files up to 6GB
4. **Add Details** - Fill metadata for higher rarity scores
5. **Create NFT** - Mint limited editions and earn revenue

### For Collectors (Minting NFTs)
1. **Browse Moments** - Explore by performance or song
2. **Check Rarity** - View 7-tier classification system
3. **Mint Editions** - Purchase during limited-time windows
4. **Trade & Collect** - Own authentic concert history

### For Developers
1. **Clone Repository** - Follow setup instructions above
2. **Local Development** - Run frontend + backend + blockchain
3. **Smart Contracts** - Deploy and test on Sepolia
4. **Contribute** - Submit PRs for new features

## 🛡️ Security Features

- **JWT Authentication** - Secure user sessions
- **File Validation** - Comprehensive upload security
- **Smart Contract Auditing** - OpenZeppelin standards
- **Rate Limiting** - API protection
- **Input Sanitization** - XSS/injection prevention
- **Wallet Signatures** - Cryptographic user verification

## 🔮 Future Roadmap

### Phase 1: Core Platform ✅
- [x] Basic moment upload and display
- [x] Performance database integration
- [x] 3-factor rarity system
- [x] ERC1155 NFT minting

### Phase 2: Enhanced Features 🚧
- [ ] Mobile app (React Native)
- [ ] Advanced search filters
- [ ] User profiles and following
- [ ] Moment collections and playlists

### Phase 3: Community 🔄
- [ ] User ratings and reviews
- [ ] Community moderation tools
- [ ] Social features and sharing
- [ ] Integration with music streaming

### Phase 4: Expansion 🎯
- [ ] Multi-artist support
- [ ] LiveNation API integration
- [ ] Advanced analytics dashboard
- [ ] Marketplace for trading moments

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting
- **Conventional Commits** - Commit message format
- **Smart Contract Testing** - Hardhat test coverage

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Unknown Mortal Orchestra** - For creating amazing music worth preserving
- **setlist.fm** - For comprehensive performance data
- **OpenZeppelin** - For secure smart contract standards
- **Arweave** - For permanent decentralized storage
- **The UMO Community** - For sharing incredible concert moments

## 🐛 Current Issues & Next Session TODOs

### ✅ **COMPLETED: NFT System 100% Functional**

**🎉 MAJOR SESSION ACCOMPLISHMENTS:**

**1. Fixed Complete NFT Minting Pipeline**:
- ✅ Wagmi v2 integration with proper `writeContractData` usage
- ✅ MetaMask confirmation flow works perfectly
- ✅ Database mint counts sync in real-time
- ✅ UI updates without page reloads

**2. Fixed NFT Card Generation**:
- ✅ Preview system now connects to creation system
- ✅ No more "purple circles" on OpenSea - proper random seed generation
- ✅ Clear UX: Users see if using preview or random design
- ✅ Button text shows: "Create NFT (Use Preview)" vs "Create NFT (Random Card)"

**3. Enhanced User Experience**:
- ✅ OpenSea links for all minted NFTs (`https://testnets.opensea.io/assets/base_sepolia/{contract}/{tokenId}`)
- ✅ Manual fix buttons for mint count discrepancies
- ✅ Debug info showing `(DB: X, History: Y)` 
- ✅ Proper error handling and recovery

**4. Database & Backend Fixes**:
- ✅ Fixed `/record-mint` endpoint validation (`nftTokenId` check)
- ✅ Added manual `/fix-mint-count` endpoint for historical data
- ✅ Comprehensive mint history tracking

**🎯 SYSTEM STATUS: FULLY OPERATIONAL**
All NFT functionality working end-to-end with proper blockchain integration, database sync, and user experience.

### 🚀 **Next Development Focus: Dynamic NFT Pricing**

**Current Fixed Price**: All NFTs mint for 0.001 ETH (~$1 USD)

**Planned Dynamic Pricing Features**:
- **Rarity-based pricing**: Higher rarity tiers cost more to mint
- **Time decay**: Price increases as minting window progresses  
- **Supply-based**: Price increases with each mint (bonding curve)
- **Venue/date premium**: Special shows have higher base prices

**Key Files for Dynamic Pricing**:
- `src/components/Web3/MomentMint.js` - Update mint price calculation
- `setlist-proxy/server.js` - Update create-nft-edition endpoint pricing logic
- `contracts/UMOMomentsERC1155.sol` - Modify contract pricing if needed

### 🏗️ **Current Architecture Status**:
- **Smart Contract**: ERC1155 on Base Sepolia (`0x5417E6db8cF893ac2a11BBd9970c4bd7defc6F39`)
- **Storage**: Irys devnet (`devnet.irys.xyz`) 
- **Database**: MongoDB with comprehensive moment schema
- **Frontend**: React with Wagmi v2 for Web3 integration (FULLY WORKING)
- **Backend**: Express server with NFT card generation
- **Minting**: End-to-end functional with proper database sync

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/yourusername/umo-archive/issues)
- **Documentation**: [Project Wiki](https://github.com/yourusername/umo-archive/wiki)
- **Community**: [Discord Server](https://discord.gg/umo-archive)
- **Email**: support@umo-archive.com

---

**Built with ❤️ by the UMO Archive team**

*Preserving concert history, one moment at a time.*