/**
 * Binary-safe serialization for Seal encrypted objects
 * 
 * JSON stringify/parse breaks Uint8Arrays, so we need custom serialization
 */

/**
 * Serialize Seal encrypted object to binary format
 * Preserves Uint8Arrays properly
 */
export function serializeSealObject(obj: any): Uint8Array {
  // Convert to JSON but mark Uint8Arrays
  const jsonObj = replaceUint8Arrays(obj);
  const jsonString = JSON.stringify(jsonObj);
  return new TextEncoder().encode(jsonString);
}

/**
 * Deserialize Seal encrypted object from binary format
 * Restores Uint8Arrays from markers
 */
export function deserializeSealObject(data: Uint8Array | string): any {
  let jsonString: string;
  
  if (typeof data === 'string') {
    jsonString = data;
  } else {
    jsonString = new TextDecoder().decode(data);
  }
  
  const jsonObj = JSON.parse(jsonString);
  return restoreUint8Arrays(jsonObj);
}

/**
 * Replace Uint8Arrays with marked objects
 */
function replaceUint8Arrays(obj: any): any {
  if (obj instanceof Uint8Array) {
    return {
      __type: 'Uint8Array',
      data: Array.from(obj)
    };
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => replaceUint8Arrays(item));
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = replaceUint8Arrays(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Restore Uint8Arrays from marked objects
 * Creates proper Uint8Arrays with ArrayBuffer backing
 */
function restoreUint8Arrays(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // Check if this is a marked Uint8Array (new format)
  if (obj.__type === 'Uint8Array' && Array.isArray(obj.data)) {
    // Use Uint8Array.from() to ensure proper ArrayBuffer
    return Uint8Array.from(obj.data);
  }
  
  // Check if this is a legacy Uint8Array (plain JSON.stringify format)
  // These have only numeric keys and no other properties
  if (!Array.isArray(obj)) {
    const keys = Object.keys(obj);
    const allNumeric = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
    if (allNumeric) {
      // Convert to array of numbers, then to Uint8Array
      const maxIndex = Math.max(...keys.map(k => parseInt(k)));
      const arr = new Array(maxIndex + 1);
      for (const key of keys) {
        arr[parseInt(key)] = obj[key];
      }
      return Uint8Array.from(arr);
    }
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => restoreUint8Arrays(item));
  }
  
  // Handle objects
  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = restoreUint8Arrays(obj[key]);
    }
  }
  return result;
}


