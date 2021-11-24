import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import { terser } from "rollup-plugin-terser";
module.exports = {
    input: ['main.js'],
    output: [
        {
            file: 'dist/tm.cjs.js',
            format: 'cjs',  
            name: 'TM', 
        },
        {
            file: 'dist/tm.amd.js',
            format: 'amd',  
            name: 'TM', 
        },
        {
            file: 'dist/tm.esm.js',
            format: 'esm',  
            name: 'TM', 
        },
        {
            file: 'dist/tm.umd.js',
            format: 'umd',  
            name: 'TM',
            // globals: {
            //     'jquery': '$'
            // }
        },
        {
            file: 'dist/tm.iife.js',
            format: 'iife',  //  五种输出格式：amd /  es6 / iife / umd / cjs
            name: 'TM',     // 当format为iife和umd时必须提供，将作为全局变量挂在window(浏览器环境)下：window.TM=\
            // globals: {
            //     'jquery': '$'
            // }
            //sourcemap:true  //生成tm.map.js文件，方便调试
        },
    ],
    // external: ['jquery']
    plugins: [
        nodeResolve(), 
        commonjs(),
        babel({
            babelHelpers: 'bundled',
            exclude: 'node_modules/**'
        }),
        terser()
    ]
}