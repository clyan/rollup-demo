let acorn = require('acorn');
let walk = require('./walk');
//parse方法把源代码转成一个抽象语法树
let astTree = acorn.parse(`import $ from 'jquery';`,{
    locations:true,
    ranges:true,
    sourceType:'module',
    ecmaVersion:8
});
let ident = 0;
const padding = ()=>" ".repeat(ident);
//console.log(astTree.body);
//遍历语法树中每一条语句
astTree.body.forEach(statement=>{
    //每一条语句传递给walk方法，由walk遍历这条语句子元素
    //采用是深度优先的方法进行遍历
    walk(statement,{
        enter(node){
            if(node.type){
                console.log(padding()+node.type+'进入');
                ident+=2;
            } 
        },
        leave(node){
            if(node.type){
                ident-=2;
                console.log(padding()+node.type+'离开');
            }
        }
    });
});