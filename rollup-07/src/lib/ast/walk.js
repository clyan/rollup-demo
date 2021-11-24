/**
 * 
 * @param {*} ast 要遍历的语法树
 * @param {*} param1 配置对象
 */
 function walk(ast, { enter, leave }) {
    visit(ast, null, enter, leave);
}
/**
 * 访问此node节点
 * @param {*} node 
 * @param {*} parent 
 * @param {*} enter 
 * @param {*} leave 
 */
function visit(node, parent, enter, leave) {
    if (enter) {//先执行此节点的enter方法
        enter(node, parent);//不关心this就可以这么写
        //enter.call(null,node,parent);//如果你想指定enter中的this
    }
    //再遍历子节点 找出那些是对象的子节点
    let childKeys = Object.keys(node).filter(key => typeof node[key] === 'object');
    childKeys.forEach(childKey => {//childKey=specifiers value=[]
        let value = node[childKey];
        if (Array.isArray(value)) {
            value.forEach((val) => visit(val, node, enter, leave));
        } else {
            visit(value, node, enter, leave)
        }
    });
    //再执行离开方法
    if (leave) {
        leave(node, parent);
    }
}
module.exports = walk;