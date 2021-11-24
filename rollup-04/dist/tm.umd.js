(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';

  function styleInject(css, ref) {
    if ( ref === void 0 ) ref = {};
    var insertAt = ref.insertAt;

    if (!css || typeof document === 'undefined') { return; }

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css_248z$2 = "#app{color:red}";
  styleInject(css_248z$2);

  var css_248z$1 = "#app{background-color:green;height:20px;-webkit-transform:scale(1.1);transform:scale(1.1);width:20px}";
  styleInject(css_248z$1);

  var css_248z = "a{font:.75px 微软雅黑;margin-left:8px;width:16px}";
  styleInject(css_248z);

  // import "./sa.scss";

  console.log(123);

}));
