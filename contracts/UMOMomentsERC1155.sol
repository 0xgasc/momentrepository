// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title UMO Moments ERC1155 Contract
 * @dev Time-limited open edition NFTs for UMO performance moments
 * @dev Each moment gets a unique token ID, multiple mints increase supply
 * @dev Integrates with 0xSplits for revenue distribution
 */
contract UMOMomentsERC1155 is ERC1155, Ownable, ReentrancyGuard {
    using Strings for uint256;
    
    uint256 private _currentTokenId;
    
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
        address creator;           // Address that created this edition
    }
    
    // Mapping from token ID to edition details
    mapping(uint256 => MomentEdition) public momentEditions;
    
    // Mapping from moment database ID to token ID
    mapping(string => uint256) public momentIdToTokenId;
    
    // Mapping from token ID to moment database ID
    mapping(uint256 => string) public tokenIdToMomentId;
    
    // Mapping to track mints per address per token (for limiting)
    mapping(uint256 => mapping(address => uint256)) public mintsPerWallet;
    
    // Events
    event MomentEditionCreated(
        uint256 indexed tokenId,
        string indexed momentId,
        uint256 mintPrice,
        uint256 mintStartTime,
        uint256 mintEndTime,
        address splitsContract,
        address indexed creator
    );
    
    event MomentMinted(
        uint256 indexed tokenId,
        string indexed momentId,
        address indexed minter,
        uint256 quantity,
        uint256 price
    );
    
    event EditionUpdated(uint256 indexed tokenId, bool isActive);
    
    // Modifiers
    modifier validToken(uint256 tokenId) {
        require(tokenId < _currentTokenId, "Token does not exist");
        _;
    }
    
    modifier mintingActive(uint256 tokenId) {
        MomentEdition memory edition = momentEditions[tokenId];
        require(edition.isActive, "Edition is not active");
        require(
            block.timestamp >= edition.mintStartTime && 
            block.timestamp <= edition.mintEndTime, 
            "Minting window is closed"
        );
        _;
    }
    
    constructor(
        string memory baseURI
    ) ERC1155(baseURI) Ownable() {
        _currentTokenId = 0; // Start token IDs at 0
    }
    
    /**
     * @dev Create a new moment edition for minting
     * @param momentId Unique identifier for the moment from database
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
    ) external onlyOwner returns (uint256) {
        require(momentIdToTokenId[momentId] == 0 && _currentTokenId > 0 || bytes(momentId).length > 0, "Invalid moment ID");
        require(rarity >= 1 && rarity <= 7, "Invalid rarity score");
        require(splitsContract != address(0), "Invalid splits contract");
        
        uint256 tokenId = _currentTokenId;
        _currentTokenId++;
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + mintDuration;
        
        momentEditions[tokenId] = MomentEdition({
            momentId: momentId,
            metadataURI: metadataURI,
            mintPrice: mintPrice,
            mintStartTime: startTime,
            mintEndTime: endTime,
            maxSupply: maxSupply,
            currentSupply: 0,
            splitsContract: splitsContract,
            isActive: true,
            rarity: rarity,
            creator: msg.sender
        });
        
        // Create bidirectional mapping
        momentIdToTokenId[momentId] = tokenId;
        tokenIdToMomentId[tokenId] = momentId;
        
        emit MomentEditionCreated(
            tokenId,
            momentId,
            mintPrice,
            startTime,
            endTime,
            splitsContract,
            msg.sender
        );
        
        return tokenId;
    }
    
    /**
     * @dev Mint a moment NFT
     * @param tokenId The token ID to mint
     * @param quantity Number of NFTs to mint
     */
    function mintMoment(
        uint256 tokenId,
        uint256 quantity
    ) public payable nonReentrant validToken(tokenId) mintingActive(tokenId) {
        require(quantity > 0 && quantity <= 10, "Invalid quantity"); // Limit per transaction
        
        MomentEdition storage edition = momentEditions[tokenId];
        
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
        _mint(msg.sender, tokenId, quantity, "");
        
        // Update supply and tracking
        edition.currentSupply += quantity;
        mintsPerWallet[tokenId][msg.sender] += quantity;
        
        emit MomentMinted(tokenId, edition.momentId, msg.sender, quantity, edition.mintPrice);
        
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
     * @dev Mint by moment database ID (for backwards compatibility)
     */
    function mintMomentById(
        string memory momentId,
        uint256 quantity
    ) external payable {
        uint256 tokenId = momentIdToTokenId[momentId];
        require(tokenId > 0 || (tokenId == 0 && keccak256(bytes(tokenIdToMomentId[0])) == keccak256(bytes(momentId))), "Moment not found");
        mintMoment(tokenId, quantity);
    }
    
    /**
     * @dev Update edition settings (admin only)
     */
    function updateEdition(
        uint256 tokenId,
        uint256 newMintPrice,
        uint256 newEndTime,
        bool isActive
    ) external onlyOwner validToken(tokenId) {
        MomentEdition storage edition = momentEditions[tokenId];
        
        if (newMintPrice > 0) {
            edition.mintPrice = newMintPrice;
        }
        
        if (newEndTime > block.timestamp) {
            edition.mintEndTime = newEndTime;
        }
        
        edition.isActive = isActive;
        
        emit EditionUpdated(tokenId, isActive);
    }
    
    /**
     * @dev Get edition details for a token
     */
    function getEdition(uint256 tokenId) 
        external 
        view 
        validToken(tokenId)
        returns (MomentEdition memory) 
    {
        return momentEditions[tokenId];
    }
    
    /**
     * @dev Get edition details by moment database ID
     */
    function getEditionByMomentId(string memory momentId) 
        external 
        view 
        returns (MomentEdition memory) 
    {
        uint256 tokenId = momentIdToTokenId[momentId];
        require(tokenId > 0 || (tokenId == 0 && keccak256(bytes(tokenIdToMomentId[0])) == keccak256(bytes(momentId))), "Moment not found");
        return momentEditions[tokenId];
    }
    
    /**
     * @dev Check if minting is currently active for a token
     */
    function isMintingActive(uint256 tokenId) 
        external 
        view 
        validToken(tokenId)
        returns (bool) 
    {
        MomentEdition memory edition = momentEditions[tokenId];
        return edition.isActive && 
               block.timestamp >= edition.mintStartTime && 
               block.timestamp <= edition.mintEndTime;
    }
    
    /**
     * @dev Check if minting is active by moment database ID
     */
    function isMintingActiveByMomentId(string memory momentId) 
        external 
        view 
        returns (bool) 
    {
        uint256 tokenId = momentIdToTokenId[momentId];
        require(tokenId > 0 || (tokenId == 0 && keccak256(bytes(tokenIdToMomentId[0])) == keccak256(bytes(momentId))), "Moment not found");
        return this.isMintingActive(tokenId);
    }
    
    /**
     * @dev Get total minted count for a token
     */
    function getTotalMinted(uint256 tokenId) 
        external 
        view 
        validToken(tokenId)
        returns (uint256) 
    {
        return momentEditions[tokenId].currentSupply;
    }
    
    /**
     * @dev Get total minted by moment database ID
     */
    function getTotalMintedByMomentId(string memory momentId) 
        external 
        view 
        returns (uint256) 
    {
        uint256 tokenId = momentIdToTokenId[momentId];
        require(tokenId > 0 || (tokenId == 0 && keccak256(bytes(tokenIdToMomentId[0])) == keccak256(bytes(momentId))), "Moment not found");
        return momentEditions[tokenId].currentSupply;
    }
    
    /**
     * @dev Get user's mint count for a specific token
     */
    function getUserMintCount(uint256 tokenId, address user)
        external
        view
        validToken(tokenId)
        returns (uint256)
    {
        return mintsPerWallet[tokenId][user];
    }
    
    /**
     * @dev Get current token ID counter
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _currentTokenId;
    }
    
    /**
     * @dev Get next available token ID
     */
    function getNextTokenId() external view returns (uint256) {
        return _currentTokenId;
    }
    
    /**
     * @dev Emergency pause for specific token (admin only)
     */
    function pauseToken(uint256 tokenId) 
        external 
        onlyOwner 
        validToken(tokenId) 
    {
        momentEditions[tokenId].isActive = false;
        emit EditionUpdated(tokenId, false);
    }
    
    /**
     * @dev Resume minting for specific token (admin only)
     */
    function resumeToken(uint256 tokenId) 
        external 
        onlyOwner 
        validToken(tokenId) 
    {
        momentEditions[tokenId].isActive = true;
        emit EditionUpdated(tokenId, true);
    }
    
    /**
     * @dev Override URI to use individual metadata URIs
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < _currentTokenId, "Token does not exist");
        return momentEditions[tokenId].metadataURI;
    }
    
    /**
     * @dev Set base URI (admin only)
     */
    function setURI(string memory newURI) public onlyOwner {
        _setURI(newURI);
    }
    
    /**
     * @dev Get all tokens owned by an address with quantities
     */
    function getOwnedTokens(address owner) external view returns (uint256[] memory tokenIds, uint256[] memory quantities) {
        uint256 count = 0;
        
        // First pass: count how many tokens the user owns
        for (uint256 i = 0; i < _currentTokenId; i++) {
            if (balanceOf(owner, i) > 0) {
                count++;
            }
        }
        
        // Second pass: populate arrays
        tokenIds = new uint256[](count);
        quantities = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _currentTokenId; i++) {
            uint256 balance = balanceOf(owner, i);
            if (balance > 0) {
                tokenIds[index] = i;
                quantities[index] = balance;
                index++;
            }
        }
    }
    
    /**
     * @dev Batch mint multiple tokens (admin only)
     */
    function batchMint(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory quantities
    ) external onlyOwner {
        _mintBatch(to, tokenIds, quantities, "");
    }
    
    /**
     * @dev Check if token exists
     */
    function exists(uint256 tokenId) public view returns (bool) {
        return tokenId < _currentTokenId;
    }
    
    /**
     * @dev Get token supply
     */
    function totalSupply(uint256 tokenId) public view returns (uint256) {
        require(exists(tokenId), "Token does not exist");
        return momentEditions[tokenId].currentSupply;
    }
}