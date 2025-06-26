const hre = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy UMO Moments contract
  const UMOMoments = await hre.ethers.getContractFactory("UMOMoments");
  const umoMoments = await UMOMoments.deploy(
    "UMO Moments",  // name
    "UMOM"          // symbol
  );

  await umoMoments.waitForDeployment();
  const contractAddress = await umoMoments.getAddress();
  
  console.log("UMO Moments deployed to:", contractAddress);
  
  // Create contracts directory in src
  const contractsDir = './src/contracts';
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  // Save contract info for frontend
  const contractInfo = {
    address: contractAddress,
    abi: UMOMoments.interface.fragments.map(fragment => fragment.format('json')).map(JSON.parse)
  };
  
  fs.writeFileSync(
    './src/contracts/UMOMoments.json',
    JSON.stringify(contractInfo, null, 2)
  );
  
  console.log("Contract ABI saved to src/contracts/UMOMoments.json");
  console.log("Add this to your .env file:");
  console.log(`REACT_APP_UMO_MOMENTS_CONTRACT=${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});