const hre = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy UMO Moments ERC1155 contract
  const UMOMomentsERC1155 = await hre.ethers.getContractFactory("UMOMomentsERC1155");
  
  // Base URI - you can update this later with setURI()
  const baseURI = "https://gateway.irys.xyz/";
  
  const umoMomentsERC1155 = await UMOMomentsERC1155.deploy(baseURI);

  await umoMomentsERC1155.waitForDeployment();
  const contractAddress = await umoMomentsERC1155.getAddress();
  
  console.log("UMO Moments ERC1155 deployed to:", contractAddress);
  
  // Create contracts directory in src
  const contractsDir = './src/contracts';
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  // Save contract info for frontend
  const contractInfo = {
    address: contractAddress,
    abi: UMOMomentsERC1155.interface.fragments.map(fragment => fragment.format('json')).map(JSON.parse)
  };
  
  fs.writeFileSync(
    './src/contracts/UMOMomentsERC1155.json',
    JSON.stringify(contractInfo, null, 2)
  );
  
  console.log("Contract ABI saved to src/contracts/UMOMomentsERC1155.json");
  console.log("Add this to your .env file:");
  console.log(`REACT_APP_UMO_MOMENTS_CONTRACT=${contractAddress}`);
  
  // Test contract functions
  console.log("\n🧪 Testing contract functions...");
  
  try {
    const currentTokenId = await umoMomentsERC1155.getCurrentTokenId();
    console.log("✅ getCurrentTokenId():", currentTokenId.toString());
    
    const nextTokenId = await umoMomentsERC1155.getNextTokenId();
    console.log("✅ getNextTokenId():", nextTokenId.toString());
    
    console.log("✅ Contract deployment and testing successful!");
  } catch (error) {
    console.error("❌ Error testing contract:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});