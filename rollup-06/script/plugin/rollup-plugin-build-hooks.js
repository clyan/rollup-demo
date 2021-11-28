 const path = require('path');
 const fs = require('fs');
 function rollupPluginBuildHooks() {
    return {
        name: 'BuildHooks',
        options(inputOptions) {
            console.log("======================options======================")
            console.log(this.meta.rollupVersion) // 获取rollup版本信息
            console.log(this.meta.watchMode)     // 获取watchMode
            console.log(inputOptions);
            console.log(this);
            return inputOptions
        },
        buildStart(inputOptions) {
            console.log("======================buildStart======================");
            console.log(inputOptions);
        },
        resolveId(id) {
            console.log("======================resolveId======================");
            // 简单的别名插件
            const fullPath = id.replace('@', path.resolve(__dirname, 'src'));
            return {
              id: id.includes('.js') ? fullPath : fullPath + '.js',
              meta: 'xxx', // 模块meta信息
              moduleSideEffects: true, // 设置当前模块是否有副作用
              syntheticNamedExports: 'xxx' // 默认为false,用法可参考 https://rollupjs.org/guide/en/#synthetic-named-exports
            }
        },
        load(id) {
            console.log("======================load======================");
            // 读取文件内容
            const content = fs.readFileSync(id);
            console.log("content", content);
            // 也可以对代码进行转换 生成等操作
            // transform(content) 
            // generate()
            return {
                code: '/*这是一段注释*/' + content.toString()   
            }
        },
        transform(code, id) {
            console.log("======================transform======================");
            console.log(code)
            return {
                code
            }
        },
        moduleParsed(info) {
            console.log("======================moduleParsed======================");
            console.log(info);
        },
        renderStart(inputOptions, outputOptions) {
            console.log("======================renderStart======================");
            console.log(outputOptions);
            console.log(inputOptions);
          }
      }
}
exports.rollupPluginBuildHooks = rollupPluginBuildHooks

module.exports = rollupPluginBuildHooks