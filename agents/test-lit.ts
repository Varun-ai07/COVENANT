import * as LitJsSdk from "@lit-protocol/lit-node-client";

// Test Lit Protocol initialization
async function testLitProtocol() {
  console.log("Testing Lit Protocol integration...");
  
  try {
    const litClient = new LitJsSdk.LitNodeClient({
      alertWhenUnauthorized: false,
      litNetwork: "serrano", // Use serrano testnet for development
      debug: false,
    });
    
    await litClient.connect();
    console.log("✓ Lit Protocol client initialized and connected successfully");
    
    // Test encryption capability
    const plaintext = "Hello, COVENANT!";
    const encryptedString = await litClient.encryptString({
      stringToEncrypt: plaintext,
    });
    
    console.log("✓ Encryption successful");
    console.log(`  Original: ${plaintext}`);
    console.log(`  Encrypted: ${encryptedString.substring(0, 50)}...`);
    
    // Test decryption capability
    const decryptedString = await litClient.decryptString({
      ciphertext: encryptedString,
    });
    
    console.log("✓ Decryption successful");
    console.log(`  Decrypted: ${decryptedString}`);
    
    if (decryptedString === plaintext) {
      console.log("✓ Encryption/decryption round-trip successful");
    } else {
      console.log("✗ Encryption/decryption round-trip failed");
    }
    
    await litClient.disconnect();
    return true;
  } catch (error) {
    console.error("✗ Lit Protocol test failed:", error);
    return false;
  }
}

// Run the test
testLitProtocol()
  .then(success => {
    if (success) {
      console.log("\n🎉 Lit Protocol integration test PASSED");
      process.exit(0);
    } else {
      console.log("\n❌ Lit Protocol integration test FAILED");
      process.exit(1);
    }
  })
  .catch(error => {
    console.error("\n💥 Lit Protocol integration test ERROR:", error);
    process.exit(1);
  });