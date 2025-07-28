#!/usr/bin/env node

/**
 * Script to dump all core TypeScript files into a single file for LLM review
 * 
 * Usage: node scripts/dump-core-files.js [output-file]
 * Default output: core-files-dump.md
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Core files to include in the dump
const coreFiles = [
  'src/index.ts',
  'src/client.ts', 
  'src/config.ts',
  'src/models/index.ts',
  'src/exceptions/index.ts',
  'src/http/client.ts',
  'src/auth/index.ts',
  'src/auth/store.ts',
  'src/auth/pkce.ts',
  'src/quickstart.ts',
  'tsconfig.json',
  'package.json',
  'rollup.config.js'
];

// Configuration files to include
const configFiles = [
  '.eslintrc.js',
  '.prettierrc'
];

async function readFileWithFallback(filePath) {
  try {
    const content = await fs.readFile(path.join(projectRoot, filePath), 'utf8');
    return content;
  } catch (error) {
    return `// File not found or error reading: ${error.message}`;
  }
}

function getFileExtension(filePath) {
  return path.extname(filePath).slice(1) || 'text';
}

function createFileHeader(filePath, lineCount) {
  const separator = '='.repeat(80);
  const fileName = path.basename(filePath);
  const directory = path.dirname(filePath);
  
  return `${separator}
FILE: ${filePath}
DIRECTORY: ${directory}
FILENAME: ${fileName}
LINES: ${lineCount}
${separator}`;
}

async function generateDump() {
  const outputFile = process.argv[2] || 'core-files-dump.md';
  const outputPath = path.join(projectRoot, outputFile);
  
  let output = [];
  
  // Add header
  output.push(`# Barndoor JavaScript SDK - TypeScript Migration Core Files Dump`);
  output.push(`Generated: ${new Date().toISOString()}`);
  output.push(`Total Files: ${coreFiles.length + configFiles.length}`);
  output.push('');
  output.push('This file contains all core TypeScript files from the Barndoor SDK migration.');
  output.push('Each file is clearly marked with headers showing file path, directory, and line count.');
  output.push('');
  
  // Add table of contents
  output.push('## Table of Contents');
  output.push('');
  
  const allFiles = [...coreFiles, ...configFiles];
  allFiles.forEach((filePath, index) => {
    output.push(`${index + 1}. [${filePath}](#${filePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()})`);
  });
  output.push('');
  
  // Process core files
  output.push('## Core TypeScript Files');
  output.push('');
  
  for (const filePath of coreFiles) {
    console.log(`Processing: ${filePath}`);
    const content = await readFileWithFallback(filePath);
    const lines = content.split('\n');
    const lineCount = lines.length;
    const extension = getFileExtension(filePath);
    
    output.push(createFileHeader(filePath, lineCount));
    output.push('');
    output.push(`\`\`\`${extension}`);
    output.push(content);
    output.push('```');
    output.push('');
  }
  
  // Process configuration files
  output.push('## Configuration Files');
  output.push('');
  
  for (const filePath of configFiles) {
    console.log(`Processing: ${filePath}`);
    const content = await readFileWithFallback(filePath);
    const lines = content.split('\n');
    const lineCount = lines.length;
    const extension = getFileExtension(filePath);
    
    output.push(createFileHeader(filePath, lineCount));
    output.push('');
    output.push(`\`\`\`${extension}`);
    output.push(content);
    output.push('```');
    output.push('');
  }
  
  // Write output
  const finalOutput = output.join('\n');
  await fs.writeFile(outputPath, finalOutput, 'utf8');
  
  console.log(`\n✅ Core files dump completed!`);
  console.log(`📄 Output file: ${outputPath}`);
  console.log(`📊 Total size: ${(finalOutput.length / 1024).toFixed(1)} KB`);
  console.log(`📁 Files processed: ${allFiles.length}`);
  
  // Show summary stats
  const stats = {
    totalLines: 0,
    totalFiles: allFiles.length,
    typeScriptFiles: coreFiles.filter(f => f.endsWith('.ts')).length,
    configFiles: configFiles.length
  };
  
  for (const filePath of allFiles) {
    const content = await readFileWithFallback(filePath);
    stats.totalLines += content.split('\n').length;
  }
  
  console.log(`📈 Total lines: ${stats.totalLines}`);
  console.log(`🔷 TypeScript files: ${stats.typeScriptFiles}`);
  console.log(`⚙️  Config files: ${stats.configFiles}`);
}

// Run the script
generateDump().catch(error => {
  console.error('❌ Error generating dump:', error);
  process.exit(1);
});
