import babel from 'rollup-plugin-babel'
import eslint from 'rollup-plugin-eslint'
import replace from 'rollup-plugin-replace'
import uglify from 'rollup-plugin-uglify'

export default {
  entry: 'src/main.js',
  dest: 'build/zooming.js',
  format: 'umd',
  moduleName: 'Zooming',
  sourceMap: 'inline',
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    eslint({}),
    replace({
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify()),
  ]
}
