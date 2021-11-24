(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';

  // import $ from 'jquery'
  // console.log($)
  const adventurer = {
      name: 'Alice',
      cat: {
        name: 'Dinah'
      }
    };
  const dogName = adventurer.dog?.name;
  console.log(dogName);

}));
