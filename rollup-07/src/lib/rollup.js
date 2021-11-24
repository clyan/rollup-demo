let Bundle = require('./bundle');
function rollup(entry,outputFileName){
    //Bundle就代表打包对象，里面会包含所有的模块信息
    const bundle = new Bundle({entry});
    //调用build方法开始进行编译
    bundle.build(outputFileName);
}
module.exports = rollup;