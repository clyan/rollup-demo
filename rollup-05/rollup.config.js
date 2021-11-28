import copy from 'rollup-plugin-copy'
import { defineConfig } from 'rollup';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload'
export default  defineConfig({
    input: './src/main.js',
    output: {
            file: './dist/js/main.js',
            format: 'umd',
            name: 'TM',
    },
    plugins: [
        copy({
          targets: [
            // { src: ['public/*', '!*.html'], dest: 'dist/'},
            { src: ['public/*'], dest: 'dist/'},
            { src: 'src/assets/imgs/*', dest: 'dist/imgs' },
            { src: 'src/assets/css/external/*', dest: 'dist/css' },
            { src: 'src/assets/js/external/*', dest: 'dist/js' },
          ]
        }),
        livereload(),
        serve({
            // open: true,
            port: 8888,
            contentBase: ''
        }),
    ],
})