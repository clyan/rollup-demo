(function (factory) {
	typeof define === 'function' && define.amd ? define(factory) :
	factory();
})((function () { 'use strict';

	var logo = (typeof document === 'undefined' && typeof location === 'undefined' ? 
    new (require('u' + 'rl').URL)('file:' + __dirname + '/assets/grass-3bb63a57.png').href 
    : new URL('assets/grass-3bb63a57.png', typeof document === 'undefined' ? location.href : document.currentScript && document.currentScript.src || document.baseURI).href);

	const image = document.createElement('img');
	image.src = logo;
	document.body.appendChild(image);
	console.log("123");

}));
