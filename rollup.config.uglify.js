import babel from 'rollup-plugin-babel'
import eslint from 'rollup-plugin-eslint'
import uglify from 'rollup-plugin-uglify'

export default {
  entry: `src/zooming.js`,
  dest: `build/zooming.min.js`,
  format: 'umd',
  moduleName: 'Zooming',
  sourceMap: true,
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    eslint({}),
    uglify()
  ]
}
