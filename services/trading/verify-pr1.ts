import { encryptSecret, decryptSecret } from '../../app/api/toss-proxy/route';

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-1 SECURITY FOUNDATION VERIFY");
  console.log("=========================================");

  // Test 1: Cryptographic AES-256-GCM round-trip
  {
    const originalText = "my-secret-broker-api-key-123456";
    const encrypted = encryptSecret(originalText);
    const decrypted = decryptSecret(encrypted);

    console.log("Test 1 (AES-256-GCM Round-trip):",
      decrypted === originalText ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 2: Unique IV generation (differing ciphertexts for identical inputs)
  {
    const originalText = "my-secret-broker-api-key-123456";
    const encrypted1 = encryptSecret(originalText);
    const encrypted2 = encryptSecret(originalText);

    console.log("Test 2 (Unique Ciphertexts per IV):",
      encrypted1 !== encrypted2 ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 3: Legacy fallback support (no ":" format)
  {
    const plaintext = "mock-api-key";
    const prefixed = "enc:mock-api-key";

    const decPlain = decryptSecret(plaintext);
    const decPrefixed = decryptSecret(prefixed);

    console.log("Test 3 (Legacy Fallback Support):",
      decPlain === "mock-api-key" && decPrefixed === "mock-api-key" ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 4: Live mode fail-fast on missing key
  {
    const origKey = process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY;
    const origMode = process.env.NEXT_PUBLIC_TRADING_MODE;

    // Simulate LIVE mode with missing key
    delete process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY;
    process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';

    let threw = false;
    let errMsg = '';
    try {
      encryptSecret("test");
    } catch (err: any) {
      threw = true;
      errMsg = err.message;
    }

    // Restore env variables
    process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = origKey;
    process.env.NEXT_PUBLIC_TRADING_MODE = origMode;

    console.log("Test 4 (Live Mode Fail-fast on Missing Key):",
      threw && errMsg.includes('ConfigurationError') ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 5: Master key derivation from short seeds
  {
    const origKey = process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY;
    
    // Set a very short key seed
    process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = 'short';
    const text = "confidential-broker-secret";
    
    let ok = false;
    try {
      const encrypted = encryptSecret(text);
      const decrypted = decryptSecret(encrypted);
      if (decrypted === text) ok = true;
    } catch (e) {}

    // Restore env
    process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = origKey;

    console.log("Test 5 (Master Key SHA-256 Derivation):",
      ok ? "✅ PASS" : "❌ FAIL"
    );
  }
}

runTests().catch(console.error);
