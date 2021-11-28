import { defineConfig } from 'rollup'
import ex1 from './plugin/rollup-plugin-ex1'
import ex2 from './plugin/rollup-plugin-ex2'
export default  defineConfig({
    input: 'index.js',
    output: {
            file: './dist/main.js',
            format: 'umd',
            name: 'TM',
    },
    plugins: [
      ex1(), // 先执行
      ex2(), 
    ],
})