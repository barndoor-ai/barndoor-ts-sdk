/**
 * Version management for the Barndoor SDK.
 *
 * This module provides a unified way to access the SDK version,
 * reading directly from package.json to avoid duplication.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Get the SDK version from package.json.
 * @returns The current SDK version
 */
export function getVersion(): string {
  try {
    // In Node.js environments, read from package.json
    if (typeof process !== 'undefined' && process.versions?.node) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packageJsonPath = join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version;
    }

    // In browser environments, fall back to a build-time constant
    // This will be replaced by the build process
    return '__SDK_VERSION__';
  } catch (error) {
    // Fallback version if package.json can't be read
    console.warn('Could not read version from package.json:', error);
    return '0.1.0';
  }
}

/**
 * SDK version constant for backward compatibility.
 * This is dynamically resolved at runtime.
 */
export const version = getVersion();
