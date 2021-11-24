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
        },
        {
            file: 'dist/tm.iife.js',
            format: 'iife',  //  五种输出格式：amd /  es6 / iife / umd / cjs
            name: 'TM',     // 当format为iife和umd时必须提供，将作为全局变量挂在window(浏览器环境)下：window.TM=
            //sourcemap:true  //生成tm.map.js文件，方便调试
        },
    ],
}