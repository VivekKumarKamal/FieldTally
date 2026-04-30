const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function encodeUuidToShortId(uuid: string): string {
  if (!uuid) return "";
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return uuid; // Return original if not valid UUID
  
  let num = BigInt("0x" + hex);
  let encoded = "";
  if (num === 0n) return BASE62[0];
  
  while (num > 0n) {
    const rem = num % 62n;
    encoded = BASE62[Number(rem)] + encoded;
    num = num / 62n;
  }
  return encoded;
}

export function decodeShortIdToUuid(shortId: string): string {
  if (!shortId || shortId.length > 22 || shortId.includes('-')) return shortId; // Probably already a UUID or invalid
  
  let num = 0n;
  for (let i = 0; i < shortId.length; i++) {
    const char = shortId[i];
    const val = BigInt(BASE62.indexOf(char));
    if (val === -1n) return shortId; // Invalid character
    num = num * 62n + val;
  }
  
  let hex = num.toString(16);
  hex = hex.padStart(32, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
