import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const version = process.env.npm_package_version || '0.4.0';
const versionFile = join(__dirname, '../dist/version.txt');

writeFileSync(versionFile, version);
console.log(`✅ Generated version file: ${version}`);

