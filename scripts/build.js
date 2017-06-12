const rollup = require('rollup')
const watch = require('rollup-watch')
const babel = require('rollup-plugin-babel')
const eslint = require('rollup-plugin-eslint')
const uglify = require('rollup-plugin-uglify')
const filesize = require('rollup-plugin-filesize')
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

const destDefault = 'build/zooming.js'
const destMinify = 'build/zooming.min.js'

const config = (dest, plugins) => {
  return {
    entry: 'src/index.js',
    dest: dest,
    format: 'umd',
    moduleName: 'Zooming',
    sourceMap: true,
    plugins: plugins,
    onwarn: message => {
      // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
      if (
        /The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten./.test(
          message
        )
      ) {
        return
      }
    }
  }
}

const stderr = console.error.bind(console) // eslint-disable-line no-console
let opened = false

const eventHandler = (event, filename) => {
  switch (event.code) {
    case 'STARTING':
      break
    case 'BUILD_START':
      stderr(`bundling ${filename}...`)
      break
    case 'BUILD_END':
      stderr(
        `${filename} bundled in ${event.duration}ms. Watching for changes...`
      )
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

const watcherDefault = watch(rollup, config(destDefault, defaultPlugins))

const watcherUglify = watch(
  rollup,
  config(destMinify, [...defaultPlugins, uglify({}), filesize()])
)

watcherDefault.on('event', event => eventHandler(event, destDefault))
watcherUglify.on('event', event => eventHandler(event, destMinify))
