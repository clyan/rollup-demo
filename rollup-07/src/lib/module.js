let MagicString = require('magic-string');
const {parse} = require('acorn');
const analyse = require('./ast/analyse');
//判断一下obj对象上是否有prop属性
function hasOwnProperty(obj,prop){
    return Object.prototype.hasOwnProperty.call(obj,prop);
}
/**
 * 每个文件都是一个模块，每个模块都会对应一个Module实例
 */
class Module{
    constructor({code,path,bundle}){
        this.code = new MagicString(code,{filename:path});
        this.path = path;//模块的路径
        this.bundle = bundle;//属于哪个bundle的实例
        this.ast = parse(code,{//把源代码转成抽象语法树
            ecmaVersion:7,
            sourceType:'module'
        });
        this.analyse();
    }
    analyse(){
        this.imports = {};//存放着当前模块所有的导入
        this.exports = {};//存放着当前模块所有的导出
        this.ast.body.forEach(node=>{
            if(node.type === 'ImportDeclaration'){//说明这是一个导入语句
                let source  = node.source.value;//./msg 从哪个模块进行的导入
                let specifiers = node.specifiers;
                specifiers.forEach(specifier=>{
                    const name = specifier.imported.name;//name
                    const localName = specifier.local.name;//name
                    //本地的哪个变量，是从哪个模块的的哪个变量导出的
                    //this.imports.age = {name:'age',localName:"age",source:'./msg'};
                    this.imports[localName]={name,localName,source}
                });
            //}else if(/^Export/.test(node.type)){
            }else if(node.type === 'ExportNamedDeclaration'){
                let declaration = node.declaration;//VariableDeclaration
                if(declaration.type === 'VariableDeclaration'){
                    let name = declaration.declarations[0].id.name;//age
                    //记录一下当前模块的导出 这个age通过哪个表达式创建的
                    //this.exports['age']={node,localName:age,expression}
                    this.exports[name] = {
                        node,localName:name,expression:declaration
                    }
                }
            }
        });
        analyse(this.ast,this.code,this);//找到了_defines 和 _dependsOn
        this.definitions = {};//存放着所有的全局变量的定义语句
        this.ast.body.forEach(statement=>{
            Object.keys(statement._defines).forEach(name=>{
                //key是全局变量名，值是定义这个全局变量的语句
                this.definitions[name]=statement;
            });
        });

    }
    //展开这个模块里的语句，把些语句中定义的变量的语句都放到结果里
    expandAllStatements(){
        let allStatements = [];
        this.ast.body.forEach(statement=>{
            if(statement.type === 'ImportDeclaration'){return}
            let statements = this.expandStatement(statement);
            allStatements.push(...statements);
        });
        return allStatements;
    }
    //展开一个节点
    //找到当前节点依赖的变量，它访问的变量，找到这些变量的声明语句。
    //这些语句可能是在当前模块声明的，也也可能是在导入的模块的声明的
    expandStatement(statement){
      let result = [];
      const dependencies = Object.keys(statement._dependsOn);//外部依赖 [name]
      dependencies.forEach(name=>{
          //找到定义这个变量的声明节点，这个节点可以有在当前模块内，也可能在依赖的模块里
          let definition = this.define(name);
          result.push(...definition);
      });
      if(!statement._included){
        statement._included = true;//表示这个节点已经确定被纳入结果 里了，以后就不需要重复添加了
        result.push(statement);
      } 
      return result;
    }
    define(name){
        //查找一下导入变量里有没有name
        if(hasOwnProperty(this.imports,name)){
            //this.imports.age = {name:'age',localName:"age",source:'./msg'};
            const importData = this.imports[name];
            //获取msg模块 exports imports msg模块
            const module = this.bundle.fetchModule(importData.source,this.path);
            //this.exports['age']={node,localName:age,expression}
            const exportData = module.exports[importData.name];
            //调用msg模块的define方法，参数是msg模块的本地变量名age,目的是为了返回定义age变量的语句
            return module.define(exportData.localName);
        }else{
            //definitions是对象,key当前模块的变量名，值是定义这个变量的语句
            let statement = this.definitions[name];
            if(statement && !statement._included){
                return this.expandStatement(statement);
            }else{
                return [];
            }
        }
    }
}
module.exports = Module;