import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // We'll generate declarations separately
        declarationMap: false
      }),
      resolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      terser()
    ],
    external: ['cross-fetch', 'jose', 'fs', 'path', 'os', '@modelcontextprotocol/sdk']
  },
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // We'll generate declarations separately
        declarationMap: false
      }),
      resolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      terser()
    ],
    external: ['cross-fetch', 'jose', 'fs', 'path', 'os', '@modelcontextprotocol/sdk']
  }
];
