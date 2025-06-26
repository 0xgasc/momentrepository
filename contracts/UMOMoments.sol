// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UMO Moments NFT Contract
 * @dev Time-limited open edition NFTs for UMO performance moments
 * @dev Integrates with 0xSplits for revenue distribution
 */
contract UMOMoments is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    
    uint256 private _tokenIdCounter;
    
    struct MomentEdition {
        string momentId;           // Original moment ID from database
        string metadataURI;        // IPFS/Arweave metadata URI
        uint256 mintPrice;         // Price per mint in wei
        uint256 mintStartTime;     // Unix timestamp when minting opens
        uint256 mintEndTime;       // Unix timestamp when minting closes
        uint256 maxSupply;         // Max NFTs that can be minted (0 = unlimited)
        uint256 currentSupply;     // Current number minted
        address splitsContract;    // 0xSplits contract for this moment
        bool isActive;             // Can be disabled by admin
        uint8 rarity;              // 1-7 rarity score from original moment
    }
    
    // Mapping from moment ID to edition details
    mapping(string => MomentEdition) public momentEditions;
    
    // Mapping from token ID to moment ID
    mapping(uint256 => string) public tokenToMoment;
    
    // Mapping to track mints per address per moment (for limiting)
    mapping(string => mapping(address => uint256)) public mintsPerWallet;
    
    // Events
    event MomentEditionCreated(
        string indexed momentId,
        uint256 mintPrice,
        uint256 mintStartTime,
        uint256 mintEndTime,
        address splitsContract
    );
    
    event MomentMinted(
        uint256 indexed tokenId,
        string indexed momentId,
        address indexed minter,
        uint256 price
    );
    
    event EditionUpdated(string indexed momentId, bool isActive);
    
    // Modifiers
    modifier validMoment(string memory momentId) {
        require(bytes(momentEditions[momentId].momentId).length > 0, "Moment does not exist");
        _;
    }
    
    modifier mintingActive(string memory momentId) {
        MomentEdition memory edition = momentEditions[momentId];
        require(edition.isActive, "Edition is not active");
        require(
            block.timestamp >= edition.mintStartTime && 
            block.timestamp <= edition.mintEndTime, 
            "Minting window is closed"
        );
        _;
    }
    
    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable() {
        _tokenIdCounter = 1; // Start token IDs at 1
    }
    
    /**
     * @dev Create a new moment edition for minting
     * @param momentId Unique identifier for the moment
     * @param metadataURI IPFS/Arweave URI for metadata
     * @param mintPrice Price per mint in wei
     * @param mintDuration Duration of mint window in seconds
     * @param maxSupply Maximum supply (0 for unlimited)
     * @param splitsContract Address of 0xSplits contract for revenue
     * @param rarity Rarity score 1-7 from original moment
     */
    function createMomentEdition(
        string memory momentId,
        string memory metadataURI,
        uint256 mintPrice,
        uint256 mintDuration,
        uint256 maxSupply,
        address splitsContract,
        uint8 rarity
    ) external onlyOwner {
        require(bytes(momentEditions[momentId].momentId).length == 0, "Edition already exists");
        require(rarity >= 1 && rarity <= 7, "Invalid rarity score");
        require(splitsContract != address(0), "Invalid splits contract");
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + mintDuration;
        
        momentEditions[momentId] = MomentEdition({
            momentId: momentId,
            metadataURI: metadataURI,
            mintPrice: mintPrice,
            mintStartTime: startTime,
            mintEndTime: endTime,
            maxSupply: maxSupply,
            currentSupply: 0,
            splitsContract: splitsContract,
            isActive: true,
            rarity: rarity
        });
        
        emit MomentEditionCreated(
            momentId,
            mintPrice,
            startTime,
            endTime,
            splitsContract
        );
    }
    
    /**
     * @dev Mint a moment NFT
     * @param momentId The moment to mint
     * @param quantity Number of NFTs to mint
     */
    function mintMoment(
        string memory momentId,
        uint256 quantity
    ) external payable nonReentrant validMoment(momentId) mintingActive(momentId) {
        require(quantity > 0 && quantity <= 10, "Invalid quantity"); // Limit per transaction
        
        MomentEdition storage edition = momentEditions[momentId];
        
        // Check supply limits
        if (edition.maxSupply > 0) {
            require(
                edition.currentSupply + quantity <= edition.maxSupply,
                "Exceeds max supply"
            );
        }
        
        // Check payment
        uint256 totalCost = edition.mintPrice * quantity;
        require(msg.value >= totalCost, "Insufficient payment");
        
        // Mint NFTs
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;
            
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, edition.metadataURI);
            tokenToMoment[tokenId] = momentId;
            
            emit MomentMinted(tokenId, momentId, msg.sender, edition.mintPrice);
        }
        
        edition.currentSupply += quantity;
        mintsPerWallet[momentId][msg.sender] += quantity;
        
        // Forward payment to splits contract
        if (msg.value > 0) {
            (bool success, ) = edition.splitsContract.call{value: msg.value}("");
            require(success, "Payment forwarding failed");
        }
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
    }
    
    /**
     * @dev Update edition settings (admin only)
     */
    function updateEdition(
        string memory momentId,
        uint256 newMintPrice,
        uint256 newEndTime,
        bool isActive
    ) external onlyOwner validMoment(momentId) {
        MomentEdition storage edition = momentEditions[momentId];
        
        if (newMintPrice > 0) {
            edition.mintPrice = newMintPrice;
        }
        
        if (newEndTime > block.timestamp) {
            edition.mintEndTime = newEndTime;
        }
        
        edition.isActive = isActive;
        
        emit EditionUpdated(momentId, isActive);
    }
    
    /**
     * @dev Get edition details for a moment
     */
    function getEdition(string memory momentId) 
        external 
        view 
        returns (MomentEdition memory) 
    {
        return momentEditions[momentId];
    }
    
    /**
     * @dev Check if minting is currently active for a moment
     */
    function isMintingActive(string memory momentId) 
        external 
        view 
        returns (bool) 
    {
        MomentEdition memory edition = momentEditions[momentId];
        return edition.isActive && 
               block.timestamp >= edition.mintStartTime && 
               block.timestamp <= edition.mintEndTime;
    }
    
    /**
     * @dev Get total minted count for a moment
     */
    function getTotalMinted(string memory momentId) 
        external 
        view 
        returns (uint256) 
    {
        return momentEditions[momentId].currentSupply;
    }
    
    /**
     * @dev Get user's mint count for a specific moment
     */
    function getUserMintCount(string memory momentId, address user)
        external
        view
        returns (uint256)
    {
        return mintsPerWallet[momentId][user];
    }
    
    /**
     * @dev Get current token ID counter
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev Emergency pause for specific moment (admin only)
     */
    function pauseMoment(string memory momentId) 
        external 
        onlyOwner 
        validMoment(momentId) 
    {
        momentEditions[momentId].isActive = false;
        emit EditionUpdated(momentId, false);
    }
    
    /**
     * @dev Resume minting for specific moment (admin only)
     */
    function resumeMoment(string memory momentId) 
        external 
        onlyOwner 
        validMoment(momentId) 
    {
        momentEditions[momentId].isActive = true;
        emit EditionUpdated(momentId, true);
    }
    
    // Required overrides
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}