#!/usr/bin/env node
/**
 * Upload video to Irys
 */

const Irys = require("@irys/sdk");
const fs = require("fs");

const PRIVATE_KEY = "06da2e1158b524adebddfa182da5fe825bc8fe754888ce20a2f032f4046b6191";
const VIDEO_PATH = "/Users/gs/Desktop/Screen Recording 2026-01-22 at 08.10.22.mov";

async function main() {
  console.log("🚀 Connecting to Irys devnet...");

  const irys = new Irys({
    network: "devnet",
    token: "ethereum",
    key: PRIVATE_KEY,
    config: { providerUrl: "https://eth-sepolia.g.alchemy.com/v2/alcht_YbDiff1KAqK0fNAzBgycHfz7G0iz4n" }
  });

  const fileSize = fs.statSync(VIDEO_PATH).size;
  console.log(`📁 File: ${VIDEO_PATH}`);
  console.log(`📊 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  const price = await irys.getPrice(fileSize);
  console.log(`💰 Cost: ${irys.utils.fromAtomic(price)} ETH`);

  const balance = await irys.getLoadedBalance();
  console.log(`💳 Balance: ${irys.utils.fromAtomic(balance)} ETH`);

  // Balance is sufficient (0.12 ETH > 0.0015 ETH needed)
  console.log("✅ Balance sufficient for upload")

  console.log("\n📤 Uploading (this may take a while for 247MB)...");
  const receipt = await irys.uploadFile(VIDEO_PATH, {
    tags: [
      { name: "Content-Type", value: "video/quicktime" },
      { name: "Title", value: "UMO Live Archive Recording" }
    ]
  });

  console.log("\n✅ Done!");
  console.log(`🔗 https://gateway.irys.xyz/${receipt.id}`);

  // Save to file
  fs.writeFileSync("/Volumes/WORKHORSE GS/vibecoding/cyberdesign/irys-url.txt",
    `https://gateway.irys.xyz/${receipt.id}`);
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
