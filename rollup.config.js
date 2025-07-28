import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
  // CommonJS build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      terser()
    ],
    external: ['cross-fetch', 'jose', 'fs', 'path', 'os', '@modelcontextprotocol/sdk']
  },
  // ES Module build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.esm.js',
      format: 'es'
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      terser()
    ],
    external: ['cross-fetch', 'jose', 'fs', 'path', 'os', '@modelcontextprotocol/sdk']
  }
];
