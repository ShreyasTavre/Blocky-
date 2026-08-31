/**
 * Identity Shield - WebCrypto Client-Side Cryptographic Engine
 * Zero-Knowledge AES-256-GCM Encryption & Real SHA-256 Hash Proofs
 */

const CryptoEngine = {
  // Convert ArrayBuffer to Hex String
  buf2hex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  // Convert Hex String to Uint8Array
  hex2buf(hexString) {
    const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return bytes;
  },

  // Generate real cryptographic SHA-256 hash
  async sha256(message) {
    const encoder = new TextEncoder();
    const data = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return this.buf2hex(hashBuffer);
  },

  // Derive an AES-GCM key from a user passphrase using PBKDF2 (100,000 rounds)
  async deriveKey(passphrase, saltBuffer) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Encrypt JSON or text payload client-side with AES-256-GCM
  async encrypt(data, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for AES-GCM
    const key = await this.deriveKey(passphrase, salt);

    const encoder = new TextEncoder();
    const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const encodedData = encoder.encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    const ciphertextHex = this.buf2hex(ciphertextBuffer);
    const saltHex = this.buf2hex(salt);
    const ivHex = this.buf2hex(iv);

    // Compute real cryptographic SHA-256 commitment of the ciphertext bundle
    const proofHash = await this.sha256(`${ciphertextHex}:${saltHex}:${ivHex}`);

    return {
      ciphertext: ciphertextHex,
      salt: saltHex,
      iv: ivHex,
      proofHash: "0x" + proofHash,
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA256-100000",
      timestamp: Date.now()
    };
  },

  // Decrypt ciphertext using master passphrase
  async decrypt(encryptedBundle, passphrase) {
    const salt = this.hex2buf(encryptedBundle.salt);
    const iv = this.hex2buf(encryptedBundle.iv);
    const ciphertext = this.hex2buf(encryptedBundle.ciphertext);

    const key = await this.deriveKey(passphrase, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decryptedBuffer);

    try {
      return JSON.parse(decryptedText);
    } catch (e) {
      return decryptedText;
    }
  }
};

// Make available in window
if (typeof window !== "undefined") {
  window.CryptoEngine = CryptoEngine;
}
