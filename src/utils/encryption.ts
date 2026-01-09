// import CryptoJS from 'crypto-js';

// // Use a strong, secret key. It's best to store this in an environment variable.
// const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'a-very-secret-key';

// export const encrypt = (str: string|undefined): string => {
//   if(!str){
//     return ""
//   }
//   // Encrypts the ID and returns a Base64-encoded string
//   const encrypted = CryptoJS.AES.encrypt(str, SECRET_KEY).toString();

//   // URL-safe encoding for the encrypted string to handle special characters
//   return encodeURIComponent(encrypted);
// };

// export const decrypt = (encryptedId: string): string => {
//   // Decodes the URL-safe string first
//   const decoded = decodeURIComponent(encryptedId);

//   // Decrypts the string and returns the original ID
//   const decrypted = CryptoJS.AES.decrypt(decoded, SECRET_KEY);

//   // Convert the decrypted data to a UTF-8 string
//   return decrypted.toString(CryptoJS.enc.Utf8);
// };

import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "a-very-secret-key";

const isValidHex = (str: string): boolean => {
  return /^[0-9a-fA-F]+$/.test(str);
};

const base64ToHex = (base64: string): string => {
  const base64Clean = base64.replace(/=+$/, "");
  let hex = "";
  for (let i = 0; i < base64Clean.length; i++) {
    const char = base64Clean[i];
    if (char === "+") {
      hex += "2B";
    } else if (char === "/") {
      hex += "2F";
    } else {
      hex += char.charCodeAt(0).toString(16).padStart(2, "0");
    }
  }
  return hex;
};

const hexToBase64 = (hex: string): string => {
  let base64 = "";
  for (let i = 0; i < hex.length; i += 2) {
    const hexByte = hex.substr(i, 2);
    const charCode = parseInt(hexByte, 16);
    const char = String.fromCharCode(charCode);

    if (char === "\x2B") {
      base64 += "+";
    } else if (char === "\x2F") {
      base64 += "/";
    } else {
      base64 += char;
    }
  }
  const padding = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padding);
};

export const encrypt = (str: string | undefined): string => {
  if (!str) {
    return "";
  }
  const encrypted = CryptoJS.AES.encrypt(str, SECRET_KEY).toString();

  return base64ToHex(encrypted);
};

export const decrypt = (encryptedId: string): string => {
  if (!encryptedId) {
    return "";
  }

  let decrypted: CryptoJS.lib.WordArray;
  let base64Encrypted: string;

  if (isValidHex(encryptedId)) {
    try {
      base64Encrypted = hexToBase64(encryptedId);
      decrypted = CryptoJS.AES.decrypt(base64Encrypted, SECRET_KEY);
    } catch (error) {
      console.error("Error decrypting hex format:", error);
      return "";
    }
  } else {
    try {
      let decoded = encryptedId;
      try {
        decoded = decodeURIComponent(encryptedId);
      } catch (e) {
        decoded = encryptedId;
      }

      decrypted = CryptoJS.AES.decrypt(decoded, SECRET_KEY);
    } catch (error) {
      console.error("Error decrypting Base64 format:", error);
      return "";
    }
  }

  const result = decrypted.toString(CryptoJS.enc.Utf8);

  if (!result) {
    console.error("Decryption failed - empty result");
    return "";
  }

  return result;
};
