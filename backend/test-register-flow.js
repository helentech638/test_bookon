#!/usr/bin/env node

/**
 * Test Runner for Register Creation Flow
 * 
 * This script runs comprehensive tests to verify that register creation
 * works correctly when completing bookings.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Testing Register Creation Flow...\n');

// Test files to run
const testFiles = [
  'backend/src/__tests__/registerCreation.test.ts',
  'backend/src/__tests__/paymentWebhook.test.ts', 
  'backend/src/__tests__/fixRegisters.test.ts',
  'backend/src/__tests__/registerCreationIntegration.test.ts'
];

// Run each test file
testFiles.forEach((testFile, index) => {
  console.log(`📋 Running test ${index + 1}/${testFiles.length}: ${path.basename(testFile)}`);
  
  try {
    const result = execSync(`npx jest ${testFile} --verbose --no-coverage`, {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    console.log(`✅ ${path.basename(testFile)} passed\n`);
  } catch (error) {
    console.error(`❌ ${path.basename(testFile)} failed:`);
    console.error(error.stdout || error.message);
    console.error('');
  }
});

console.log('🎯 Test Summary:');
console.log('   - Unit tests for register creation function');
console.log('   - Payment webhook handling tests');
console.log('   - Fix endpoints tests');
console.log('   - Integration tests with real database');
console.log('');
console.log('💡 Next Steps:');
console.log('   1. Run: npm test -- --testPathPattern=registerCreation');
console.log('   2. Check webhook configuration in Stripe dashboard');
console.log('   3. Monitor logs for register creation errors');
console.log('   4. Use fix endpoints for existing bookings if needed');
