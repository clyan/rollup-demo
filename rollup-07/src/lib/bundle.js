const fs = require('fs');
const path = require('path');
const { default: MagicString } = require('magic-string');
const Module = require('./module');
class Bundle{
    constructor(options){
        //入口文件的绝对路径，包括后缀
        this.entryPath = options.entry.replace(/\.js$/,'')+'.js';
        this.modules = {};//存放着所有模块 入口文件和它依赖的模块
    }
    build(outputFileName){
        //从入口文件的绝对路径出发找到它的模块定义
        let entryModule = this.fetchModule(this.entryPath);
        //把这个入口模块所有的语句进行展开，返回所有的语句组成的数组
        this.statements = entryModule.expandAllStatements();
        const {code} = this.generate();
        fs.writeFileSync(outputFileName,code,'utf8');
    }
    //获取模块信息
    fetchModule(importee,importer){
        let route;
        if(!importer){//如果没有模块导入此模块，说是这就是入口模块
            route=importee;
        }else{
            if(path.isAbsolute(importee)){//如果是绝对路径 
                route=importee;
            }else if(importee[0]=='.'){//如果相对路径
                route=path.resolve(path.dirname(importer),importee.replace(/\.js$/,'')+'.js');
            }
        }
        if(route){
            //从硬盘上读出此模块的源代码
            let code = fs.readFileSync(route,'utf8');
            let module = new Module({
                code,//模块的源代码
                path:route,//模块的绝对路径
                bundle:this//属于哪个Bundle
            });    
            return module;
        }
    }
    //把this.statements生成代码
    generate(){
        let magicString = new MagicString.Bundle();
        this.statements.forEach(statement=>{
            const source = statement._source;
            if(statement.type === 'ExportNamedDeclaration' && statement.declaration.type === 'VariableDeclaration'){
                source.remove(statement.start,statement.declaration.start);
            }
            // if (/export/.test(statement.type)) {
            //     if (statement.type === 'ExportNamedDeclaration' && statement.declaration.type === 'VariableDeclaration') {
            //       source.remove(statement.start, statement.declaration.start);
            //     }
            // }
            magicString.addSource({
                content:source,
                separator:'\n'
            });
        });
        return {code:magicString.toString()};
    }
}
module.exports = Bundle;