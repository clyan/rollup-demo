const rollup = require('rollup');
const example = require('./plugin/rollup-plugin-example')
const path = require('path');

const inputOptions = {
  input: path.resolve(__dirname, '../src/main.js'),
  plugins:[
    example()
  ],
  perf: true,
}
const outputOptions = {
  file: 'bundle.js',
  format: 'cjs'
}

async function build() {
  // 第一步
  const bundle = await rollup.rollup(inputOptions);
  
  // 第二步
  const { code, map } = await bundle.generate(outputOptions);
  
  // 第三步
  await bundle.write(outputOptions);
}

build();
