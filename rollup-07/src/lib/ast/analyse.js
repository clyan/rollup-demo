let Scope = require('./scope');
let walk = require('./walk');
/**
 * 找出当前模块使用到了哪些变量
 * 还要知道哪些变量时当前模块声明的，哪些变量是导入别的模块的变量
 * @param {*} ast 语法树
 * @param {*} magicString 源代码 
 * @param {*} module  属于哪个模块的
 */
function analyse(ast,magicString,module){
    let scope = new Scope();//先创建一个模块内的全局作用域
    //遍历当前的所有的语法树的所有的顶级节点
    ast.body.forEach(statement=>{
        //给作用域添加变量 var function const let 变量声明
        function addToScope(declaration){
            var name = declaration.id.name;//获得这个声明的变量
            scope.add(name);//把say这个变量添加到当前的全局作用域
            if(!scope.parent){//如果当前是全局作用域的话
                statement._defines[name]=true;//在全局作用域下声明一个全局的变量say
            }
        }
        Object.defineProperties(statement,{
            _defines:{value:{}},//存放当前模块定义的所有的全局变量
            _dependsOn:{value:{}},//当前模块没有定义但是使用到的变量，也就是依赖的外部变量
            _included:{value:false,writable:true},//此语句是否已经 被包含到打包结果中了
            //start指的是此节点在源代码中的起始索引,end就是结束索引
            //magicString.snip返回的还是magicString 实例clone
            _source:{value:magicString.snip(statement.start,statement.end)}
        });  
       //这一步在构建我们的作用域链
+      //收集每个statement上的定义的变量，创建作用域链
        walk(statement,{
            enter(node){
                let newScope;
                switch(node.type){
                    case 'FunctionDeclaration':
                        const params = node.params.map(x=>x.name);
                        if(node.type === 'FunctionDeclaration'){
                            addToScope(node);
                        }
                        //如果遍历到的是一个函数声明，我会创建一个新的作用域对象
                        newScope = new Scope({
                            parent:scope,//父作用域就是当前的作用域
                            params 
                        });
                        break;
                    case 'VariableDeclaration': //并不会生成一个新的作用域
                          node.declarations.forEach(addToScope);
                        break;
                }
                if(newScope){//当前节点声明一个新的作用域
                    //如果此节点生成一个新的作用域，那么会在这个节点放一个_scope，指向新的作用域
                    Object.defineProperty(node,'_scope',{value:newScope});
                    scope = newScope;
                }
            },
            leave(node){
                if(node._scope){//如果此节点产出了一个新的作用域，那等离开这个节点，scope回到父作用法域
                    scope = scope.parent;
                }
            }
        });
    });
    console.log('第一次遍历',scope);
    ast._scope = scope;
    //找出外部依赖_dependsOn
    ast.body.forEach(statement=>{
        walk(statement,{
            enter(node){
                if(node._scope ){
                    scope = node._scope;
                } //如果这个节点放有一个scope属笥，说明这个节点产生了一个新的作用域  
                if(node.type === 'Identifier'){
                    //从当前的作用域向上递归，找这个变量在哪个作用域中定义
                    const definingScope = scope.findDefiningScope(node.name);
                    if(!definingScope){
                        statement._dependsOn[node.name]=true;//表示这是一个外部依赖的变量
                    }
                }

            },
            leave(node){
                if(node._scope) {
                    scope = scope.parent;
                }
               
            }
        });
    });

}
module.exports = analyse;