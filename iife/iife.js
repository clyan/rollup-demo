var b = 2;
;(function foo(global) {
  const a = 123;
   console.log(a) // 123
  console.log(global.b) // 2
})(window)

;(function foo(global) {
  const a = 456;
  console.log(a) //456
  console.log(global.b) // 2
})(window)
console.log(b) // 2
console.log(a) //  a is not defined