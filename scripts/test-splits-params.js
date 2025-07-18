// Test 0xSplits parameters
const addresses = [
  '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96', // Platform
  '0x23de198F1520ad386565fc98AEE6abb3Ae5052BE', // Creator
  '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF'  // UMO
];

const percentages = [50000, 300000, 650000]; // 5%, 30%, 65%

console.log('🧪 Testing 0xSplits parameters:');
console.log('Addresses:', addresses);
console.log('Percentages:', percentages);
console.log('Total percentage:', percentages.reduce((a, b) => a + b, 0));
console.log('Expected total: 1000000');

// Validate addresses
addresses.forEach((addr, i) => {
  if (!addr || addr.length !== 42 || !addr.startsWith('0x')) {
    console.error(`❌ Invalid address at index ${i}: ${addr}`);
  }
});

// Check percentage total
const total = percentages.reduce((a, b) => a + b, 0);
if (total !== 1000000) {
  console.error(`❌ Percentages don't sum to 1000000, got: ${total}`);
} else {
  console.log('✅ Percentage validation passed');
}

console.log('\n💡 If this looks correct, the issue is likely:');
console.log('1. Wrong ABI/function signature');
console.log('2. Gas estimation failure');
console.log('3. Network issues');
console.log('4. Wrong contract address (though we verified it exists)');