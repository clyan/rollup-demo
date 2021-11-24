import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
module.exports = {
    input: ['./video.js'],
    output: [
        {
            file: 'dist/js/tm.umd11.js',
            format: 'umd',  
            name: 'TM',
        }
    ],
    plugins: [
        nodeResolve(),
        commonjs(),
    ]
}