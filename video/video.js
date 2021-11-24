import enableInlineVideo from 'iphone-inline-video';
import { isWeixin } from 'nw-detect';
import axios from 'axios/dist/axios';
const ua = navigator.userAgent;
const isIphone = /iphone/gi.test(ua);
// https://github.com/shen1992/shenPlay/edit/master/video/index.js
// https://juejin.cn/post/7000325965024854047#heading-7
// https://blog.csdn.net/hahahhahahahha123456/article/details/114821989
export class H5video {
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
    this.loop = options.loop
    this.preload = options.preload
    this.video = null;
    this.initBox();
  }
  setContainerStyle(styles = {}) {
      // 设置父盒子的背景为poster
      this.container.style.backgroundImage = `url(${this.poster})`
      this.container.style.backgroundSize = 'cover'
      this.container.style.backgroundRepeat = 'no-repeat'
  }
  init(blobUrl) {
    this.video = document.createElement('video')
    if (this.canCover) {
      this.video.setAttribute('playsInline', true)
      this.video.setAttribute('src', blobUrl || this.src)
      this.video.setAttribute('poster', this.poster)
      this.video.setAttribute('width', '100%')
      this.video.setAttribute('style', 'object-fit:fill;transform-origin: 0% 0% 0px;')
      this.video.setAttribute('x-webkit-airplay', 'allow')
      this.video.setAttribute('webkit-playsinline', '')
      this.video.setAttribute('x5-video-player-type', 'h5')
      this.video.setAttribute('x5-video-orientation', 'portrait')
      this.video.setAttribute('muted', true)
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
          this.video.load()
        })
        document.addEventListener("WeixinJSBridgeReady", () => {
          this.video.load()
        }, false);
      } else {
        this.video.load()
      }
    }

    if (this.loop) {
      this.video.setAttribute('loop', 'loop')
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
      const blob = URL.createObjectURL(data)
      return blob
    })
  }

  play() {
    alert("123")
    this.video.play();
  }

  onError(callback) {
    this.video.addEventListener('error', (err) => {
      console.log('load video get err', err)
      callback && callback()
    })
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
      this.video.removeEventListener('canplaythrough', handleLoad)
    }, 1000)

    this.video.addEventListener('canplaythrough', handleLoad);
    function handleLoad() {
      clearTimeout(timer)
      timer = null
      callback && callback();
    }
  }
}


