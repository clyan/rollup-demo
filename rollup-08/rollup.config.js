import pkg from './package.json'
import vuePlugin from 'rollup-plugin-vue'
import scss from 'rollup-plugin-scss'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import babel from '@rollup/plugin-babel'
// import ts from 'rollup-plugin-typescript2'
import { terser } from 'rollup-plugin-terser'

const name = 'TM'

const createBanner = () => {
  return `/*!
  * ${pkg.name} v${pkg.version}
  * (c) ${new Date().getFullYear()} kkb
  * @license MIT
  */`
}

const createBaseConfig = () => {
  return {
    input: 'src/index.js',
    external: ['vue'],
    plugins: [
      peerDepsExternal(),
      vuePlugin({
        css: true
      }),
      // ts(),
      babel({
        exclude: 'node_modules/**',
        extensions: ['.js', '.jsx', '.vue'],
        babelHelpers: 'bundled'
      }),
      resolve({
        extensions: ['.vue', '.jsx', '.js']
      }),
      commonjs(),
      json(),
      scss()
    ],
    output: {
      sourcemap: false,
      banner: createBanner(),
      externalLiveBindings: false,
      exports: 'named',
      globals: {
        vue: 'Vue'
      }
    }
  }
}

function mergeConfig(baseConfig, configB) {
  const config = Object.assign({}, baseConfig)
  // plugin
  if (configB.plugins) {
    baseConfig.plugins.push(...configB.plugins)
  }

  // output
  config.output = Object.assign({}, baseConfig.output, configB.output)

  return config
}

function createFileName(formatName) {
  return `dist/TM.${formatName}.js`
}

// es-bundle
const esBundleConfig = {
  plugins: [
    replace({
      preventAssignment: true,
      __DEV__: `(process.env.NODE_ENV !== 'production')`
    })
  ],
  output: {
    file: createFileName('esm-bundler'),
    format: 'es'
  }
}

// es-browser
const esBrowserConfig = {
  plugins: [
    replace({
      preventAssignment: true,
      __DEV__: true
    })
  ],
  output: {
    file: createFileName('esm-browser'),
    format: 'es'
  }
}

// es-browser.prod
const esBrowserProdConfig = {
  plugins: [
    terser(),
    replace({
      preventAssignment: true,
      __DEV__: false
    })
  ],
  output: {
    file: createFileName('esm-browser.prod'),
    format: 'es'
  }
}

// cjs
const cjsConfig = {
  plugins: [
    replace({
      preventAssignment: true,
      __DEV__: true
    })
  ],
  output: {
    file: createFileName('cjs'),
    format: 'cjs'
  }
}
// cjs.prod
const cjsProdConfig = {
  plugins: [
    terser(),
    replace({
      preventAssignment: true,
      __DEV__: false
    })
  ],
  output: {
    file: createFileName('cjs.prod'),
    format: 'cjs'
  }
}

// global
const globalConfig = {
  plugins: [
    replace({
      preventAssignment: true,
      __DEV__: true,
      'process.env.NODE_ENV': true
    })
  ],
  output: {
    file: createFileName('global'),
    format: 'iife',
    name
  }
}
// global.prod
const globalProdConfig = {
  plugins: [
    terser(),
    replace({
      preventAssignment: true,
      __DEV__: false,
      'process.env.NODE_ENV': true
    })
  ],
  output: {
    file: createFileName('global.prod'),
    format: 'iife',
    name
  }
}

const prodFormatConfigs = [
  esBundleConfig,
  esBrowserProdConfig,
  esBrowserConfig,
  cjsConfig,
  cjsProdConfig,
  globalConfig,
  globalProdConfig
]
const devFormatConfigs = [esBundleConfig]

function createPackageConfigs() {
  return getFormatConfigs().map((formatConfig) => {
    return mergeConfig(createBaseConfig(), formatConfig)
  })
}

function getFormatConfigs() {
  return process.env.NODE_ENV === 'development'
    ? devFormatConfigs
    : prodFormatConfigs
}

export default createPackageConfigs()