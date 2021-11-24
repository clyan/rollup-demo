import copy from './plugin/rollup-plugin-copy'
import easyHtml from './plugin/rollup-plugin-easy-html'
import serve from 'rollup-plugin-serve'
module.exports = {
    input: {
        main: './src/main.js', 
    },
    output: [
        {
            dir: './dist',
            format: 'umd',  
            name: 'TM',
        }
    ],
    plugins: [
        copy({
          targets: [
            // { src: ['public/*', '!*.html'], dest: 'dist/'},
            { src: 'src/assets/imgs/*', dest: 'dist/imgs' },
            { src: 'src/assets/css/external/*', dest: 'dist/css' },
            { src: 'src/assets/js/external/*', dest: 'dist/js' },
          ]
        }),
        easyHtml({
            template: 'public/index.html',
            title: '构建应用',
            minify: false,
            meta: {
                description: 'Generated with Rollup',
            },
            favicon: 'public/favicon.ico',
            externals: {
                before: [{
                  tag:  'link',
                  href: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
                  crossorigin: 'use-credentials',
                }],
                after: [{
                  tag:  'style',
                  text: `
                    body {
                      margin:  0;
                      height:  calc(100vh - 1px);
                      display: flex;
                    }
                  `,
                }, {
                  tag:  'script',
                  src: './js/external/*',
                }],
              }
        }),
        serve({
            // open: true,
            port: 8888,
            contentBase: 'dist'
        })
    ]
}   