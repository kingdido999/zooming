import babel from 'rollup-plugin-babel'
import eslint from 'rollup-plugin-eslint'
import filesize from 'rollup-plugin-filesize'

const info = require('./package.json')

const config = {
  input: 'src/index.js',
  plugins: [
    // resolve(),
    babel(),
    eslint({
      env: {
        browser: true
      },
      extends: 'eslint:recommended',
      parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module'
      },
      rules: {
        indent: ['off', 2],
        quotes: ['error', 'single'],
        semi: ['off', 'never']
      }
    }),
    filesize()
  ],
  output: [
    {
      file: info.main,
      format: 'umd',
      name: 'Zooming'
    }, {
      file: info.module,
      format: 'es'
    }
  ]
}

export default config
