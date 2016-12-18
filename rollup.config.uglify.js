import babel from 'rollup-plugin-babel'
import eslint from 'rollup-plugin-eslint'
import uglify from 'rollup-plugin-uglify'

export default {
  entry: 'src/zooming.js',
  dest: 'build/zooming.min.js',
  format: 'umd',
  moduleName: 'Zooming',
  sourceMap: true,
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    eslint({}),
    uglify()
  ],
  onwarn: function (message) {
    // Suppress this error message... there are hundreds of them. Angular team says to ignore it.
    // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
    if (/The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten./.test(message)) {
        return
    }
  },
}
