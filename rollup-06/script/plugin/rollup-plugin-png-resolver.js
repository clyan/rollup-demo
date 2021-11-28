const fs = require('fs');
const path = require('path');
function pngResolverPlugin() {
    return {
      name: 'png-resolver',
      resolveId(source, importer) {
        if (source.endsWith('.png')) {
          console.log("resolveId", path.resolve(path.dirname(importer), source))
          // 返回图片的真实路径 ： D:\Desktop\rollup\rollup-06\src\grass.png
          return path.resolve(path.dirname(importer), source);
        }
      },
      load(id) {
        if (id.endsWith('.png')) {
          // id 就是resolveId钩子赶回的路径 如： D:\Desktop\rollup\rollup-06\src\grass.png
          // 使用rollup的 emitFile, 并指定 source 使用 fs.readFileSync 读取文件
          const referenceId = this.emitFile({
            type: 'asset',
            name: path.basename(id),
            source: fs.readFileSync(id)
          });
          console.log("id", id)
          // 导出 import.meta.ROLLUP_FILE_URL_referenceId
          return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
        }
      }
    };
  }
module.exports =  pngResolverPlugin