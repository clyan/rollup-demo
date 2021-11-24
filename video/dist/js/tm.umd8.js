(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.TM = {}));
})(this, (function (exports) { 'use strict';

	/*! npm.im/intervalometer */
	function intervalometer(cb, request, cancel, requestParameter) {
		var requestId;
		var previousLoopTime;
		function loop(now) {
			// Must be requested before cb() because that might call .stop()
			requestId = request(loop, requestParameter);

			// Called with "ms since last call". 0 on start()
			cb(now - (previousLoopTime || now));

			previousLoopTime = now;
		}

		return {
			start: function start() {
				if (!requestId) { // Prevent double starts
					loop(0);
				}
			},
			stop: function stop() {
				cancel(requestId);
				requestId = null;
				previousLoopTime = 0;
			}
		};
	}

	function frameIntervalometer(cb) {
		return intervalometer(cb, requestAnimationFrame, cancelAnimationFrame);
	}

	/*! npm.im/iphone-inline-video 2.2.2 */

	function preventEvent(element, eventName, test) {
		function handler(e) {
			if (!test || test(element, eventName)) {
				e.stopImmediatePropagation();
				// // console.log(eventName, 'prevented on', element);
			}
		}
		element.addEventListener(eventName, handler);

		// Return handler to allow to disable the prevention. Usage:
		// const preventionHandler = preventEvent(el, 'click');
		// el.removeEventHandler('click', preventionHandler);
		return handler;
	}

	function proxyProperty(object, propertyName, sourceObject, copyFirst) {
		function get() {
			return sourceObject[propertyName];
		}
		function set(value) {
			sourceObject[propertyName] = value;
		}

		if (copyFirst) {
			set(object[propertyName]);
		}

		Object.defineProperty(object, propertyName, {get: get, set: set});
	}

	function proxyEvent(object, eventName, sourceObject) {
		sourceObject.addEventListener(eventName, function () { return object.dispatchEvent(new Event(eventName)); });
	}

	function dispatchEventAsync(element, type) {
		Promise.resolve().then(function () {
			element.dispatchEvent(new Event(type));
		});
	}

	var iOS8or9 = typeof document === 'object' && 'object-fit' in document.head.style && !matchMedia('(-webkit-video-playable-inline)').matches;

	var IIV = 'bfred-it:iphone-inline-video';
	var IIVEvent = 'bfred-it:iphone-inline-video:event';
	var IIVPlay = 'bfred-it:iphone-inline-video:nativeplay';
	var IIVPause = 'bfred-it:iphone-inline-video:nativepause';

	/**
	 * UTILS
	 */

	function getAudioFromVideo(video) {
		var audio = new Audio();
		proxyEvent(video, 'play', audio);
		proxyEvent(video, 'playing', audio);
		proxyEvent(video, 'pause', audio);
		audio.crossOrigin = video.crossOrigin;

		// 'data:' causes audio.networkState > 0
		// which then allows to keep <audio> in a resumable playing state
		// i.e. once you set a real src it will keep playing if it was if .play() was called
		audio.src = video.src || video.currentSrc || 'data:';

		// // if (audio.src === 'data:') {
		//   TODO: wait for video to be selected
		// // }
		return audio;
	}

	var lastRequests = [];
	var requestIndex = 0;
	var lastTimeupdateEvent;

	function setTime(video, time, rememberOnly) {
		// Allow one timeupdate event every 200+ ms
		if ((lastTimeupdateEvent || 0) + 200 < Date.now()) {
			video[IIVEvent] = true;
			lastTimeupdateEvent = Date.now();
		}
		if (!rememberOnly) {
			video.currentTime = time;
		}
		lastRequests[++requestIndex % 3] = time * 100 | 0 / 100;
	}

	function isPlayerEnded(player) {
		return player.driver.currentTime >= player.video.duration;
	}

	function update(timeDiff) {
		var player = this;
		// // console.log('update', player.video.readyState, player.video.networkState, player.driver.readyState, player.driver.networkState, player.driver.paused);
		if (player.video.readyState >= player.video.HAVE_FUTURE_DATA) {
			if (!player.hasAudio) {
				player.driver.currentTime = player.video.currentTime + ((timeDiff * player.video.playbackRate) / 1000);
				if (player.video.loop && isPlayerEnded(player)) {
					player.driver.currentTime = 0;
				}
			}
			setTime(player.video, player.driver.currentTime);
		} else if (player.video.networkState === player.video.NETWORK_IDLE && player.video.buffered.length === 0) {
			// This should happen when the source is available but:
			// - it's potentially playing (.paused === false)
			// - it's not ready to play
			// - it's not loading
			// If it hasAudio, that will be loaded in the 'emptied' handler below
			player.video.load();
			// // console.log('Will load');
		}

		// // console.assert(player.video.currentTime === player.driver.currentTime, 'Video not updating!');

		if (player.video.ended) {
			delete player.video[IIVEvent]; // Allow timeupdate event
			player.video.pause(true);
		}
	}

	/**
	 * METHODS
	 */

	function play() {
		// // console.log('play');
		var video = this;
		var player = video[IIV];

		// If it's fullscreen, use the native player
		if (video.webkitDisplayingFullscreen) {
			video[IIVPlay]();
			return;
		}

		if (player.driver.src !== 'data:' && player.driver.src !== video.src) {
			// // console.log('src changed on play', video.src);
			setTime(video, 0, true);
			player.driver.src = video.src;
		}

		if (!video.paused) {
			return;
		}
		player.paused = false;

		if (video.buffered.length === 0) {
			// .load() causes the emptied event
			// the alternative is .play()+.pause() but that triggers play/pause events, even worse
			// possibly the alternative is preventing this event only once
			video.load();
		}

		player.driver.play();
		player.updater.start();

		if (!player.hasAudio) {
			dispatchEventAsync(video, 'play');
			if (player.video.readyState >= player.video.HAVE_ENOUGH_DATA) {
				// // console.log('onplay');
				dispatchEventAsync(video, 'playing');
			}
		}
	}
	function pause(forceEvents) {
		// // console.log('pause');
		var video = this;
		var player = video[IIV];

		player.driver.pause();
		player.updater.stop();

		// If it's fullscreen, the developer the native player.pause()
		// This is at the end of pause() because it also
		// needs to make sure that the simulation is paused
		if (video.webkitDisplayingFullscreen) {
			video[IIVPause]();
		}

		if (player.paused && !forceEvents) {
			return;
		}

		player.paused = true;
		if (!player.hasAudio) {
			dispatchEventAsync(video, 'pause');
		}

		// Handle the 'ended' event only if it's not fullscreen
		if (video.ended && !video.webkitDisplayingFullscreen) {
			video[IIVEvent] = true;
			dispatchEventAsync(video, 'ended');
		}
	}

	/**
	 * SETUP
	 */

	function addPlayer(video, hasAudio) {
		var player = {};
		video[IIV] = player;
		player.paused = true; // Track whether 'pause' events have been fired
		player.hasAudio = hasAudio;
		player.video = video;
		player.updater = frameIntervalometer(update.bind(player));

		if (hasAudio) {
			player.driver = getAudioFromVideo(video);
		} else {
			video.addEventListener('canplay', function () {
				if (!video.paused) {
					// // console.log('oncanplay');
					dispatchEventAsync(video, 'playing');
				}
			});
			player.driver = {
				src: video.src || video.currentSrc || 'data:',
				muted: true,
				paused: true,
				pause: function () {
					player.driver.paused = true;
				},
				play: function () {
					player.driver.paused = false;
					// Media automatically goes to 0 if .play() is called when it's done
					if (isPlayerEnded(player)) {
						setTime(video, 0);
					}
				},
				get ended() {
					return isPlayerEnded(player);
				}
			};
		}

		// .load() causes the emptied event
		video.addEventListener('emptied', function () {
			// // console.log('driver src is', player.driver.src);
			var wasEmpty = !player.driver.src || player.driver.src === 'data:';
			if (player.driver.src && player.driver.src !== video.src) {
				// // console.log('src changed to', video.src);
				setTime(video, 0, true);
				player.driver.src = video.src;
				// Playing videos will only keep playing if no src was present when .play()’ed
				if (wasEmpty || (!hasAudio && video.autoplay)) {
					player.driver.play();
				} else {
					player.updater.stop();
				}
			}
		}, false);

		// Stop programmatic player when OS takes over
		video.addEventListener('webkitbeginfullscreen', function () {
			if (!video.paused) {
				// Make sure that the <audio> and the syncer/updater are stopped
				video.pause();

				// Play video natively
				video[IIVPlay]();
			} else if (hasAudio && player.driver.buffered.length === 0) {
				// If the first play is native,
				// the <audio> needs to be buffered manually
				// so when the fullscreen ends, it can be set to the same current time
				player.driver.load();
			}
		});
		if (hasAudio) {
			video.addEventListener('webkitendfullscreen', function () {
				// Sync audio to new video position
				player.driver.currentTime = video.currentTime;
				// // console.assert(player.driver.currentTime === video.currentTime, 'Audio not synced');
			});

			// Allow seeking
			video.addEventListener('seeking', function () {
				if (lastRequests.indexOf(video.currentTime * 100 | 0 / 100) < 0) {
					// // console.log('User-requested seeking');
					player.driver.currentTime = video.currentTime;
				}
			});
		}
	}

	function preventWithPropOrFullscreen(el) {
		var isAllowed = el[IIVEvent];
		delete el[IIVEvent];
		return !el.webkitDisplayingFullscreen && !isAllowed;
	}

	function overloadAPI(video) {
		var player = video[IIV];
		video[IIVPlay] = video.play;
		video[IIVPause] = video.pause;
		video.play = play;
		video.pause = pause;
		proxyProperty(video, 'paused', player.driver);
		proxyProperty(video, 'muted', player.driver, true);
		proxyProperty(video, 'playbackRate', player.driver, true);
		proxyProperty(video, 'ended', player.driver);
		proxyProperty(video, 'loop', player.driver, true);

		// IIV works by seeking 60 times per second.
		// These events are now useless.
		preventEvent(video, 'seeking', function (el) { return !el.webkitDisplayingFullscreen; });
		preventEvent(video, 'seeked', function (el) { return !el.webkitDisplayingFullscreen; });

		// Limit timeupdate events
		preventEvent(video, 'timeupdate', preventWithPropOrFullscreen);

		// Prevent occasional native ended events
		preventEvent(video, 'ended', preventWithPropOrFullscreen);
	}

	function enableInlineVideo(video, opts) {
		if ( opts === void 0 ) opts = {};

		// Stop if already enabled
		if (video[IIV]) {
			return;
		}

		// Allow the user to skip detection
		if (!opts.everywhere) {
			// Only iOS8 and 9 are supported
			if (!iOS8or9) {
				return;
			}

			// Stop if it's not an allowed device
			if (!(opts.iPad || opts.ipad ? /iPhone|iPod|iPad/ : /iPhone|iPod/).test(navigator.userAgent)) {
				return;
			}
		}

		// Try to pause
		video.pause();

		// Prevent autoplay.
		// An non-started autoplaying video can't be .pause()'d
		var willAutoplay = video.autoplay;
		video.autoplay = false;

		addPlayer(video, !video.muted);
		overloadAPI(video);
		video.classList.add('IIV');

		// Autoplay
		if (video.muted && willAutoplay) {
			video.play();
			video.addEventListener('playing', function restoreAutoplay() {
				video.autoplay = true;
				video.removeEventListener('playing', restoreAutoplay);
			});
		}

		if (!/iPhone|iPod|iPad/.test(navigator.platform)) {
			console.warn('iphone-inline-video is not guaranteed to work in emulated environments');
		}
	}

	var stringify = function stringify(query) {
	    if (typeof query == 'string') return query;

	    var i;
	    var result = [];

	    for (i in query) {
	        if (query.hasOwnProperty(i)) {
	            result.push(i + '=' + encodeURIComponent(query[i]));
	        }
	    }

	    return result.join('&');
	};

	var classCallCheck = function (instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	};

	var createClass = function () {
	  function defineProperties(target, props) {
	    for (var i = 0; i < props.length; i++) {
	      var descriptor = props[i];
	      descriptor.enumerable = descriptor.enumerable || false;
	      descriptor.configurable = true;
	      if ("value" in descriptor) descriptor.writable = true;
	      Object.defineProperty(target, descriptor.key, descriptor);
	    }
	  }

	  return function (Constructor, protoProps, staticProps) {
	    if (protoProps) defineProperties(Constructor.prototype, protoProps);
	    if (staticProps) defineProperties(Constructor, staticProps);
	    return Constructor;
	  };
	}();

	var inherits = function (subClass, superClass) {
	  if (typeof superClass !== "function" && superClass !== null) {
	    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	  }

	  subClass.prototype = Object.create(superClass && superClass.prototype, {
	    constructor: {
	      value: subClass,
	      enumerable: false,
	      writable: true,
	      configurable: true
	    }
	  });
	  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	};

	var possibleConstructorReturn = function (self, call) {
	  if (!self) {
	    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  }

	  return call && (typeof call === "object" || typeof call === "function") ? call : self;
	};

	navigator.userAgent.match(/NEJSBridge\/([\d.]+)\b/);

	var APIAbstract = function () {
	    function APIAbstract() {
	        classCallCheck(this, APIAbstract);
	    }

	    createClass(APIAbstract, [{
	        key: 'getLegacyProtocolConfig',
	        value: function getLegacyProtocolConfig(actionName, data) {
	            
	        }
	    }, {
	        key: 'getComputedUrl',
	        value: function getComputedUrl(path) {
	            if (/^[\w0-9]+:\/\//.test(path)) {
	                //'necomics://manhua.163.com/v1', nereader://yuedu.163.com/v1?
	                return path;
	            }

	            return this.schemaName_ + '://' + path;
	        }
	    }]);
	    return APIAbstract;
	}();
	/* eslint-disable no-unused-vars */
	var getOwnPropertySymbols = Object.getOwnPropertySymbols;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;

	function toObject(val) {
		if (val === null || val === undefined) {
			throw new TypeError('Object.assign cannot be called with null or undefined');
		}

		return Object(val);
	}

	function shouldUseNative() {
		try {
			if (!Object.assign) {
				return false;
			}

			// Detect buggy property enumeration order in older V8 versions.

			// https://bugs.chromium.org/p/v8/issues/detail?id=4118
			var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
			test1[5] = 'de';
			if (Object.getOwnPropertyNames(test1)[0] === '5') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test2 = {};
			for (var i = 0; i < 10; i++) {
				test2['_' + String.fromCharCode(i)] = i;
			}
			var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
				return test2[n];
			});
			if (order2.join('') !== '0123456789') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test3 = {};
			'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
				test3[letter] = letter;
			});
			if (Object.keys(Object.assign({}, test3)).join('') !==
					'abcdefghijklmnopqrst') {
				return false;
			}

			return true;
		} catch (err) {
			// We don't expect any of the above to throw, but better to be safe.
			return false;
		}
	}

	shouldUseNative() ? Object.assign : function (target, source) {
		var from;
		var to = toObject(target);
		var symbols;

		for (var s = 1; s < arguments.length; s++) {
			from = Object(arguments[s]);

			for (var key in from) {
				if (hasOwnProperty.call(from, key)) {
					to[key] = from[key];
				}
			}

			if (getOwnPropertySymbols) {
				symbols = getOwnPropertySymbols(from);
				for (var i = 0; i < symbols.length; i++) {
					if (propIsEnumerable.call(from, symbols[i])) {
						to[symbols[i]] = from[symbols[i]];
					}
				}
			}
		}

		return to;
	};

	var pageShowActions = {};
	if (window.addEventListener) {
	    window.addEventListener('pageshow', function (event) {
	        if (event.persisted || window.performance && window.performance.navigation.type === 2) {
	            for (var pageShowActionsKey in pageShowActions) {
	                if (typeof pageShowActions[pageShowActionsKey] === 'function') {
	                    pageShowActions[pageShowActionsKey]();
	                }
	            }
	        }
	    }, false);
	}

	var getAppVersion = function getAppVersion() {
	    var userAgent = navigator.userAgent;

	    if (!userAgent.match(/(iPhone|iPad)/) && !userAgent.match(/Android/)) {
	        return false;
	    }

	    var clientVersionPatternArray = null;
	    if (userAgent.match(/(iPhone|iPad)/)) {
	        clientVersionPatternArray = userAgent.match(/\bLofter-iPhone ([.0-9]+)\b/i);
	    } else if (userAgent.match(/Android/)) {
	        clientVersionPatternArray = userAgent.match(/\bLofter-android\/([.0-9]+)\b/i);
	    }

	    if (!clientVersionPatternArray) {
	        return false;
	    }

	    var clientVersionArray = clientVersionPatternArray[1].split('.');
	    return {
	        mainVersion: parseInt(clientVersionArray[0], 10),
	        subVersion: parseInt(clientVersionArray[1], 10)
	    };
	};

	var getShouldUseNewSchema = function getShouldUseNewSchema() {
	    var clientVersionObj = getAppVersion();

	    if (!clientVersionObj) return false;

	    if (clientVersionObj.mainVersion > 2 || clientVersionObj.mainVersion === 2 && clientVersionObj.subVersion >= 4) {
	        return true;
	    }

	    return false;
	};

	var getPageRedirectData = function getPageRedirectData(data) {
	    var shouldUseNewSchema = getShouldUseNewSchema();

	    var action = void 0;
	    var newSchemaQuery = {};
	    var defaultQuery = {};

	    switch (data.path) {

	        case 'webview':
	            action = 1;
	            newSchemaQuery.url = data.query.url;

	            if (data.query.auth) {
	                newSchemaQuery.auth = data.query.auth;
	            }

	            if (data.query.title) {
	                newSchemaQuery.title = data.query.title;
	            }

	            defaultQuery.url = data.query.url;

	            break;
	    }

	    var newSchemaPath = 'necomics://manhua.163.com/v1';

	    newSchemaQuery.action = action;

	    if (shouldUseNewSchema) {
	        return {
	            path: newSchemaPath,
	            query: newSchemaQuery
	        };
	    }

	    defaultQuery.actionUrl = newSchemaPath + '?' + stringify(newSchemaQuery);

	    return {
	        path: 'shareCallback',
	        query: defaultQuery
	    };
	};

	(function (_APIAbstract) {
	    inherits(APILofter, _APIAbstract);

	    function APILofter() {
	        classCallCheck(this, APILofter);

	        var _this = possibleConstructorReturn(this, (APILofter.__proto__ || Object.getPrototypeOf(APILofter)).call(this));

	        _this.schemaName_ = 'neteaselofter';
	        return _this;
	    }

	    createClass(APILofter, [{
	        key: 'isInApp',
	        value: function isInApp() {
	            return navigator.userAgent.indexOf('Lofter') !== -1;
	        }
	    }, {
	        key: 'getLegacyProtocolConfig',
	        value: function getLegacyProtocolConfig(actionName, data) {
	            switch (actionName) {
	                /**
	                 * @api {post} saveShareContent 传给客户端保存待分享的内容
	                 * @apiName saveShareContent
	                 * @apiGroup General
	                 * @apiDescription 传给客户端保存待分享的内容
	                 * @apiParam {Object}         shareCnt   需要分享的内容
	                 * @apiParam (shareCnt)       {Number}   id              分享id，固定为6002即可
	                 * @apiParam (shareCnt)       {String}   url             分享链接
	                 * @apiParam (shareCnt)       {Object}   content         分享内容数据对象
	                 * @apiParam (content)        {String}   weiboImg        微博分享图片
	                 * @apiParam (content)        {String}   weiboDesc       微博分享描述
	                 * @apiParam (content)        {String}   fImg            微信分享图片
	                 * @apiParam (content)        {String}   fDesc           微信分享描述
	                 * @apiParam (content)        {String}   fTitle          微信分享标题
	                 * @apiParam (content)        {Array}    domains         传空数组即可
	                 * @apiParam (content)        {Object}   lofterContent   lofter分享内容
	                 * @apiParam (lofterContent)  {String}   lTitle          lofter分享标题
	                 * @apiParam (lofterContent)  {String}   lImg            lofter分享图片
	                 * @apiParam (lofterContent)  {String}   price           lofter分享价格
	                 * @apiParam (lofterContent)  {String}   ext             lofter分享预留字段
	                 */

	                case 'saveShareContent':
	                    return {
	                        actionName: 'saveShareContent',
	                        data: data ? data : {}
	                    };

	                /**
	                 * @api {get} showMenu 弹出分享组件
	                 * @apiName showMenu
	                 * @apiGroup General
	                 * @apiDescription 弹出分享组件
	                 */

	                case 'showMenu':

	                    return {
	                        actionName: 'showMenu'

	                        /**
	                         * @api {get} hideActionMenu 隐藏当前webview的分享按钮
	                         * @apiName hideActionMenu
	                         * @apiGroup General
	                         * @apiDescription 隐藏当前webview的分享按钮
	                         */

	                    };case 'hideActionMenu':

	                    return {
	                        actionName: 'hideActionMenu'

	                        /**
	                         * @api {post} saveImage 下载图片到系统相册
	                         * @apiName saveImage
	                         * @apiGroup General
	                         * @apiDescription 下载图片到系统相册
	                         * @apiParam {Object}  imgdata  "{url:图片链接,data:图片的base64编码}"
	                         * @apiParam (imgdata)  url     图片链接;url为空字符串时，启用下一个参数
	                         * @apiParam (imgdata)  [data]  图片的base64编码
	                         */

	                    };case 'saveImage':
	                    return {
	                        actionName: 'saveImage',
	                        data: data ? data : {}
	                    };

	                /**
	                 * @api {get} pickAndUploadPhoto 从本地相册选择图片并上传
	                 * @apiName pickAndUploadPhoto
	                 * @apiGroup General
	                 * @apiDescription 从本地相册选择图片并上传
	                 * @apiParam {json} jsondata   字符串，如："{maxsize:1080}" 。 支持传递参数，无参数时，需传递null值;maxsize属性表示图片的最大尺寸
	                 */

	                case 'pickAndUploadPhoto':
	                    return {
	                        actionName: 'pickAndUploadPhoto',
	                        data: data ? data : null
	                    };

	                /**
	                 * @api {get} isSupportWXPaySDK 询问客户端是否支持微信支付
	                 * @apiName isSupportWXPaySDK
	                 * @apiGroup General
	                 * @apiDescription 询问客户端是否支持微信支付
	                 *
	                 * @apiSuccess {Boolean} true表示支持，false为不支持
	                 */

	                case 'isSupportWXPaySDK':

	                    return {
	                        actionName: 'isSupportWXPaySDK'
	                    };

	                /**
	                 * @api {get} openSystemConfig 弹出弹窗，提示用户去开启系统通知
	                 * @apiName openSystemConfig
	                 * @apiGroup General
	                 * @apiDescription 在用户在乐乎市集产生了新订单，下单并付款完成后弹出
	                 */

	                case 'openSystemConfig':

	                    return {
	                        actionName: 'openSystemConfig'
	                    };

	                /**
	                 * @api {post} setLofterBackUrl 设置路径回调
	                 * @apiName setLofterBackUrl
	                 * @apiGroup General
	                 * @apiDescription 设置路径回调
	                 * @apiParam {String} url 页面url字符串
	                 */

	                case 'setLofterBackUrl':
	                    var backUrl = data.url ? data.url : 'https://www.lofter.com/market/fe/home/homePage.html';
	                    return {
	                        actionName: 'setLofterBackUrl',
	                        data: backUrl
	                    };
	                /**
	                 * @api {post} njb_setPageTitle 修改页面title
	                 * @apiName njb_setPageTitle
	                 * @apiGroup General
	                 * @apiDescription 修改页面title
	                 * @apiParam {String} title 页面title字符串
	                 */

	                case 'njb_setPageTitle':
	                    var title = data ? data : { title: '乐乎市集' };
	                    return {
	                        actionName: 'njb_setPageTitle',
	                        data: title
	                    };

	                /**
	                 * @api {get} refreshMainPageWhenClose 标识关闭当前webview时刷新乐乎市集tab首页
	                 * @apiName refreshMainPageWhenClose
	                 * @apiGroup General
	                 * @apiDescription 前端调这个接口的时候，客户端记一个标志，标识关闭当前webview时刷新乐乎市集tab首页，不做实时刷新了
	                 */

	                case 'refreshMainPageWhenClose':

	                    return {
	                        actionName: 'refreshMainPageWhenClose'

	                        /**
	                         * @api {post} triggerLofterPaySDK 唤起支付
	                         * @apiName triggerLofterPaySDK
	                         * @apiGroup General
	                         * @apiDescription 唤起支付
	                         * @apiParam {Number} type 参数type=0为支付宝支付，type=1为微信支付，type=2为IAP（苹果应用内支付）。当type=0时，params为要传递给支付宝的参数(字符串)
	                         */

	                    };case 'triggerLofterPaySDK':
	                    return {
	                        actionName: 'triggerLofterPaySDK',
	                        data: data ? data : {}
	                    };

	                /**
	                 * @api {post} updateCurrentUrl 通知APP更新页面URL
	                 * @apiName updateCurrentUrl
	                 * @apiGroup General
	                 * @apiDescription 通知APP更新页面URL
	                 * @apiParam {String} url 页面url字符串
	                 */

	                case 'updateCurrentUrl':
	                    var currentUrl = data.url ? data.url : 'https://www.lofter.com/market/fe/home/homePage.html';
	                    return {
	                        actionName: 'updateCurrentUrl',
	                        data: currentUrl
	                    };

	                /**
	                 * @api {post} njb_login 唤起登录
	                 * @apiName njb_login
	                 * @apiGroup v8
	                 * @apiDescription 唤起登录
	                 * @apiParam {Function} callback 登录后的回调
	                 */

	                case 'njb_login':
	                    return {
	                        actionName: 'njb_login',
	                        data: { callback: data.callback }
	                    };

	                /**
	                 * @api {get} njb_updateClient 更新客户端或跳转应用商店
	                 * @apiName njb_updateClient
	                 * @apiGroup v7
	                 * @apiDescription 更新客户端或跳转应用商店
	                 */

	                case 'njb_updateClient':
	                    return {
	                        actionName: 'njb_updateClient'
	                    };

	                /**
	                 * @api {get} njb_closeCurrentWebview 关闭当前webview
	                 * @apiName njb_closeCurrentWebview
	                 * @apiGroup v7
	                 * @apiDescription 关闭当前webview
	                 */

	                case 'njb_closeCurrentWebview':
	                    return {
	                        actionName: 'njb_closeCurrentWebview'
	                    };

	                /**
	                 * @api {post} njb_share 主动分享并设置该次调用的分享参数
	                 * @apiName njb_share
	                 * @apiGroup v7
	                 * @apiDescription 主动分享并设置该次调用的分享参数
	                 * @apiParam {Object} shareCnt   需要分享的内容，具体参数同saveShareContent
	                 */

	                case 'njb_share':
	                    return {
	                        actionName: 'njb_share',
	                        data: data ? data : {}
	                    };

	                /**
	                 * @api {get} njb_getAppLog 获取客户端日志的nos链接
	                 * @apiName njb_getAppLog
	                 * @apiGroup v7
	                 * @apiDescription 获取客户端日志的nos链接
	                 */

	                case 'njb_getAppLog':
	                    return {
	                        actionName: 'njb_getAppLog'
	                    };

	                /**
	                 * @api {POST} njb_providePullDownRefresh 提供下拉刷新
	                 * @apiName njb_providePullDownRefresh
	                 * @apiGroup v7
	                 * @apiDescription 提供下拉刷新
	                 * @apiParam {Boolean} provide 是否提供下拉刷新
	                 */

	                case 'njb_providePullDownRefresh':
	                    return {
	                        actionName: 'njb_providePullDownRefresh',
	                        data: data ? data.provide : false
	                    };

	                /**
	                 * @api {post} njb_reportLogToApp 主动通过app上报web日志
	                 * @apiName njb_reportLogToApp
	                 * @apiGroup v10
	                 * @apiDescription 主动通过app上报web日志
	                 * @apiParam {Object}         logContent   需要上报的内容
	                 * @apiParam (logContent)       {String}   page         页面或者应用标识
	                 * @apiParam (logContent)       {String}   timing       时机(比如请求发起、页面加载完成等时候，优先使用performance api中的定义字段)
	                 * @apiParam (logContent)       {String}   log         具体信息
	                 */

	                case 'njb_reportLogToApp':
	                    var logContent = '[' + (data.page ? data.page : location.href) + '] ' + (data.timing || '') + ': ' + (data.log || 'no log info.');
	                    return {
	                        actionName: 'njb_reportLogToApp',
	                        data: logContent
	                    };

	                case 'pageRedirect':

	                    return {
	                        data: getPageRedirectData(data)
	                    };
	            }
	        }
	    }]);
	    return APILofter;
	})(APIAbstract);

	var USER_AGENT = navigator.userAgent;
	function isWeixin() {
	  return /micromessenger/i.test(USER_AGENT);
	}

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var axios$1 = {exports: {}};

	(function (module, exports) {
	(function webpackUniversalModuleDefinition(root, factory) {
		module.exports = factory();
	})(commonjsGlobal, function() {
	return /******/ (function(modules) { // webpackBootstrap
	/******/ 	// The module cache
	/******/ 	var installedModules = {};
	/******/
	/******/ 	// The require function
	/******/ 	function __webpack_require__(moduleId) {
	/******/
	/******/ 		// Check if module is in cache
	/******/ 		if(installedModules[moduleId]) {
	/******/ 			return installedModules[moduleId].exports;
	/******/ 		}
	/******/ 		// Create a new module (and put it into the cache)
	/******/ 		var module = installedModules[moduleId] = {
	/******/ 			i: moduleId,
	/******/ 			l: false,
	/******/ 			exports: {}
	/******/ 		};
	/******/
	/******/ 		// Execute the module function
	/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
	/******/
	/******/ 		// Flag the module as loaded
	/******/ 		module.l = true;
	/******/
	/******/ 		// Return the exports of the module
	/******/ 		return module.exports;
	/******/ 	}
	/******/
	/******/
	/******/ 	// expose the modules object (__webpack_modules__)
	/******/ 	__webpack_require__.m = modules;
	/******/
	/******/ 	// expose the module cache
	/******/ 	__webpack_require__.c = installedModules;
	/******/
	/******/ 	// define getter function for harmony exports
	/******/ 	__webpack_require__.d = function(exports, name, getter) {
	/******/ 		if(!__webpack_require__.o(exports, name)) {
	/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
	/******/ 		}
	/******/ 	};
	/******/
	/******/ 	// define __esModule on exports
	/******/ 	__webpack_require__.r = function(exports) {
	/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
	/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
	/******/ 		}
	/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
	/******/ 	};
	/******/
	/******/ 	// create a fake namespace object
	/******/ 	// mode & 1: value is a module id, require it
	/******/ 	// mode & 2: merge all properties of value into the ns
	/******/ 	// mode & 4: return value when already ns object
	/******/ 	// mode & 8|1: behave like require
	/******/ 	__webpack_require__.t = function(value, mode) {
	/******/ 		if(mode & 1) value = __webpack_require__(value);
	/******/ 		if(mode & 8) return value;
	/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
	/******/ 		var ns = Object.create(null);
	/******/ 		__webpack_require__.r(ns);
	/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
	/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
	/******/ 		return ns;
	/******/ 	};
	/******/
	/******/ 	// getDefaultExport function for compatibility with non-harmony modules
	/******/ 	__webpack_require__.n = function(module) {
	/******/ 		var getter = module && module.__esModule ?
	/******/ 			function getDefault() { return module['default']; } :
	/******/ 			function getModuleExports() { return module; };
	/******/ 		__webpack_require__.d(getter, 'a', getter);
	/******/ 		return getter;
	/******/ 	};
	/******/
	/******/ 	// Object.prototype.hasOwnProperty.call
	/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
	/******/
	/******/ 	// __webpack_public_path__
	/******/ 	__webpack_require__.p = "";
	/******/
	/******/
	/******/ 	// Load entry module and return exports
	/******/ 	return __webpack_require__(__webpack_require__.s = "./index.js");
	/******/ })
	/************************************************************************/
	/******/ ({

	/***/ "./index.js":
	/*!******************!*\
	  !*** ./index.js ***!
	  \******************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(/*! ./lib/axios */ "./lib/axios.js");

	/***/ }),

	/***/ "./lib/adapters/xhr.js":
	/*!*****************************!*\
	  !*** ./lib/adapters/xhr.js ***!
	  \*****************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");
	var settle = __webpack_require__(/*! ./../core/settle */ "./lib/core/settle.js");
	var cookies = __webpack_require__(/*! ./../helpers/cookies */ "./lib/helpers/cookies.js");
	var buildURL = __webpack_require__(/*! ./../helpers/buildURL */ "./lib/helpers/buildURL.js");
	var buildFullPath = __webpack_require__(/*! ../core/buildFullPath */ "./lib/core/buildFullPath.js");
	var parseHeaders = __webpack_require__(/*! ./../helpers/parseHeaders */ "./lib/helpers/parseHeaders.js");
	var isURLSameOrigin = __webpack_require__(/*! ./../helpers/isURLSameOrigin */ "./lib/helpers/isURLSameOrigin.js");
	var createError = __webpack_require__(/*! ../core/createError */ "./lib/core/createError.js");
	var defaults = __webpack_require__(/*! ../defaults */ "./lib/defaults.js");
	var Cancel = __webpack_require__(/*! ../cancel/Cancel */ "./lib/cancel/Cancel.js");

	module.exports = function xhrAdapter(config) {
	  return new Promise(function dispatchXhrRequest(resolve, reject) {
	    var requestData = config.data;
	    var requestHeaders = config.headers;
	    var responseType = config.responseType;
	    var onCanceled;
	    function done() {
	      if (config.cancelToken) {
	        config.cancelToken.unsubscribe(onCanceled);
	      }

	      if (config.signal) {
	        config.signal.removeEventListener('abort', onCanceled);
	      }
	    }

	    if (utils.isFormData(requestData)) {
	      delete requestHeaders['Content-Type']; // Let the browser set it
	    }

	    var request = new XMLHttpRequest();

	    // HTTP basic authentication
	    if (config.auth) {
	      var username = config.auth.username || '';
	      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
	      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
	    }

	    var fullPath = buildFullPath(config.baseURL, config.url);
	    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

	    // Set the request timeout in MS
	    request.timeout = config.timeout;

	    function onloadend() {
	      if (!request) {
	        return;
	      }
	      // Prepare the response
	      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
	      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
	        request.responseText : request.response;
	      var response = {
	        data: responseData,
	        status: request.status,
	        statusText: request.statusText,
	        headers: responseHeaders,
	        config: config,
	        request: request
	      };

	      settle(function _resolve(value) {
	        resolve(value);
	        done();
	      }, function _reject(err) {
	        reject(err);
	        done();
	      }, response);

	      // Clean up request
	      request = null;
	    }

	    if ('onloadend' in request) {
	      // Use onloadend if available
	      request.onloadend = onloadend;
	    } else {
	      // Listen for ready state to emulate onloadend
	      request.onreadystatechange = function handleLoad() {
	        if (!request || request.readyState !== 4) {
	          return;
	        }

	        // The request errored out and we didn't get a response, this will be
	        // handled by onerror instead
	        // With one exception: request that using file: protocol, most browsers
	        // will return status as 0 even though it's a successful request
	        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
	          return;
	        }
	        // readystate handler is calling before onerror or ontimeout handlers,
	        // so we should call onloadend on the next 'tick'
	        setTimeout(onloadend);
	      };
	    }

	    // Handle browser request cancellation (as opposed to a manual cancellation)
	    request.onabort = function handleAbort() {
	      if (!request) {
	        return;
	      }

	      reject(createError('Request aborted', config, 'ECONNABORTED', request));

	      // Clean up request
	      request = null;
	    };

	    // Handle low level network errors
	    request.onerror = function handleError() {
	      // Real errors are hidden from us by the browser
	      // onerror should only fire if it's a network error
	      reject(createError('Network Error', config, null, request));

	      // Clean up request
	      request = null;
	    };

	    // Handle timeout
	    request.ontimeout = function handleTimeout() {
	      var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
	      var transitional = config.transitional || defaults.transitional;
	      if (config.timeoutErrorMessage) {
	        timeoutErrorMessage = config.timeoutErrorMessage;
	      }
	      reject(createError(
	        timeoutErrorMessage,
	        config,
	        transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
	        request));

	      // Clean up request
	      request = null;
	    };

	    // Add xsrf header
	    // This is only done if running in a standard browser environment.
	    // Specifically not if we're in a web worker, or react-native.
	    if (utils.isStandardBrowserEnv()) {
	      // Add xsrf header
	      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
	        cookies.read(config.xsrfCookieName) :
	        undefined;

	      if (xsrfValue) {
	        requestHeaders[config.xsrfHeaderName] = xsrfValue;
	      }
	    }

	    // Add headers to the request
	    if ('setRequestHeader' in request) {
	      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
	        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
	          // Remove Content-Type if data is undefined
	          delete requestHeaders[key];
	        } else {
	          // Otherwise add header to the request
	          request.setRequestHeader(key, val);
	        }
	      });
	    }

	    // Add withCredentials to request if needed
	    if (!utils.isUndefined(config.withCredentials)) {
	      request.withCredentials = !!config.withCredentials;
	    }

	    // Add responseType to request if needed
	    if (responseType && responseType !== 'json') {
	      request.responseType = config.responseType;
	    }

	    // Handle progress if needed
	    if (typeof config.onDownloadProgress === 'function') {
	      request.addEventListener('progress', config.onDownloadProgress);
	    }

	    // Not all browsers support upload events
	    if (typeof config.onUploadProgress === 'function' && request.upload) {
	      request.upload.addEventListener('progress', config.onUploadProgress);
	    }

	    if (config.cancelToken || config.signal) {
	      // Handle cancellation
	      // eslint-disable-next-line func-names
	      onCanceled = function(cancel) {
	        if (!request) {
	          return;
	        }
	        reject(!cancel || (cancel && cancel.type) ? new Cancel('canceled') : cancel);
	        request.abort();
	        request = null;
	      };

	      config.cancelToken && config.cancelToken.subscribe(onCanceled);
	      if (config.signal) {
	        config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
	      }
	    }

	    if (!requestData) {
	      requestData = null;
	    }

	    // Send the request
	    request.send(requestData);
	  });
	};


	/***/ }),

	/***/ "./lib/axios.js":
	/*!**********************!*\
	  !*** ./lib/axios.js ***!
	  \**********************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./utils */ "./lib/utils.js");
	var bind = __webpack_require__(/*! ./helpers/bind */ "./lib/helpers/bind.js");
	var Axios = __webpack_require__(/*! ./core/Axios */ "./lib/core/Axios.js");
	var mergeConfig = __webpack_require__(/*! ./core/mergeConfig */ "./lib/core/mergeConfig.js");
	var defaults = __webpack_require__(/*! ./defaults */ "./lib/defaults.js");

	/**
	 * Create an instance of Axios
	 *
	 * @param {Object} defaultConfig The default config for the instance
	 * @return {Axios} A new instance of Axios
	 */
	function createInstance(defaultConfig) {
	  var context = new Axios(defaultConfig);
	  var instance = bind(Axios.prototype.request, context);

	  // Copy axios.prototype to instance
	  utils.extend(instance, Axios.prototype, context);

	  // Copy context to instance
	  utils.extend(instance, context);

	  // Factory for creating new instances
	  instance.create = function create(instanceConfig) {
	    return createInstance(mergeConfig(defaultConfig, instanceConfig));
	  };

	  return instance;
	}

	// Create the default instance to be exported
	var axios = createInstance(defaults);

	// Expose Axios class to allow class inheritance
	axios.Axios = Axios;

	// Expose Cancel & CancelToken
	axios.Cancel = __webpack_require__(/*! ./cancel/Cancel */ "./lib/cancel/Cancel.js");
	axios.CancelToken = __webpack_require__(/*! ./cancel/CancelToken */ "./lib/cancel/CancelToken.js");
	axios.isCancel = __webpack_require__(/*! ./cancel/isCancel */ "./lib/cancel/isCancel.js");
	axios.VERSION = __webpack_require__(/*! ./env/data */ "./lib/env/data.js").version;

	// Expose all/spread
	axios.all = function all(promises) {
	  return Promise.all(promises);
	};
	axios.spread = __webpack_require__(/*! ./helpers/spread */ "./lib/helpers/spread.js");

	// Expose isAxiosError
	axios.isAxiosError = __webpack_require__(/*! ./helpers/isAxiosError */ "./lib/helpers/isAxiosError.js");

	module.exports = axios;

	// Allow use of default import syntax in TypeScript
	module.exports.default = axios;


	/***/ }),

	/***/ "./lib/cancel/Cancel.js":
	/*!******************************!*\
	  !*** ./lib/cancel/Cancel.js ***!
	  \******************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	/**
	 * A `Cancel` is an object that is thrown when an operation is canceled.
	 *
	 * @class
	 * @param {string=} message The message.
	 */
	function Cancel(message) {
	  this.message = message;
	}

	Cancel.prototype.toString = function toString() {
	  return 'Cancel' + (this.message ? ': ' + this.message : '');
	};

	Cancel.prototype.__CANCEL__ = true;

	module.exports = Cancel;


	/***/ }),

	/***/ "./lib/cancel/CancelToken.js":
	/*!***********************************!*\
	  !*** ./lib/cancel/CancelToken.js ***!
	  \***********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var Cancel = __webpack_require__(/*! ./Cancel */ "./lib/cancel/Cancel.js");

	/**
	 * A `CancelToken` is an object that can be used to request cancellation of an operation.
	 *
	 * @class
	 * @param {Function} executor The executor function.
	 */
	function CancelToken(executor) {
	  if (typeof executor !== 'function') {
	    throw new TypeError('executor must be a function.');
	  }

	  var resolvePromise;

	  this.promise = new Promise(function promiseExecutor(resolve) {
	    resolvePromise = resolve;
	  });

	  var token = this;

	  // eslint-disable-next-line func-names
	  this.promise.then(function(cancel) {
	    if (!token._listeners) return;

	    var i;
	    var l = token._listeners.length;

	    for (i = 0; i < l; i++) {
	      token._listeners[i](cancel);
	    }
	    token._listeners = null;
	  });

	  // eslint-disable-next-line func-names
	  this.promise.then = function(onfulfilled) {
	    var _resolve;
	    // eslint-disable-next-line func-names
	    var promise = new Promise(function(resolve) {
	      token.subscribe(resolve);
	      _resolve = resolve;
	    }).then(onfulfilled);

	    promise.cancel = function reject() {
	      token.unsubscribe(_resolve);
	    };

	    return promise;
	  };

	  executor(function cancel(message) {
	    if (token.reason) {
	      // Cancellation has already been requested
	      return;
	    }

	    token.reason = new Cancel(message);
	    resolvePromise(token.reason);
	  });
	}

	/**
	 * Throws a `Cancel` if cancellation has been requested.
	 */
	CancelToken.prototype.throwIfRequested = function throwIfRequested() {
	  if (this.reason) {
	    throw this.reason;
	  }
	};

	/**
	 * Subscribe to the cancel signal
	 */

	CancelToken.prototype.subscribe = function subscribe(listener) {
	  if (this.reason) {
	    listener(this.reason);
	    return;
	  }

	  if (this._listeners) {
	    this._listeners.push(listener);
	  } else {
	    this._listeners = [listener];
	  }
	};

	/**
	 * Unsubscribe from the cancel signal
	 */

	CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
	  if (!this._listeners) {
	    return;
	  }
	  var index = this._listeners.indexOf(listener);
	  if (index !== -1) {
	    this._listeners.splice(index, 1);
	  }
	};

	/**
	 * Returns an object that contains a new `CancelToken` and a function that, when called,
	 * cancels the `CancelToken`.
	 */
	CancelToken.source = function source() {
	  var cancel;
	  var token = new CancelToken(function executor(c) {
	    cancel = c;
	  });
	  return {
	    token: token,
	    cancel: cancel
	  };
	};

	module.exports = CancelToken;


	/***/ }),

	/***/ "./lib/cancel/isCancel.js":
	/*!********************************!*\
	  !*** ./lib/cancel/isCancel.js ***!
	  \********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	module.exports = function isCancel(value) {
	  return !!(value && value.__CANCEL__);
	};


	/***/ }),

	/***/ "./lib/core/Axios.js":
	/*!***************************!*\
	  !*** ./lib/core/Axios.js ***!
	  \***************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");
	var buildURL = __webpack_require__(/*! ../helpers/buildURL */ "./lib/helpers/buildURL.js");
	var InterceptorManager = __webpack_require__(/*! ./InterceptorManager */ "./lib/core/InterceptorManager.js");
	var dispatchRequest = __webpack_require__(/*! ./dispatchRequest */ "./lib/core/dispatchRequest.js");
	var mergeConfig = __webpack_require__(/*! ./mergeConfig */ "./lib/core/mergeConfig.js");
	var validator = __webpack_require__(/*! ../helpers/validator */ "./lib/helpers/validator.js");

	var validators = validator.validators;
	/**
	 * Create a new instance of Axios
	 *
	 * @param {Object} instanceConfig The default config for the instance
	 */
	function Axios(instanceConfig) {
	  this.defaults = instanceConfig;
	  this.interceptors = {
	    request: new InterceptorManager(),
	    response: new InterceptorManager()
	  };
	}

	/**
	 * Dispatch a request
	 *
	 * @param {Object} config The config specific for this request (merged with this.defaults)
	 */
	Axios.prototype.request = function request(config) {
	  /*eslint no-param-reassign:0*/
	  // Allow for axios('example/url'[, config]) a la fetch API
	  if (typeof config === 'string') {
	    config = arguments[1] || {};
	    config.url = arguments[0];
	  } else {
	    config = config || {};
	  }

	  config = mergeConfig(this.defaults, config);

	  // Set config.method
	  if (config.method) {
	    config.method = config.method.toLowerCase();
	  } else if (this.defaults.method) {
	    config.method = this.defaults.method.toLowerCase();
	  } else {
	    config.method = 'get';
	  }

	  var transitional = config.transitional;

	  if (transitional !== undefined) {
	    validator.assertOptions(transitional, {
	      silentJSONParsing: validators.transitional(validators.boolean),
	      forcedJSONParsing: validators.transitional(validators.boolean),
	      clarifyTimeoutError: validators.transitional(validators.boolean)
	    }, false);
	  }

	  // filter out skipped interceptors
	  var requestInterceptorChain = [];
	  var synchronousRequestInterceptors = true;
	  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
	    if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
	      return;
	    }

	    synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

	    requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
	  });

	  var responseInterceptorChain = [];
	  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
	    responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
	  });

	  var promise;

	  if (!synchronousRequestInterceptors) {
	    var chain = [dispatchRequest, undefined];

	    Array.prototype.unshift.apply(chain, requestInterceptorChain);
	    chain = chain.concat(responseInterceptorChain);

	    promise = Promise.resolve(config);
	    while (chain.length) {
	      promise = promise.then(chain.shift(), chain.shift());
	    }

	    return promise;
	  }


	  var newConfig = config;
	  while (requestInterceptorChain.length) {
	    var onFulfilled = requestInterceptorChain.shift();
	    var onRejected = requestInterceptorChain.shift();
	    try {
	      newConfig = onFulfilled(newConfig);
	    } catch (error) {
	      onRejected(error);
	      break;
	    }
	  }

	  try {
	    promise = dispatchRequest(newConfig);
	  } catch (error) {
	    return Promise.reject(error);
	  }

	  while (responseInterceptorChain.length) {
	    promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
	  }

	  return promise;
	};

	Axios.prototype.getUri = function getUri(config) {
	  config = mergeConfig(this.defaults, config);
	  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
	};

	// Provide aliases for supported request methods
	utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
	  /*eslint func-names:0*/
	  Axios.prototype[method] = function(url, config) {
	    return this.request(mergeConfig(config || {}, {
	      method: method,
	      url: url,
	      data: (config || {}).data
	    }));
	  };
	});

	utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
	  /*eslint func-names:0*/
	  Axios.prototype[method] = function(url, data, config) {
	    return this.request(mergeConfig(config || {}, {
	      method: method,
	      url: url,
	      data: data
	    }));
	  };
	});

	module.exports = Axios;


	/***/ }),

	/***/ "./lib/core/InterceptorManager.js":
	/*!****************************************!*\
	  !*** ./lib/core/InterceptorManager.js ***!
	  \****************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");

	function InterceptorManager() {
	  this.handlers = [];
	}

	/**
	 * Add a new interceptor to the stack
	 *
	 * @param {Function} fulfilled The function to handle `then` for a `Promise`
	 * @param {Function} rejected The function to handle `reject` for a `Promise`
	 *
	 * @return {Number} An ID used to remove interceptor later
	 */
	InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
	  this.handlers.push({
	    fulfilled: fulfilled,
	    rejected: rejected,
	    synchronous: options ? options.synchronous : false,
	    runWhen: options ? options.runWhen : null
	  });
	  return this.handlers.length - 1;
	};

	/**
	 * Remove an interceptor from the stack
	 *
	 * @param {Number} id The ID that was returned by `use`
	 */
	InterceptorManager.prototype.eject = function eject(id) {
	  if (this.handlers[id]) {
	    this.handlers[id] = null;
	  }
	};

	/**
	 * Iterate over all the registered interceptors
	 *
	 * This method is particularly useful for skipping over any
	 * interceptors that may have become `null` calling `eject`.
	 *
	 * @param {Function} fn The function to call for each interceptor
	 */
	InterceptorManager.prototype.forEach = function forEach(fn) {
	  utils.forEach(this.handlers, function forEachHandler(h) {
	    if (h !== null) {
	      fn(h);
	    }
	  });
	};

	module.exports = InterceptorManager;


	/***/ }),

	/***/ "./lib/core/buildFullPath.js":
	/*!***********************************!*\
	  !*** ./lib/core/buildFullPath.js ***!
	  \***********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var isAbsoluteURL = __webpack_require__(/*! ../helpers/isAbsoluteURL */ "./lib/helpers/isAbsoluteURL.js");
	var combineURLs = __webpack_require__(/*! ../helpers/combineURLs */ "./lib/helpers/combineURLs.js");

	/**
	 * Creates a new URL by combining the baseURL with the requestedURL,
	 * only when the requestedURL is not already an absolute URL.
	 * If the requestURL is absolute, this function returns the requestedURL untouched.
	 *
	 * @param {string} baseURL The base URL
	 * @param {string} requestedURL Absolute or relative URL to combine
	 * @returns {string} The combined full path
	 */
	module.exports = function buildFullPath(baseURL, requestedURL) {
	  if (baseURL && !isAbsoluteURL(requestedURL)) {
	    return combineURLs(baseURL, requestedURL);
	  }
	  return requestedURL;
	};


	/***/ }),

	/***/ "./lib/core/createError.js":
	/*!*********************************!*\
	  !*** ./lib/core/createError.js ***!
	  \*********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var enhanceError = __webpack_require__(/*! ./enhanceError */ "./lib/core/enhanceError.js");

	/**
	 * Create an Error with the specified message, config, error code, request and response.
	 *
	 * @param {string} message The error message.
	 * @param {Object} config The config.
	 * @param {string} [code] The error code (for example, 'ECONNABORTED').
	 * @param {Object} [request] The request.
	 * @param {Object} [response] The response.
	 * @returns {Error} The created error.
	 */
	module.exports = function createError(message, config, code, request, response) {
	  var error = new Error(message);
	  return enhanceError(error, config, code, request, response);
	};


	/***/ }),

	/***/ "./lib/core/dispatchRequest.js":
	/*!*************************************!*\
	  !*** ./lib/core/dispatchRequest.js ***!
	  \*************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");
	var transformData = __webpack_require__(/*! ./transformData */ "./lib/core/transformData.js");
	var isCancel = __webpack_require__(/*! ../cancel/isCancel */ "./lib/cancel/isCancel.js");
	var defaults = __webpack_require__(/*! ../defaults */ "./lib/defaults.js");
	var Cancel = __webpack_require__(/*! ../cancel/Cancel */ "./lib/cancel/Cancel.js");

	/**
	 * Throws a `Cancel` if cancellation has been requested.
	 */
	function throwIfCancellationRequested(config) {
	  if (config.cancelToken) {
	    config.cancelToken.throwIfRequested();
	  }

	  if (config.signal && config.signal.aborted) {
	    throw new Cancel('canceled');
	  }
	}

	/**
	 * Dispatch a request to the server using the configured adapter.
	 *
	 * @param {object} config The config that is to be used for the request
	 * @returns {Promise} The Promise to be fulfilled
	 */
	module.exports = function dispatchRequest(config) {
	  throwIfCancellationRequested(config);

	  // Ensure headers exist
	  config.headers = config.headers || {};

	  // Transform request data
	  config.data = transformData.call(
	    config,
	    config.data,
	    config.headers,
	    config.transformRequest
	  );

	  // Flatten headers
	  config.headers = utils.merge(
	    config.headers.common || {},
	    config.headers[config.method] || {},
	    config.headers
	  );

	  utils.forEach(
	    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
	    function cleanHeaderConfig(method) {
	      delete config.headers[method];
	    }
	  );

	  var adapter = config.adapter || defaults.adapter;

	  return adapter(config).then(function onAdapterResolution(response) {
	    throwIfCancellationRequested(config);

	    // Transform response data
	    response.data = transformData.call(
	      config,
	      response.data,
	      response.headers,
	      config.transformResponse
	    );

	    return response;
	  }, function onAdapterRejection(reason) {
	    if (!isCancel(reason)) {
	      throwIfCancellationRequested(config);

	      // Transform response data
	      if (reason && reason.response) {
	        reason.response.data = transformData.call(
	          config,
	          reason.response.data,
	          reason.response.headers,
	          config.transformResponse
	        );
	      }
	    }

	    return Promise.reject(reason);
	  });
	};


	/***/ }),

	/***/ "./lib/core/enhanceError.js":
	/*!**********************************!*\
	  !*** ./lib/core/enhanceError.js ***!
	  \**********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	/**
	 * Update an Error with the specified config, error code, and response.
	 *
	 * @param {Error} error The error to update.
	 * @param {Object} config The config.
	 * @param {string} [code] The error code (for example, 'ECONNABORTED').
	 * @param {Object} [request] The request.
	 * @param {Object} [response] The response.
	 * @returns {Error} The error.
	 */
	module.exports = function enhanceError(error, config, code, request, response) {
	  error.config = config;
	  if (code) {
	    error.code = code;
	  }

	  error.request = request;
	  error.response = response;
	  error.isAxiosError = true;

	  error.toJSON = function toJSON() {
	    return {
	      // Standard
	      message: this.message,
	      name: this.name,
	      // Microsoft
	      description: this.description,
	      number: this.number,
	      // Mozilla
	      fileName: this.fileName,
	      lineNumber: this.lineNumber,
	      columnNumber: this.columnNumber,
	      stack: this.stack,
	      // Axios
	      config: this.config,
	      code: this.code,
	      status: this.response && this.response.status ? this.response.status : null
	    };
	  };
	  return error;
	};


	/***/ }),

	/***/ "./lib/core/mergeConfig.js":
	/*!*********************************!*\
	  !*** ./lib/core/mergeConfig.js ***!
	  \*********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ../utils */ "./lib/utils.js");

	/**
	 * Config-specific merge-function which creates a new config-object
	 * by merging two configuration objects together.
	 *
	 * @param {Object} config1
	 * @param {Object} config2
	 * @returns {Object} New object resulting from merging config2 to config1
	 */
	module.exports = function mergeConfig(config1, config2) {
	  // eslint-disable-next-line no-param-reassign
	  config2 = config2 || {};
	  var config = {};

	  function getMergedValue(target, source) {
	    if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
	      return utils.merge(target, source);
	    } else if (utils.isPlainObject(source)) {
	      return utils.merge({}, source);
	    } else if (utils.isArray(source)) {
	      return source.slice();
	    }
	    return source;
	  }

	  // eslint-disable-next-line consistent-return
	  function mergeDeepProperties(prop) {
	    if (!utils.isUndefined(config2[prop])) {
	      return getMergedValue(config1[prop], config2[prop]);
	    } else if (!utils.isUndefined(config1[prop])) {
	      return getMergedValue(undefined, config1[prop]);
	    }
	  }

	  // eslint-disable-next-line consistent-return
	  function valueFromConfig2(prop) {
	    if (!utils.isUndefined(config2[prop])) {
	      return getMergedValue(undefined, config2[prop]);
	    }
	  }

	  // eslint-disable-next-line consistent-return
	  function defaultToConfig2(prop) {
	    if (!utils.isUndefined(config2[prop])) {
	      return getMergedValue(undefined, config2[prop]);
	    } else if (!utils.isUndefined(config1[prop])) {
	      return getMergedValue(undefined, config1[prop]);
	    }
	  }

	  // eslint-disable-next-line consistent-return
	  function mergeDirectKeys(prop) {
	    if (prop in config2) {
	      return getMergedValue(config1[prop], config2[prop]);
	    } else if (prop in config1) {
	      return getMergedValue(undefined, config1[prop]);
	    }
	  }

	  var mergeMap = {
	    'url': valueFromConfig2,
	    'method': valueFromConfig2,
	    'data': valueFromConfig2,
	    'baseURL': defaultToConfig2,
	    'transformRequest': defaultToConfig2,
	    'transformResponse': defaultToConfig2,
	    'paramsSerializer': defaultToConfig2,
	    'timeout': defaultToConfig2,
	    'timeoutMessage': defaultToConfig2,
	    'withCredentials': defaultToConfig2,
	    'adapter': defaultToConfig2,
	    'responseType': defaultToConfig2,
	    'xsrfCookieName': defaultToConfig2,
	    'xsrfHeaderName': defaultToConfig2,
	    'onUploadProgress': defaultToConfig2,
	    'onDownloadProgress': defaultToConfig2,
	    'decompress': defaultToConfig2,
	    'maxContentLength': defaultToConfig2,
	    'maxBodyLength': defaultToConfig2,
	    'transport': defaultToConfig2,
	    'httpAgent': defaultToConfig2,
	    'httpsAgent': defaultToConfig2,
	    'cancelToken': defaultToConfig2,
	    'socketPath': defaultToConfig2,
	    'responseEncoding': defaultToConfig2,
	    'validateStatus': mergeDirectKeys
	  };

	  utils.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
	    var merge = mergeMap[prop] || mergeDeepProperties;
	    var configValue = merge(prop);
	    (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
	  });

	  return config;
	};


	/***/ }),

	/***/ "./lib/core/settle.js":
	/*!****************************!*\
	  !*** ./lib/core/settle.js ***!
	  \****************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var createError = __webpack_require__(/*! ./createError */ "./lib/core/createError.js");

	/**
	 * Resolve or reject a Promise based on response status.
	 *
	 * @param {Function} resolve A function that resolves the promise.
	 * @param {Function} reject A function that rejects the promise.
	 * @param {object} response The response.
	 */
	module.exports = function settle(resolve, reject, response) {
	  var validateStatus = response.config.validateStatus;
	  if (!response.status || !validateStatus || validateStatus(response.status)) {
	    resolve(response);
	  } else {
	    reject(createError(
	      'Request failed with status code ' + response.status,
	      response.config,
	      null,
	      response.request,
	      response
	    ));
	  }
	};


	/***/ }),

	/***/ "./lib/core/transformData.js":
	/*!***********************************!*\
	  !*** ./lib/core/transformData.js ***!
	  \***********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");
	var defaults = __webpack_require__(/*! ./../defaults */ "./lib/defaults.js");

	/**
	 * Transform the data for a request or a response
	 *
	 * @param {Object|String} data The data to be transformed
	 * @param {Array} headers The headers for the request or response
	 * @param {Array|Function} fns A single function or Array of functions
	 * @returns {*} The resulting transformed data
	 */
	module.exports = function transformData(data, headers, fns) {
	  var context = this || defaults;
	  /*eslint no-param-reassign:0*/
	  utils.forEach(fns, function transform(fn) {
	    data = fn.call(context, data, headers);
	  });

	  return data;
	};


	/***/ }),

	/***/ "./lib/defaults.js":
	/*!*************************!*\
	  !*** ./lib/defaults.js ***!
	  \*************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./utils */ "./lib/utils.js");
	var normalizeHeaderName = __webpack_require__(/*! ./helpers/normalizeHeaderName */ "./lib/helpers/normalizeHeaderName.js");
	var enhanceError = __webpack_require__(/*! ./core/enhanceError */ "./lib/core/enhanceError.js");

	var DEFAULT_CONTENT_TYPE = {
	  'Content-Type': 'application/x-www-form-urlencoded'
	};

	function setContentTypeIfUnset(headers, value) {
	  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
	    headers['Content-Type'] = value;
	  }
	}

	function getDefaultAdapter() {
	  var adapter;
	  if (typeof XMLHttpRequest !== 'undefined') {
	    // For browsers use XHR adapter
	    adapter = __webpack_require__(/*! ./adapters/xhr */ "./lib/adapters/xhr.js");
	  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
	    // For node use HTTP adapter
	    adapter = __webpack_require__(/*! ./adapters/http */ "./lib/adapters/xhr.js");
	  }
	  return adapter;
	}

	function stringifySafely(rawValue, parser, encoder) {
	  if (utils.isString(rawValue)) {
	    try {
	      (parser || JSON.parse)(rawValue);
	      return utils.trim(rawValue);
	    } catch (e) {
	      if (e.name !== 'SyntaxError') {
	        throw e;
	      }
	    }
	  }

	  return (encoder || JSON.stringify)(rawValue);
	}

	var defaults = {

	  transitional: {
	    silentJSONParsing: true,
	    forcedJSONParsing: true,
	    clarifyTimeoutError: false
	  },

	  adapter: getDefaultAdapter(),

	  transformRequest: [function transformRequest(data, headers) {
	    normalizeHeaderName(headers, 'Accept');
	    normalizeHeaderName(headers, 'Content-Type');

	    if (utils.isFormData(data) ||
	      utils.isArrayBuffer(data) ||
	      utils.isBuffer(data) ||
	      utils.isStream(data) ||
	      utils.isFile(data) ||
	      utils.isBlob(data)
	    ) {
	      return data;
	    }
	    if (utils.isArrayBufferView(data)) {
	      return data.buffer;
	    }
	    if (utils.isURLSearchParams(data)) {
	      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
	      return data.toString();
	    }
	    if (utils.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
	      setContentTypeIfUnset(headers, 'application/json');
	      return stringifySafely(data);
	    }
	    return data;
	  }],

	  transformResponse: [function transformResponse(data) {
	    var transitional = this.transitional || defaults.transitional;
	    var silentJSONParsing = transitional && transitional.silentJSONParsing;
	    var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
	    var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

	    if (strictJSONParsing || (forcedJSONParsing && utils.isString(data) && data.length)) {
	      try {
	        return JSON.parse(data);
	      } catch (e) {
	        if (strictJSONParsing) {
	          if (e.name === 'SyntaxError') {
	            throw enhanceError(e, this, 'E_JSON_PARSE');
	          }
	          throw e;
	        }
	      }
	    }

	    return data;
	  }],

	  /**
	   * A timeout in milliseconds to abort a request. If set to 0 (default) a
	   * timeout is not created.
	   */
	  timeout: 0,

	  xsrfCookieName: 'XSRF-TOKEN',
	  xsrfHeaderName: 'X-XSRF-TOKEN',

	  maxContentLength: -1,
	  maxBodyLength: -1,

	  validateStatus: function validateStatus(status) {
	    return status >= 200 && status < 300;
	  },

	  headers: {
	    common: {
	      'Accept': 'application/json, text/plain, */*'
	    }
	  }
	};

	utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
	  defaults.headers[method] = {};
	});

	utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
	  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
	});

	module.exports = defaults;


	/***/ }),

	/***/ "./lib/env/data.js":
	/*!*************************!*\
	  !*** ./lib/env/data.js ***!
	  \*************************/
	/*! no static exports found */
	/***/ (function(module, exports) {

	module.exports = {
	  "version": "0.24.0"
	};

	/***/ }),

	/***/ "./lib/helpers/bind.js":
	/*!*****************************!*\
	  !*** ./lib/helpers/bind.js ***!
	  \*****************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	module.exports = function bind(fn, thisArg) {
	  return function wrap() {
	    var args = new Array(arguments.length);
	    for (var i = 0; i < args.length; i++) {
	      args[i] = arguments[i];
	    }
	    return fn.apply(thisArg, args);
	  };
	};


	/***/ }),

	/***/ "./lib/helpers/buildURL.js":
	/*!*********************************!*\
	  !*** ./lib/helpers/buildURL.js ***!
	  \*********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");

	function encode(val) {
	  return encodeURIComponent(val).
	    replace(/%3A/gi, ':').
	    replace(/%24/g, '$').
	    replace(/%2C/gi, ',').
	    replace(/%20/g, '+').
	    replace(/%5B/gi, '[').
	    replace(/%5D/gi, ']');
	}

	/**
	 * Build a URL by appending params to the end
	 *
	 * @param {string} url The base of the url (e.g., http://www.google.com)
	 * @param {object} [params] The params to be appended
	 * @returns {string} The formatted url
	 */
	module.exports = function buildURL(url, params, paramsSerializer) {
	  /*eslint no-param-reassign:0*/
	  if (!params) {
	    return url;
	  }

	  var serializedParams;
	  if (paramsSerializer) {
	    serializedParams = paramsSerializer(params);
	  } else if (utils.isURLSearchParams(params)) {
	    serializedParams = params.toString();
	  } else {
	    var parts = [];

	    utils.forEach(params, function serialize(val, key) {
	      if (val === null || typeof val === 'undefined') {
	        return;
	      }

	      if (utils.isArray(val)) {
	        key = key + '[]';
	      } else {
	        val = [val];
	      }

	      utils.forEach(val, function parseValue(v) {
	        if (utils.isDate(v)) {
	          v = v.toISOString();
	        } else if (utils.isObject(v)) {
	          v = JSON.stringify(v);
	        }
	        parts.push(encode(key) + '=' + encode(v));
	      });
	    });

	    serializedParams = parts.join('&');
	  }

	  if (serializedParams) {
	    var hashmarkIndex = url.indexOf('#');
	    if (hashmarkIndex !== -1) {
	      url = url.slice(0, hashmarkIndex);
	    }

	    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
	  }

	  return url;
	};


	/***/ }),

	/***/ "./lib/helpers/combineURLs.js":
	/*!************************************!*\
	  !*** ./lib/helpers/combineURLs.js ***!
	  \************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	/**
	 * Creates a new URL by combining the specified URLs
	 *
	 * @param {string} baseURL The base URL
	 * @param {string} relativeURL The relative URL
	 * @returns {string} The combined URL
	 */
	module.exports = function combineURLs(baseURL, relativeURL) {
	  return relativeURL
	    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
	    : baseURL;
	};


	/***/ }),

	/***/ "./lib/helpers/cookies.js":
	/*!********************************!*\
	  !*** ./lib/helpers/cookies.js ***!
	  \********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");

	module.exports = (
	  utils.isStandardBrowserEnv() ?

	  // Standard browser envs support document.cookie
	    (function standardBrowserEnv() {
	      return {
	        write: function write(name, value, expires, path, domain, secure) {
	          var cookie = [];
	          cookie.push(name + '=' + encodeURIComponent(value));

	          if (utils.isNumber(expires)) {
	            cookie.push('expires=' + new Date(expires).toGMTString());
	          }

	          if (utils.isString(path)) {
	            cookie.push('path=' + path);
	          }

	          if (utils.isString(domain)) {
	            cookie.push('domain=' + domain);
	          }

	          if (secure === true) {
	            cookie.push('secure');
	          }

	          document.cookie = cookie.join('; ');
	        },

	        read: function read(name) {
	          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
	          return (match ? decodeURIComponent(match[3]) : null);
	        },

	        remove: function remove(name) {
	          this.write(name, '', Date.now() - 86400000);
	        }
	      };
	    })() :

	  // Non standard browser env (web workers, react-native) lack needed support.
	    (function nonStandardBrowserEnv() {
	      return {
	        write: function write() {},
	        read: function read() { return null; },
	        remove: function remove() {}
	      };
	    })()
	);


	/***/ }),

	/***/ "./lib/helpers/isAbsoluteURL.js":
	/*!**************************************!*\
	  !*** ./lib/helpers/isAbsoluteURL.js ***!
	  \**************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	/**
	 * Determines whether the specified URL is absolute
	 *
	 * @param {string} url The URL to test
	 * @returns {boolean} True if the specified URL is absolute, otherwise false
	 */
	module.exports = function isAbsoluteURL(url) {
	  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
	  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
	  // by any combination of letters, digits, plus, period, or hyphen.
	  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
	};


	/***/ }),

	/***/ "./lib/helpers/isAxiosError.js":
	/*!*************************************!*\
	  !*** ./lib/helpers/isAxiosError.js ***!
	  \*************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	/**
	 * Determines whether the payload is an error thrown by Axios
	 *
	 * @param {*} payload The value to test
	 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
	 */
	module.exports = function isAxiosError(payload) {
	  return (typeof payload === 'object') && (payload.isAxiosError === true);
	};


	/***/ }),

	/***/ "./lib/helpers/isURLSameOrigin.js":
	/*!****************************************!*\
	  !*** ./lib/helpers/isURLSameOrigin.js ***!
	  \****************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");

	module.exports = (
	  utils.isStandardBrowserEnv() ?

	  // Standard browser envs have full support of the APIs needed to test
	  // whether the request URL is of the same origin as current location.
	    (function standardBrowserEnv() {
	      var msie = /(msie|trident)/i.test(navigator.userAgent);
	      var urlParsingNode = document.createElement('a');
	      var originURL;

	      /**
	    * Parse a URL to discover it's components
	    *
	    * @param {String} url The URL to be parsed
	    * @returns {Object}
	    */
	      function resolveURL(url) {
	        var href = url;

	        if (msie) {
	        // IE needs attribute set twice to normalize properties
	          urlParsingNode.setAttribute('href', href);
	          href = urlParsingNode.href;
	        }

	        urlParsingNode.setAttribute('href', href);

	        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
	        return {
	          href: urlParsingNode.href,
	          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
	          host: urlParsingNode.host,
	          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
	          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
	          hostname: urlParsingNode.hostname,
	          port: urlParsingNode.port,
	          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
	            urlParsingNode.pathname :
	            '/' + urlParsingNode.pathname
	        };
	      }

	      originURL = resolveURL(window.location.href);

	      /**
	    * Determine if a URL shares the same origin as the current location
	    *
	    * @param {String} requestURL The URL to test
	    * @returns {boolean} True if URL shares the same origin, otherwise false
	    */
	      return function isURLSameOrigin(requestURL) {
	        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
	        return (parsed.protocol === originURL.protocol &&
	            parsed.host === originURL.host);
	      };
	    })() :

	  // Non standard browser envs (web workers, react-native) lack needed support.
	    (function nonStandardBrowserEnv() {
	      return function isURLSameOrigin() {
	        return true;
	      };
	    })()
	);


	/***/ }),

	/***/ "./lib/helpers/normalizeHeaderName.js":
	/*!********************************************!*\
	  !*** ./lib/helpers/normalizeHeaderName.js ***!
	  \********************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ../utils */ "./lib/utils.js");

	module.exports = function normalizeHeaderName(headers, normalizedName) {
	  utils.forEach(headers, function processHeader(value, name) {
	    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
	      headers[normalizedName] = value;
	      delete headers[name];
	    }
	  });
	};


	/***/ }),

	/***/ "./lib/helpers/parseHeaders.js":
	/*!*************************************!*\
	  !*** ./lib/helpers/parseHeaders.js ***!
	  \*************************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var utils = __webpack_require__(/*! ./../utils */ "./lib/utils.js");

	// Headers whose duplicates are ignored by node
	// c.f. https://nodejs.org/api/http.html#http_message_headers
	var ignoreDuplicateOf = [
	  'age', 'authorization', 'content-length', 'content-type', 'etag',
	  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
	  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
	  'referer', 'retry-after', 'user-agent'
	];

	/**
	 * Parse headers into an object
	 *
	 * ```
	 * Date: Wed, 27 Aug 2014 08:58:49 GMT
	 * Content-Type: application/json
	 * Connection: keep-alive
	 * Transfer-Encoding: chunked
	 * ```
	 *
	 * @param {String} headers Headers needing to be parsed
	 * @returns {Object} Headers parsed into an object
	 */
	module.exports = function parseHeaders(headers) {
	  var parsed = {};
	  var key;
	  var val;
	  var i;

	  if (!headers) { return parsed; }

	  utils.forEach(headers.split('\n'), function parser(line) {
	    i = line.indexOf(':');
	    key = utils.trim(line.substr(0, i)).toLowerCase();
	    val = utils.trim(line.substr(i + 1));

	    if (key) {
	      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
	        return;
	      }
	      if (key === 'set-cookie') {
	        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
	      } else {
	        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
	      }
	    }
	  });

	  return parsed;
	};


	/***/ }),

	/***/ "./lib/helpers/spread.js":
	/*!*******************************!*\
	  !*** ./lib/helpers/spread.js ***!
	  \*******************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	/**
	 * Syntactic sugar for invoking a function and expanding an array for arguments.
	 *
	 * Common use case would be to use `Function.prototype.apply`.
	 *
	 *  ```js
	 *  function f(x, y, z) {}
	 *  var args = [1, 2, 3];
	 *  f.apply(null, args);
	 *  ```
	 *
	 * With `spread` this example can be re-written.
	 *
	 *  ```js
	 *  spread(function(x, y, z) {})([1, 2, 3]);
	 *  ```
	 *
	 * @param {Function} callback
	 * @returns {Function}
	 */
	module.exports = function spread(callback) {
	  return function wrap(arr) {
	    return callback.apply(null, arr);
	  };
	};


	/***/ }),

	/***/ "./lib/helpers/validator.js":
	/*!**********************************!*\
	  !*** ./lib/helpers/validator.js ***!
	  \**********************************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var VERSION = __webpack_require__(/*! ../env/data */ "./lib/env/data.js").version;

	var validators = {};

	// eslint-disable-next-line func-names
	['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
	  validators[type] = function validator(thing) {
	    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
	  };
	});

	var deprecatedWarnings = {};

	/**
	 * Transitional option validator
	 * @param {function|boolean?} validator - set to false if the transitional option has been removed
	 * @param {string?} version - deprecated version / removed since version
	 * @param {string?} message - some message with additional info
	 * @returns {function}
	 */
	validators.transitional = function transitional(validator, version, message) {
	  function formatMessage(opt, desc) {
	    return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
	  }

	  // eslint-disable-next-line func-names
	  return function(value, opt, opts) {
	    if (validator === false) {
	      throw new Error(formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')));
	    }

	    if (version && !deprecatedWarnings[opt]) {
	      deprecatedWarnings[opt] = true;
	      // eslint-disable-next-line no-console
	      console.warn(
	        formatMessage(
	          opt,
	          ' has been deprecated since v' + version + ' and will be removed in the near future'
	        )
	      );
	    }

	    return validator ? validator(value, opt, opts) : true;
	  };
	};

	/**
	 * Assert object's properties type
	 * @param {object} options
	 * @param {object} schema
	 * @param {boolean?} allowUnknown
	 */

	function assertOptions(options, schema, allowUnknown) {
	  if (typeof options !== 'object') {
	    throw new TypeError('options must be an object');
	  }
	  var keys = Object.keys(options);
	  var i = keys.length;
	  while (i-- > 0) {
	    var opt = keys[i];
	    var validator = schema[opt];
	    if (validator) {
	      var value = options[opt];
	      var result = value === undefined || validator(value, opt, options);
	      if (result !== true) {
	        throw new TypeError('option ' + opt + ' must be ' + result);
	      }
	      continue;
	    }
	    if (allowUnknown !== true) {
	      throw Error('Unknown option ' + opt);
	    }
	  }
	}

	module.exports = {
	  assertOptions: assertOptions,
	  validators: validators
	};


	/***/ }),

	/***/ "./lib/utils.js":
	/*!**********************!*\
	  !*** ./lib/utils.js ***!
	  \**********************/
	/*! no static exports found */
	/***/ (function(module, exports, __webpack_require__) {


	var bind = __webpack_require__(/*! ./helpers/bind */ "./lib/helpers/bind.js");

	// utils is a library of generic helper functions non-specific to axios

	var toString = Object.prototype.toString;

	/**
	 * Determine if a value is an Array
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is an Array, otherwise false
	 */
	function isArray(val) {
	  return toString.call(val) === '[object Array]';
	}

	/**
	 * Determine if a value is undefined
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if the value is undefined, otherwise false
	 */
	function isUndefined(val) {
	  return typeof val === 'undefined';
	}

	/**
	 * Determine if a value is a Buffer
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a Buffer, otherwise false
	 */
	function isBuffer(val) {
	  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
	    && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
	}

	/**
	 * Determine if a value is an ArrayBuffer
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
	 */
	function isArrayBuffer(val) {
	  return toString.call(val) === '[object ArrayBuffer]';
	}

	/**
	 * Determine if a value is a FormData
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is an FormData, otherwise false
	 */
	function isFormData(val) {
	  return (typeof FormData !== 'undefined') && (val instanceof FormData);
	}

	/**
	 * Determine if a value is a view on an ArrayBuffer
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
	 */
	function isArrayBufferView(val) {
	  var result;
	  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
	    result = ArrayBuffer.isView(val);
	  } else {
	    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
	  }
	  return result;
	}

	/**
	 * Determine if a value is a String
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a String, otherwise false
	 */
	function isString(val) {
	  return typeof val === 'string';
	}

	/**
	 * Determine if a value is a Number
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a Number, otherwise false
	 */
	function isNumber(val) {
	  return typeof val === 'number';
	}

	/**
	 * Determine if a value is an Object
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is an Object, otherwise false
	 */
	function isObject(val) {
	  return val !== null && typeof val === 'object';
	}

	/**
	 * Determine if a value is a plain Object
	 *
	 * @param {Object} val The value to test
	 * @return {boolean} True if value is a plain Object, otherwise false
	 */
	function isPlainObject(val) {
	  if (toString.call(val) !== '[object Object]') {
	    return false;
	  }

	  var prototype = Object.getPrototypeOf(val);
	  return prototype === null || prototype === Object.prototype;
	}

	/**
	 * Determine if a value is a Date
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a Date, otherwise false
	 */
	function isDate(val) {
	  return toString.call(val) === '[object Date]';
	}

	/**
	 * Determine if a value is a File
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a File, otherwise false
	 */
	function isFile(val) {
	  return toString.call(val) === '[object File]';
	}

	/**
	 * Determine if a value is a Blob
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a Blob, otherwise false
	 */
	function isBlob(val) {
	  return toString.call(val) === '[object Blob]';
	}

	/**
	 * Determine if a value is a Function
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a Function, otherwise false
	 */
	function isFunction(val) {
	  return toString.call(val) === '[object Function]';
	}

	/**
	 * Determine if a value is a Stream
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a Stream, otherwise false
	 */
	function isStream(val) {
	  return isObject(val) && isFunction(val.pipe);
	}

	/**
	 * Determine if a value is a URLSearchParams object
	 *
	 * @param {Object} val The value to test
	 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
	 */
	function isURLSearchParams(val) {
	  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
	}

	/**
	 * Trim excess whitespace off the beginning and end of a string
	 *
	 * @param {String} str The String to trim
	 * @returns {String} The String freed of excess whitespace
	 */
	function trim(str) {
	  return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
	}

	/**
	 * Determine if we're running in a standard browser environment
	 *
	 * This allows axios to run in a web worker, and react-native.
	 * Both environments support XMLHttpRequest, but not fully standard globals.
	 *
	 * web workers:
	 *  typeof window -> undefined
	 *  typeof document -> undefined
	 *
	 * react-native:
	 *  navigator.product -> 'ReactNative'
	 * nativescript
	 *  navigator.product -> 'NativeScript' or 'NS'
	 */
	function isStandardBrowserEnv() {
	  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
	                                           navigator.product === 'NativeScript' ||
	                                           navigator.product === 'NS')) {
	    return false;
	  }
	  return (
	    typeof window !== 'undefined' &&
	    typeof document !== 'undefined'
	  );
	}

	/**
	 * Iterate over an Array or an Object invoking a function for each item.
	 *
	 * If `obj` is an Array callback will be called passing
	 * the value, index, and complete array for each item.
	 *
	 * If 'obj' is an Object callback will be called passing
	 * the value, key, and complete object for each property.
	 *
	 * @param {Object|Array} obj The object to iterate
	 * @param {Function} fn The callback to invoke for each item
	 */
	function forEach(obj, fn) {
	  // Don't bother if no value provided
	  if (obj === null || typeof obj === 'undefined') {
	    return;
	  }

	  // Force an array if not already something iterable
	  if (typeof obj !== 'object') {
	    /*eslint no-param-reassign:0*/
	    obj = [obj];
	  }

	  if (isArray(obj)) {
	    // Iterate over array values
	    for (var i = 0, l = obj.length; i < l; i++) {
	      fn.call(null, obj[i], i, obj);
	    }
	  } else {
	    // Iterate over object keys
	    for (var key in obj) {
	      if (Object.prototype.hasOwnProperty.call(obj, key)) {
	        fn.call(null, obj[key], key, obj);
	      }
	    }
	  }
	}

	/**
	 * Accepts varargs expecting each argument to be an object, then
	 * immutably merges the properties of each object and returns result.
	 *
	 * When multiple objects contain the same key the later object in
	 * the arguments list will take precedence.
	 *
	 * Example:
	 *
	 * ```js
	 * var result = merge({foo: 123}, {foo: 456});
	 * console.log(result.foo); // outputs 456
	 * ```
	 *
	 * @param {Object} obj1 Object to merge
	 * @returns {Object} Result of all merge properties
	 */
	function merge(/* obj1, obj2, obj3, ... */) {
	  var result = {};
	  function assignValue(val, key) {
	    if (isPlainObject(result[key]) && isPlainObject(val)) {
	      result[key] = merge(result[key], val);
	    } else if (isPlainObject(val)) {
	      result[key] = merge({}, val);
	    } else if (isArray(val)) {
	      result[key] = val.slice();
	    } else {
	      result[key] = val;
	    }
	  }

	  for (var i = 0, l = arguments.length; i < l; i++) {
	    forEach(arguments[i], assignValue);
	  }
	  return result;
	}

	/**
	 * Extends object a by mutably adding to it the properties of object b.
	 *
	 * @param {Object} a The object to be extended
	 * @param {Object} b The object to copy properties from
	 * @param {Object} thisArg The object to bind function to
	 * @return {Object} The resulting value of object a
	 */
	function extend(a, b, thisArg) {
	  forEach(b, function assignValue(val, key) {
	    if (thisArg && typeof val === 'function') {
	      a[key] = bind(val, thisArg);
	    } else {
	      a[key] = val;
	    }
	  });
	  return a;
	}

	/**
	 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
	 *
	 * @param {string} content with BOM
	 * @return {string} content value without BOM
	 */
	function stripBOM(content) {
	  if (content.charCodeAt(0) === 0xFEFF) {
	    content = content.slice(1);
	  }
	  return content;
	}

	module.exports = {
	  isArray: isArray,
	  isArrayBuffer: isArrayBuffer,
	  isBuffer: isBuffer,
	  isFormData: isFormData,
	  isArrayBufferView: isArrayBufferView,
	  isString: isString,
	  isNumber: isNumber,
	  isObject: isObject,
	  isPlainObject: isPlainObject,
	  isUndefined: isUndefined,
	  isDate: isDate,
	  isFile: isFile,
	  isBlob: isBlob,
	  isFunction: isFunction,
	  isStream: isStream,
	  isURLSearchParams: isURLSearchParams,
	  isStandardBrowserEnv: isStandardBrowserEnv,
	  forEach: forEach,
	  merge: merge,
	  extend: extend,
	  trim: trim,
	  stripBOM: stripBOM
	};


	/***/ })

	/******/ });
	});

	}(axios$1));

	var axios = /*@__PURE__*/getDefaultExportFromCjs(axios$1.exports);

	const ua = navigator.userAgent;
	const isIphone = /iphone/gi.test(ua);
	// https://github.com/shen1992/shenPlay/edit/master/video/index.js
	// https://juejin.cn/post/7000325965024854047#heading-7
	class H5video {
	  /****
	   * @param {Boolean}
	   * @param {object}  options            video相关配置
	   * @param {string}  options.container  video父容器选择器
	   * @param {string}  options.src        视频资源
	   * @param {string}  options.poster     视频封面
	   * @param {Boolean} options.controls   视频控制条，默认无
	   * @param {Boolean} options.canCover   视频元素是否可被覆盖，默认false
	   ***(false时，设置内联播放，部分安卓机会自动全屏播放。true时，安卓设备x5内核浏览器中启用x5播放器播放，仍会有弹窗效果)
	   ***@param {Boolean} options.iosInline 兼容部分ios浏览器(如蜗牛app)内联播放，默认false,为true时，需通过其他元素触发播放视频
	   */
	  constructor(container, options) {
	    this.options = options || {};
	    this.container = document.querySelector(container) || document.body;
	    this.src = options.src || '';
	    this.poster = options.poster || '';
	    this.controls = options.controls || false;
	    this.canCover = options.canCover || false;
	    this.iosInline = options.iosInline || false;
	    this.onPlayingCallBack = options.onPlaying || null;
	    this.onEndedCallBack = options.onEnded || null;
	    this.loop = options.loop;
	    this.preload = options.preload;
	    this.video = null;
	    this.initBox();
	  }
	  initBox() {
	      // 设置父盒子的背景为poster
	      this.container.style.backgroundImage = `url(${this.poster})`;
	      this.container.style.backgroundSize = '100%';
	      this.container.style.backgroundRepeat = 'no-repeat';
	  }
	  init(blobUrl) {
	    this.video = document.createElement('video');
	    if (this.canCover) {
	      this.video.setAttribute('playsInline', true);
	      this.video.setAttribute('src', blobUrl || this.src);
	      this.video.setAttribute('poster', this.poster);
	      this.video.setAttribute('width', '100%');
	      this.video.setAttribute('style', 'object-fit:fill;transform-origin: 0% 0% 0px;');
	      this.video.setAttribute('x-webkit-airplay', 'allow');
	      this.video.setAttribute('webkit-playsinline', '');
	      this.video.setAttribute('x5-video-player-type', 'h5');
	      this.video.setAttribute('x5-video-orientation', 'portrait');
	      this.video.setAttribute('muted', true);
	      if (isWeixin()) {
	        wx.config({
	          // 配置信息, 即使不正确也能使用 wx.ready
	          debug: false,
	          appId: '',
	          timestamp: 1,
	          nonceStr: '',
	          signature: '',
	          jsApiList: []
	        });
	        wx.ready(() => {
	          this.video.load();
	        });
	        document.addEventListener("WeixinJSBridgeReady", () => {
	          this.video.load();
	        }, false);
	      } else {
	        this.video.load();
	      }
	    }

	    if (this.loop) {
	      this.video.setAttribute('loop', 'loop');
	    }

	    this.container.appendChild(this.video);

	    if (!this.iosInline && this.controls) {
	      this.video.controls = true;
	    }
	    if (isIphone && this.iosInline) {
	      enableInlineVideo(this.video);
	    }
	    if (this.onPlayingCallBack) {
	      this.onPlaying(this.onPlayingCallBack);
	    }
	    this.onEnded(this.onEndedCallBack);
	    return this
	  }

	  onPreload() {
	    return axios({
	      method: 'get',
	      url: this.src,
	      responseType: 'blob'
	    }).then(({ data }) => {
	      const blob = URL.createObjectURL(data);
	      return blob
	    })
	  }

	  play() {
	    this.video.play();
	  }

	  onError(callback) {
	    this.video.addEventListener('error', (err) => {
	      console.log('load video get err', err);
	      callback && callback();
	    });
	  }

	  pause() {
	    this.video.pause();
	  }

	  status() {
	    if (this.video.paused) {
	      return 'paused';
	    } else {
	      return 'playing';
	    }
	  }

	  currentTime(time) {
	    if (time) {
	      this.video.currentTime = time;
	    } else {
	      return this.video.currentTime;
	    }
	  }

	  onPlaying(callback) {
	    let timeUpdate = () => {
	      if (this.video.currentTime > 0.1) {
	        callback && callback();
	        this.video.removeEventListener('timeupdate', timeUpdate);
	      }
	    };
	    this.video.addEventListener('timeupdate', timeUpdate);
	  }

	  onEnded(callback) {
	    this.video.addEventListener('ended', () => {
	      callback && callback();
	    });
	  }

	  canPlay(callback) {
	    let timer = setTimeout(() => {
	      callback && callback();
	      this.video.removeEventListener('canplaythrough', handleLoad);
	    }, 1000);

	    this.video.addEventListener('canplaythrough', handleLoad);
	    function handleLoad() {
	      clearTimeout(timer);
	      timer = null;
	      callback && callback();
	    }
	  }
	}

	exports.H5video = H5video;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
