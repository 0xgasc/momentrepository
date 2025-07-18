// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UMO Moments ERC1155 V2 with Built-in Revenue Splits
 * @dev Enhanced version with automatic revenue splitting on mint
 */
contract UMOMomentsERC1155V2 is ERC1155, Ownable, ReentrancyGuard {
    
    // Revenue split configuration
    struct RevenueSplit {
        address umoWallet;      // 65%
        address creatorWallet;  // 30% 
        address platformWallet; // 5%
        uint256 umoPercentage;     // 650000 (65% * 10000)
        uint256 creatorPercentage; // 300000 (30% * 10000)
        uint256 platformPercentage; // 50000 (5% * 10000)
    }
    
    // Edition structure (same as V1)
    struct MomentEdition {
        string momentId;
        string metadataURI;
        uint256 mintPrice;
        uint256 mintDuration;
        uint256 maxSupply;
        uint256 totalMinted;
        uint256 startTime;
        bool isActive;
        RevenueSplit splits; // NEW: Built-in splits
    }
    
    // State variables
    mapping(uint256 => MomentEdition) public momentEditions;
    mapping(string => uint256) public momentIdToTokenId;
    mapping(uint256 => string) public tokenIdToMomentId;
    mapping(uint256 => mapping(address => uint256)) public mintsPerWallet;
    
    uint256 private _currentTokenId;
    
    // Events
    event MomentEditionCreated(
        uint256 indexed tokenId,
        string momentId,
        uint256 mintPrice,
        address umoWallet,
        address creatorWallet
    );
    
    event RevenueSplitExecuted(
        uint256 indexed tokenId,
        address umoWallet,
        address creatorWallet, 
        address platformWallet,
        uint256 umoAmount,
        uint256 creatorAmount,
        uint256 platformAmount
    );
    
    event WalletsUpdated(
        uint256 indexed tokenId,
        address oldUmoWallet,
        address oldCreatorWallet,
        address oldPlatformWallet,
        address newUmoWallet,
        address newCreatorWallet,
        address newPlatformWallet
    );
    
    event PercentagesUpdated(
        uint256 indexed tokenId,
        uint256 newUmoPercentage,
        uint256 newCreatorPercentage,
        uint256 newPlatformPercentage
    );
    
    event MintPriceUpdated(
        uint256 indexed tokenId,
        uint256 oldPrice,
        uint256 newPrice
    );
    
    event MintingDurationExtended(
        uint256 indexed tokenId,
        uint256 additionalSeconds
    );
    
    event EmergencyWithdrawal(
        address indexed owner,
        uint256 amount
    );
    
    constructor(string memory baseURI) ERC1155(baseURI) {}
    
    /**
     * @dev Create a new moment edition with revenue splits
     */
    function createMomentEdition(
        string memory momentId,
        string memory metadataURI,
        uint256 mintPrice,
        uint256 mintDuration,
        uint256 maxSupply,
        address umoWallet,
        address creatorWallet,
        address platformWallet
    ) external onlyOwner returns (uint256) {
        require(bytes(momentId).length > 0, "Moment ID required");
        require(momentIdToTokenId[momentId] == 0, "Moment already exists");
        require(umoWallet != address(0), "UMO wallet required");
        require(creatorWallet != address(0), "Creator wallet required");
        require(platformWallet != address(0), "Platform wallet required");
        
        _currentTokenId++;
        uint256 tokenId = _currentTokenId;
        
        // Create revenue split configuration
        RevenueSplit memory splits = RevenueSplit({
            umoWallet: umoWallet,
            creatorWallet: creatorWallet,
            platformWallet: platformWallet,
            umoPercentage: 650000,    // 65%
            creatorPercentage: 300000, // 30%
            platformPercentage: 50000  // 5%
        });
        
        // Create moment edition
        momentEditions[tokenId] = MomentEdition({
            momentId: momentId,
            metadataURI: metadataURI,
            mintPrice: mintPrice,
            mintDuration: mintDuration,
            maxSupply: maxSupply,
            totalMinted: 0,
            startTime: block.timestamp,
            isActive: true,
            splits: splits
        });
        
        // Set up mappings
        momentIdToTokenId[momentId] = tokenId;
        tokenIdToMomentId[tokenId] = momentId;
        
        emit MomentEditionCreated(tokenId, momentId, mintPrice, umoWallet, creatorWallet);
        
        return tokenId;
    }
    
    /**
     * @dev Mint moments with automatic revenue splitting (unlimited quantity)
     */
    function mintMoment(uint256 tokenId, uint256 quantity) 
        external 
        payable 
        nonReentrant 
    {
        MomentEdition storage edition = momentEditions[tokenId];
        require(edition.isActive, "Edition not active");
        require(block.timestamp <= edition.startTime + edition.mintDuration, "Minting period ended");
        require(quantity > 0, "Quantity must be greater than 0");
        require(quantity <= 100, "Max 100 per transaction (gas limit protection)"); // Prevent gas issues
        require(msg.value >= edition.mintPrice * quantity, "Insufficient payment");
        
        // No max supply check - unlimited minting!
        
        // Update state
        edition.totalMinted += quantity;
        mintsPerWallet[tokenId][msg.sender] += quantity;
        
        // Mint NFTs
        _mint(msg.sender, tokenId, quantity, "");
        
        // Split revenue automatically
        _splitRevenue(tokenId, msg.value);
    }
    
    /**
     * @dev Internal function to split revenue
     */
    function _splitRevenue(uint256 tokenId, uint256 totalAmount) internal {
        MomentEdition storage edition = momentEditions[tokenId];
        RevenueSplit memory splits = edition.splits;
        
        // Calculate amounts (using basis points: 1000000 = 100%)
        uint256 umoAmount = (totalAmount * splits.umoPercentage) / 1000000;
        uint256 creatorAmount = (totalAmount * splits.creatorPercentage) / 1000000;
        uint256 platformAmount = (totalAmount * splits.platformPercentage) / 1000000;
        
        // Ensure we don't exceed total (handle rounding)
        uint256 calculatedTotal = umoAmount + creatorAmount + platformAmount;
        if (calculatedTotal > totalAmount) {
            // Adjust platform amount for any rounding difference
            platformAmount = totalAmount - umoAmount - creatorAmount;
        }
        
        // Transfer funds
        if (umoAmount > 0) {
            (bool success1, ) = splits.umoWallet.call{value: umoAmount}("");
            require(success1, "UMO transfer failed");
        }
        
        if (creatorAmount > 0) {
            (bool success2, ) = splits.creatorWallet.call{value: creatorAmount}("");
            require(success2, "Creator transfer failed");
        }
        
        if (platformAmount > 0) {
            (bool success3, ) = splits.platformWallet.call{value: platformAmount}("");
            require(success3, "Platform transfer failed");
        }
        
        emit RevenueSplitExecuted(
            tokenId,
            splits.umoWallet,
            splits.creatorWallet,
            splits.platformWallet,
            umoAmount,
            creatorAmount,
            platformAmount
        );
    }
    
    /**
     * @dev Get revenue split info for a token
     */
    function getRevenueSplit(uint256 tokenId) external view returns (
        address umoWallet,
        address creatorWallet,
        address platformWallet,
        uint256 umoPercentage,
        uint256 creatorPercentage,
        uint256 platformPercentage
    ) {
        RevenueSplit memory splits = momentEditions[tokenId].splits;
        return (
            splits.umoWallet,
            splits.creatorWallet,
            splits.platformWallet,
            splits.umoPercentage,
            splits.creatorPercentage,
            splits.platformPercentage
        );
    }
    
    // Additional utility functions (same as V1)
    function isMintingActive(uint256 tokenId) external view returns (bool) {
        MomentEdition memory edition = momentEditions[tokenId];
        return edition.isActive && 
               block.timestamp <= edition.startTime + edition.mintDuration;
               // No max supply check - unlimited minting!
    }
    
    /**
     * @dev Get complete edition info including splits
     */
    function getEditionInfo(uint256 tokenId) external view returns (
        string memory momentId,
        string memory metadataURI,
        uint256 mintPrice,
        uint256 mintDuration,
        uint256 totalMinted,
        uint256 startTime,
        bool isActive,
        address umoWallet,
        address creatorWallet,
        address platformWallet
    ) {
        MomentEdition memory edition = momentEditions[tokenId];
        return (
            edition.momentId,
            edition.metadataURI,
            edition.mintPrice,
            edition.mintDuration,
            edition.totalMinted,
            edition.startTime,
            edition.isActive,
            edition.splits.umoWallet,
            edition.splits.creatorWallet,
            edition.splits.platformWallet
        );
    }
    
    /**
     * @dev Mint by moment ID (convenience function)
     */
    function mintMomentById(string memory momentId, uint256 quantity) external payable {
        uint256 tokenId = momentIdToTokenId[momentId];
        require(tokenId != 0, "Moment not found");
        
        // Call the main mint function
        this.mintMoment{value: msg.value}(tokenId, quantity);
    }
    
    function getTotalMinted(uint256 tokenId) external view returns (uint256) {
        return momentEditions[tokenId].totalMinted;
    }
    
    function getCurrentTokenId() external view returns (uint256) {
        return _currentTokenId;
    }
    
    /**
     * @dev Update revenue split wallets for a specific token (emergencies/wallet changes)
     */
    function updateRevenueSplit(
        uint256 tokenId,
        address newUmoWallet,
        address newCreatorWallet,
        address newPlatformWallet
    ) external onlyOwner {
        require(newUmoWallet != address(0), "UMO wallet required");
        require(newCreatorWallet != address(0), "Creator wallet required");  
        require(newPlatformWallet != address(0), "Platform wallet required");
        
        RevenueSplit storage splits = momentEditions[tokenId].splits;
        
        address oldUmo = splits.umoWallet;
        address oldCreator = splits.creatorWallet;
        address oldPlatform = splits.platformWallet;
        
        splits.umoWallet = newUmoWallet;
        splits.creatorWallet = newCreatorWallet;
        splits.platformWallet = newPlatformWallet;
        
        emit WalletsUpdated(tokenId, oldUmo, oldCreator, oldPlatform, newUmoWallet, newCreatorWallet, newPlatformWallet);
    }
    
    /**
     * @dev Update revenue split percentages (for future flexibility)
     */
    function updateRevenueSplitPercentages(
        uint256 tokenId,
        uint256 newUmoPercentage,
        uint256 newCreatorPercentage,
        uint256 newPlatformPercentage
    ) external onlyOwner {
        require(newUmoPercentage + newCreatorPercentage + newPlatformPercentage == 1000000, "Must sum to 100%");
        
        RevenueSplit storage splits = momentEditions[tokenId].splits;
        splits.umoPercentage = newUmoPercentage;
        splits.creatorPercentage = newCreatorPercentage;
        splits.platformPercentage = newPlatformPercentage;
        
        emit PercentagesUpdated(tokenId, newUmoPercentage, newCreatorPercentage, newPlatformPercentage);
    }
    
    /**
     * @dev Bulk update wallets for multiple tokens (efficient batch operations)
     */
    function bulkUpdateWallets(
        uint256[] calldata tokenIds,
        address newUmoWallet,
        address newCreatorWallet,
        address newPlatformWallet
    ) external onlyOwner {
        require(newUmoWallet != address(0), "UMO wallet required");
        require(newCreatorWallet != address(0), "Creator wallet required");
        require(newPlatformWallet != address(0), "Platform wallet required");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            RevenueSplit storage splits = momentEditions[tokenId].splits;
            
            splits.umoWallet = newUmoWallet;
            splits.creatorWallet = newCreatorWallet;
            splits.platformWallet = newPlatformWallet;
            
            emit WalletsUpdated(tokenId, address(0), address(0), address(0), newUmoWallet, newCreatorWallet, newPlatformWallet);
        }
    }
    
    /**
     * @dev Emergency function to update mint price (market adjustments)
     */
    function updateMintPrice(uint256 tokenId, uint256 newMintPrice) external onlyOwner {
        uint256 oldPrice = momentEditions[tokenId].mintPrice;
        momentEditions[tokenId].mintPrice = newMintPrice;
        
        emit MintPriceUpdated(tokenId, oldPrice, newMintPrice);
    }
    
    /**
     * @dev Extend minting duration (if community wants more time)
     */
    function extendMintingDuration(uint256 tokenId, uint256 additionalSeconds) external onlyOwner {
        momentEditions[tokenId].mintDuration += additionalSeconds;
        
        emit MintingDurationExtended(tokenId, additionalSeconds);
    }
    
    // Admin functions
    function pauseToken(uint256 tokenId) external onlyOwner {
        momentEditions[tokenId].isActive = false;
    }
    
    function resumeToken(uint256 tokenId) external onlyOwner {
        momentEditions[tokenId].isActive = true;
    }
    
    function setURI(string memory newURI) external onlyOwner {
        _setURI(newURI);
    }
    
    /**
     * @dev Override URI function to return metadata for each token
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        MomentEdition memory edition = momentEditions[tokenId];
        require(bytes(edition.momentId).length > 0, "Token does not exist");
        return edition.metadataURI;
    }
    
    /**
     * @dev Emergency withdrawal (should never be needed with auto-splits)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit EmergencyWithdrawal(owner(), balance);
    }
}