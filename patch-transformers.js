/**
 * Patch @xenova/transformers to work in browser without Node.js dependencies
 * This script modifies the transformers package to make it compatible with browser environments
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const transformersPath = resolve('node_modules/@xenova/transformers/src/env.js');

try {
  let content = readFileSync(transformersPath, 'utf-8');
  
  // Remove Node.js specific imports that cause issues in browser
  content = content.replace(
    /import\s+\{\s*pathToFileURL\s*\}\s+from\s+['"]url['"]\s*;?/g,
    '// import { pathToFileURL } from "url"; // Removed for browser compatibility'
  );
  
  writeFileSync(transformersPath, content, 'utf-8');
  console.log('✅ Successfully patched @xenova/transformers for browser compatibility');
} catch (error) {
  console.warn('⚠️  Could not patch @xenova/transformers:', error.message);
  console.warn('This may cause issues in browser environment, but the app might still work.');
}

