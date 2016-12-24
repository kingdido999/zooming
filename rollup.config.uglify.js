import babel from 'rollup-plugin-babel'
import eslint from 'rollup-plugin-eslint'
import uglify from 'rollup-plugin-uglify'

export default {
  entry: 'src/main.js',
  dest: 'build/zooming.min.js',
  format: 'umd',
  moduleName: 'Zooming',
  sourceMap: true,
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
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
    uglify()
  ],
  onwarn: function (message) {
    // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
    if (/The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten./.test(message)) {
      return
    }
  }
}
