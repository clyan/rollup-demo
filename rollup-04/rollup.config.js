import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer'
import path from 'path'
module.exports = {
    input: ['main.js'],
    output: [
        {
            file: 'dist/tm.umd.js',
            format: 'umd',  
            name: 'TM',
        }
    ],
    plugins: [
        postcss({
            extract: true,
            // Or with custom file name
            extract: path.resolve('dist/main.css'),
            minimize: true,
            plugins:[
                autoprefixer(),
            ]
        }),
    ]
}   