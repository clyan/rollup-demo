let Scope = require('./index');
let a = 1;
function one(){
    let b = 2;
    function two(age){
        let c = 3;
        console.log(a,b,c,age);
    }
    two();
}
one();

// 定义作用域
let globalScope = new Scope({
    name:'globalScope',params:[],parent:null
});
globalScope.add('a');

let oneScope = new Scope({
    name:'oneScope',params:[],parent:globalScope
});
oneScope.add('b');

let twoScope = new Scope({
    name:'twoScope',params:['age'],parent:oneScope
});
twoScope.add('c');

// 使用作用域
let aScope =twoScope.findDefiningScope('a');
console.log(aScope.name); //globalScope

let bScope =twoScope.findDefiningScope('b');
console.log(bScope.name);//oneScope


let cScope =twoScope.findDefiningScope('c');
console.log(cScope.name);//twoScope


let ageScope =twoScope.findDefiningScope('age');
console.log(ageScope.name);//twoScope

let xxxScope =twoScope.findDefiningScope('xxx');
console.log(xxxScope);//null

//tree-shaking原理的核心就是基于这样的一个scope chain