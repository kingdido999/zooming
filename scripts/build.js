const rollup = require('rollup')
const watch = require('rollup-watch')
const babel = require('rollup-plugin-babel')
const eslint = require('rollup-plugin-eslint')
const uglify = require('rollup-plugin-uglify')
const open = require('open')

const defaultPlugins = [
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
  })
]

const config = (dest, plugins) => {
  return {
    entry: 'src/index.js',
    dest: dest,
    format: 'umd',
    moduleName: 'Zooming',
    sourceMap: true,
    plugins: plugins,
    onwarn: (message) => {
      // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
      if (/The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten./.test(message)) {
        return
      }
    }
  }
}

const stderr = console.error.bind(console) // eslint-disable-line no-console
let opened = false

const eventHandler = (event) => {
  switch (event.code) {
    case 'STARTING':
      stderr('checking rollup-watch version...')
      break
    case 'BUILD_START':
      stderr('bundling...')
      break
    case 'BUILD_END':
      stderr('bundled in ' + event.duration + 'ms. Watching for changes...')
      if (!opened) {
        open(__dirname + '/../index.html')
        opened = true
      }
      break
    case 'ERROR':
      stderr('error: ' + event.error)
      break
    default:
      stderr('unknown event', event)
  }
}

const watcherDefault = watch(rollup, config(
  'build/zooming.js',
  defaultPlugins
))

watch(rollup, config(
  'build/zooming.min.js',
  defaultPlugins.concat([uglify({})])
))

watcherDefault.on('event', eventHandler)
