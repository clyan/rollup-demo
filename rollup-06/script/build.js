const rollup = require('rollup');
const pngResolver = require('./plugin/rollup-plugin-png-resolver.js');
const path = require('path');

const inputOptions = {
  input: path.resolve(__dirname, '../src/main.js'),
  plugins:[
    pngResolver(),
  ],
  perf: true,
}
const outputOptions = {
  file: 'bundle.js',
  format: 'umd'
}

async function build() {
  // 第一步
  const bundle = await rollup.rollup(inputOptions);
  // console.log("bundle", bundle)
  // 第二步
  const render = await bundle.generate(outputOptions);
  // console.log("render", render)
  // 第三步
  await bundle.write(outputOptions);
}

build();
