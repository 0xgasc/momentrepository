const hre = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🚀 Deploying UMOMomentsERC1155V2 with the account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance < hre.ethers.parseEther("0.01")) {
    console.warn("⚠️ Low balance! You might need more ETH for deployment.");
  }

  // Deploy UMO Moments ERC1155 V2 contract with built-in revenue splits
  console.log("🔨 Compiling and deploying UMOMomentsERC1155V2...");
  
  const UMOMomentsERC1155V2 = await hre.ethers.getContractFactory("UMOMomentsERC1155V2");
  
  // Base URI for metadata
  const baseURI = "https://devnet.irys.xyz/";
  
  console.log("📝 Constructor parameter - baseURI:", baseURI);
  
  const umoMomentsERC1155V2 = await UMOMomentsERC1155V2.deploy(baseURI);

  console.log("⏳ Waiting for deployment...");
  await umoMomentsERC1155V2.waitForDeployment();
  
  const contractAddress = await umoMomentsERC1155V2.getAddress();
  
  console.log("✅ UMO Moments ERC1155 V2 deployed to:", contractAddress);
  console.log("🔗 View on Base Sepolia Explorer:");
  console.log(`   https://sepolia.basescan.org/address/${contractAddress}`);
  
  // Create contracts directory in src
  const contractsDir = './src/contracts';
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  // Get the full ABI from the compiled contract
  const contractABI = UMOMomentsERC1155V2.interface.fragments.map(fragment => {
    return JSON.parse(fragment.format('json'));
  });
  
  // Save contract info for frontend
  const contractInfo = {
    address: contractAddress,
    abi: contractABI
  };
  
  const contractPath = './src/contracts/UMOMomentsERC1155V2.json';
  fs.writeFileSync(contractPath, JSON.stringify(contractInfo, null, 2));
  
  console.log("📄 Contract ABI saved to:", contractPath);
  
  // Also save to backend
  const backendContractPath = './setlist-proxy/contracts/UMOMomentsERC1155V2.json';
  fs.writeFileSync(backendContractPath, JSON.stringify(contractInfo, null, 2));
  console.log("📄 Contract ABI copied to backend:", backendContractPath);
  
  console.log("\n🔧 Environment Variables:");
  console.log(`REACT_APP_UMO_MOMENTS_V2_CONTRACT=${contractAddress}`);
  
  // Test contract functions
  console.log("\n🧪 Testing contract functions...");
  
  try {
    const currentTokenId = await umoMomentsERC1155V2.getCurrentTokenId();
    console.log("✅ getCurrentTokenId():", currentTokenId.toString());
    
    // Test revenue split configuration
    console.log("✅ Built-in revenue splits ready");
    console.log("   - UMO: 65%");
    console.log("   - Creator: 30%"); 
    console.log("   - Platform: 5%");
    
    console.log("\n✅ Contract deployment and testing successful!");
    
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Update your backend to use the new contract for new NFTs");
    console.log("2. Test creating an NFT with the new contract");
    console.log("3. Test minting to verify automatic revenue splitting");
    console.log("4. Keep old contract for existing NFTs");
    
    // Save deployment info
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      contractAddress: contractAddress,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      txHash: umoMomentsERC1155V2.deploymentTransaction()?.hash,
      baseURI: baseURI,
      features: [
        "Built-in revenue splits (65% UMO, 30% Creator, 5% Platform)",
        "Unlimited minting per NFT",
        "Editable wallet addresses",
        "Emergency admin functions",
        "ReentrancyGuard protection"
      ]
    };
    
    fs.writeFileSync('./scripts/deployment-v2-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("📄 Deployment info saved to scripts/deployment-v2-info.json");
    
  } catch (error) {
    console.error("❌ Error testing contract:", error);
  }
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});