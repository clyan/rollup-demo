const MagicString = require('magic-string');
const str = new MagicString("export const name = 'ywy'")
// 返回str的克隆，  snip 删除0之前的与6之后的
console.log(str.snip(0, 6).toString()); // export
// 始终是基于原字符串，而不是改变后的字符串
console.log(str.remove(0, 7).toString()); // const name = 'ywy';

// 很多模块，将他们打包在一个文件中，需要将 很多文件的源代码合并在一起
let bundleString = new MagicString.Bundle();
bundleString.addSource({
    content: 'var a = 1;',
    separator: '\n'
})
bundleString.addSource({
    content: 'var b = 1;',
    separator: '\n'
})

console.log(bundleString.toString())