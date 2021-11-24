// 模块有模块
define(["custom-normal-variable"], function(dep) {
    console.log(dep)
    return {
        ...dep,
        opacity: 0
    }
});