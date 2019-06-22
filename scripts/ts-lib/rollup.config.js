const resolve = require('rollup-plugin-node-resolve')
const commonjs = require('rollup-plugin-commonjs')
const sourceMaps = require('rollup-plugin-sourcemaps')
const babel = require('rollup-plugin-babel')
const json = require('rollup-plugin-json')

const isProduction = process.env.NODE_ENV === 'production'
const pkg = require(`${process.cwd()}/package`)
const extensions = [ '.js', '.jsx', '.ts', '.tsx' ]

module.exports = {
  input: 'index.ts',
  output: [
    { format: 'cjs',
      exports: 'named',
      sourcemap: !isProduction,
      compact: isProduction,
      file: pkg.main
    },
    { format: 'es',
      sourcemap: !isProduction,
      compact: isProduction,
      file: pkg.module
    }
  ],
  external: Object.keys(pkg.peerDependencies || {}),
  plugins: [
    json(),
    resolve({ extensions }),
    babel({ extensions, exclude: 'node_modules' }),
    commonjs(),
    sourceMaps()
  ]
}
