import babel from 'rollup-plugin-babel'
import eslint from 'rollup-plugin-eslint'

export default {
  entry: 'src/main.js',
  dest: 'build/zooming.js',
  format: 'umd',
  moduleName: 'Zooming',
  sourceMap: true,
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    eslint({}),
  ]
}
