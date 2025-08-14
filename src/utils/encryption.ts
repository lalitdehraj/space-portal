import CryptoJS from 'crypto-js';

// Use a strong, secret key. It's best to store this in an environment variable.
const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'a-very-secret-key';

export const encrypt = (str: string|undefined): string => {
  if(!str){
    return ""
  }
  // Encrypts the ID and returns a Base64-encoded string
  const encrypted = CryptoJS.AES.encrypt(str, SECRET_KEY).toString();
  
  // URL-safe encoding for the encrypted string to handle special characters
  return encodeURIComponent(encrypted);
};

export const decrypt = (encryptedId: string): string => {
  // Decodes the URL-safe string first
  const decoded = decodeURIComponent(encryptedId);
  
  // Decrypts the string and returns the original ID
  const decrypted = CryptoJS.AES.decrypt(decoded, SECRET_KEY);
  
  // Convert the decrypted data to a UTF-8 string
  return decrypted.toString(CryptoJS.enc.Utf8);
};