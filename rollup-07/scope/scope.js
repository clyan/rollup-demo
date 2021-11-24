// 作用域链是由当前执行环境与上层执行环境的一系列变量对象组成的，它保证了当前执行环境对符合访问权限的变量和函数的有序访问
class Scope {
  constructor(options = {}) {
    this.name = options.name; // 作用域起个名字，没有什么用，只是帮助 大家认识的
    this.parent = options.parent; //父作用域
    this.names = options.params || []; //此作用内有哪些变量
  }
  add(name) {
    this.names.push(name);
  }
  findDefiningScope(name) {
    if (this.names.includes(name)) {
      return this;
    }
    if (this.parent) {
      return this.parent.findDefiningScope(name);
    }
    return null;
  }
}
module.exports = Scope;
