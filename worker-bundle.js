(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
module.exports = function nmap(n, map) {
  var result = new Array(n);

  for (var i = 0; i < n; i++) {
    result[i] = map(result[i], i, result);
  }

  return result;
};

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
"use strict";

module.exports.RATE_SCALAR = 0;
module.exports.RATE_CONTROL = 1;
module.exports.RATE_AUDIO = 2;
module.exports.RATE_DEMAND = 3;

module.exports.UI_KEY_STATE = 0;
module.exports.UI_MOUSE_BUTTON = 1;
module.exports.UI_MOUSE_X = 2;
module.exports.UI_MOUSE_Y = 3;
},{}],5:[function(require,module,exports){
"use strict";

module.exports = {
  sampleRate: 44100,
  blockSize: 64,
  numberOfChannels: 2,
  numberOfAudioBus: 16,
  numberOfControlBus: 128
};
},{}],6:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var nmap = require("nmap");
var util = require("./util");
var DefaultConfig = require("./DefaultConfig");
var SCGraphNode = require("./SCGraphNode");
var SCSynth = require("./SCSynth");
var SCRate = require("./SCRate");

var BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

var SCContext = function () {
  function SCContext(opts) {
    var _this = this;

    _classCallCheck(this, SCContext);

    opts = Object.assign({}, DefaultConfig, opts);

    this.sampleRate = util.toValidSampleRate(opts.sampleRate);
    this.blockSize = util.toValidBlockSize(opts.blockSize);
    this.numberOfChannels = util.toValidNumberOfChannels(opts.numberOfChannels);
    this.numberOfAudioBus = util.toValidNumberOfAudioBus(opts.numberOfAudioBus);
    this.numberOfControlBus = util.toValidNumberOfControlBus(opts.numberOfControlBus);

    var audioBusLength = this.numberOfAudioBus * this.blockSize;
    var controlBusLength = this.numberOfControlBus;

    this.bus = new Float32Array(audioBusLength + controlBusLength);
    this.audioBuses = nmap(this.numberOfAudioBus, function (_, ch) {
      return new Float32Array(_this.bus.buffer, ch * _this.blockSize * BYTES_PER_ELEMENT, _this.blockSize);
    });
    this.controlBuses = nmap(this.numberOfControlBus, function (_, ch) {
      return new Float32Array(_this.bus.buffer, (audioBusLength + ch) * BYTES_PER_ELEMENT, 1);
    });
    this.uiValues = new Float32Array(10);

    this.inputs = [];
    this.outputs = nmap(this.numberOfChannels, function (_, ch) {
      return _this.audioBuses[ch];
    });

    this.root = new SCGraphNode();
    this.aRate = new SCRate(this.sampleRate, this.blockSize);
    this.kRate = new SCRate(this.sampleRate / this.blockSize, 1);
  }

  _createClass(SCContext, [{
    key: "createSynth",
    value: function createSynth(synthdef) {
      return new SCSynth(this).build(synthdef);
    }
  }, {
    key: "createGroup",
    value: function createGroup() {
      return new SCGraphNode();
    }
  }, {
    key: "addToHead",
    value: function addToHead(node) {
      this.root.addToHead(node);
      return node;
    }
  }, {
    key: "addToTail",
    value: function addToTail(node) {
      this.root.addToTail(node);
      return node;
    }
  }, {
    key: "process",
    value: function process() {
      this.bus.fill(0);
      this.root.process(this.blockSize);
    }
  }]);

  return SCContext;
}();

module.exports = SCContext;
},{"./DefaultConfig":5,"./SCGraphNode":7,"./SCRate":9,"./SCSynth":10,"./util":174,"nmap":2}],7:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var events = require("events");
var _doneAction = require("./SCGraphNodeDoneAction");

var SCGraphNode = function (_events$EventEmitter) {
  _inherits(SCGraphNode, _events$EventEmitter);

  function SCGraphNode() {
    _classCallCheck(this, SCGraphNode);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SCGraphNode).call(this));

    _this.parent = null;
    _this.prev = null;
    _this.next = null;
    _this.head = null;
    _this.tail = null;
    _this.running = true;
    return _this;
  }

  _createClass(SCGraphNode, [{
    key: "run",
    value: function run(flag) {
      this.running = !!flag;
    }
  }, {
    key: "addToHead",
    value: function addToHead(node) {
      if (node.parent || node.prev || node.next) {
        throw new TypeError("node is already a partially element of another graph");
      }
      node.parent = this;
      node.prev = null;
      node.next = this.head;
      if (this.head) {
        this.head.prev = node;
        this.head = node;
      } else {
        this.head = this.tail = node;
      }
    }
  }, {
    key: "addToTail",
    value: function addToTail(node) {
      if (node.parent || node.prev || node.next) {
        throw new TypeError("node is already a partially element of another graph");
      }
      node.parent = this;
      node.prev = this.tail;
      node.next = null;
      if (this.tail) {
        this.tail.next = node;
        this.tail = node;
      } else {
        this.head = this.tail = node;
      }
    }
  }, {
    key: "addBefore",
    value: function addBefore(node) {
      if (node.parent || node.prev || node.next) {
        throw new TypeError("node is already a partially element of another graph");
      }
      node.parent = this.parent;
      node.prev = this.prev;
      node.next = this;
      if (this.prev) {
        this.prev.next = node;
      } else if (node.parent) {
        node.parent.head = node;
      }
      this.prev = node;
    }
  }, {
    key: "addAfter",
    value: function addAfter(node) {
      if (node.parent || node.prev || node.next) {
        throw new TypeError("node is already a partially element of another graph");
      }
      node.parent = this.parent;
      node.prev = this;
      node.next = this.next;
      if (this.next) {
        this.next.prev = node;
      } else if (node.parent) {
        node.parent.tail = node;
      }
      this.next = node;
    }
  }, {
    key: "replace",
    value: function replace(node) {
      node.parent = this.parent;
      node.prev = this.prev;
      node.next = this.next;
      node.head = this.head;
      node.tail = this.tail;
      if (this.prev) {
        this.prev.next = node;
      }
      if (this.next) {
        this.next.prev = node;
      }
      if (node.parent) {
        if (node.parent.head === this) {
          node.parent.head = node;
        }
        if (node.parent.tail === this) {
          node.parent.tail = node;
        }
      }
      this.parent = null;
      this.prev = null;
      this.next = null;
    }
  }, {
    key: "end",
    value: function end() {
      if (this.prev) {
        this.prev.next = this.next;
      }
      if (this.next) {
        this.next.prev = this.prev;
      }
      if (this.parent) {
        if (this.parent.head === this) {
          this.parent.head = this.next;
        }
        if (this.parent.tail === this) {
          this.parent.tail = this.prev;
        }
      }
      this.parent = null;
      this.prev = null;
      this.next = null;
      this.head = null;
      this.tail = null;
      this.running = false;
    }
  }, {
    key: "endAll",
    value: function endAll() {
      var node = this.head;
      while (node) {
        var next = node.next;
        node.end();
        node = next;
      }
      this.end();
    }
  }, {
    key: "endDeep",
    value: function endDeep() {
      var node = this.head;
      while (node) {
        var next = node.next;
        node.endDeep();
        node = next;
      }
      this.end();
    }
  }, {
    key: "doneAction",
    value: function doneAction(action) {
      if (typeof _doneAction[action] === "function") {
        _doneAction[action](this);
      }
    }
  }, {
    key: "process",
    value: function process(inNumSamples) {
      if (this.running) {
        if (this.head) {
          this.head.process(inNumSamples);
        }
        if (this.dspProcess) {
          this.dspProcess(inNumSamples);
        }
      }
      if (this.next) {
        this.next.process(inNumSamples);
      }
    }
  }]);

  return SCGraphNode;
}(events.EventEmitter);

module.exports = SCGraphNode;
},{"./SCGraphNodeDoneAction":8,"events":1}],8:[function(require,module,exports){
"use strict";

var doneAction = [];

// do nothing when the UGen is finished
doneAction[0] = null;

// pause the enclosing synth, but do not free it
doneAction[1] = function (node) {
  node.run(false);
};

// free the enclosing synth
doneAction[2] = function (node) {
  node.end();
};

// free both this synth and the preceding node
doneAction[3] = function (node) {
  if (node.prev) {
    node.prev.end();
  }
  node.end();
};

// free both this synth and the following node
doneAction[4] = function (node) {
  if (node.next) {
    node.next.end();
  }
  node.end();
};

// free this synth; if the preceding node is a group then do g_freeAll on it, else free it
doneAction[5] = function (node) {
  if (node.prev) {
    node.prev.endAll();
  }
  node.end();
};

// free this synth; if the following node is a group then do g_freeAll on it, else free it
doneAction[6] = function (node) {
  if (node.next) {
    node.next.endAll();
  }
  node.end();
};

// free this synth and all preceding nodes in this group
doneAction[7] = function (node) {
  var prev = void 0;
  while (node) {
    prev = node.prev;
    node.end();
    node = prev;
  }
};

// free this synth and all following nodes in this group
doneAction[8] = function (node) {
  var next = void 0;
  while (node) {
    next = node.next;
    node.end();
    node = next;
  }
};

// free this synth and pause the preceding node
doneAction[9] = function (node) {
  if (node.prev) {
    node.prev.run(false);
  }
  node.end();
};

// free this synth and pause the following node
doneAction[10] = function (node) {
  if (node.next) {
    node.next.run(false);
  }
  node.end();
};

// free this synth and if the preceding node is a group then do g_deepFree on it, else free it
doneAction[11] = function (node) {
  if (node.prev) {
    node.prev.endDeep();
  }
  node.end();
};

// free this synth and if the following node is a group then do g_deepFree on it, else free it
doneAction[12] = function (node) {
  if (node.next) {
    node.next.endDeep();
  }
  node.end();
};

// free this synth and all other nodes in this group (before and after)
doneAction[13] = function (node, next) {
  if (node.parent) {
    node = node.parent.head;
    while (node) {
      next = node.next;
      node.end();
      node = next;
    }
  }
};

// free the enclosing group and all nodes within it (including this synth)
doneAction[14] = function (node) {
  node.parent.endDeep();
};

module.exports = doneAction;
},{}],9:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SCRate = function SCRate(sampleRate, bufferLength) {
  _classCallCheck(this, SCRate);

  this.sampleRate = sampleRate;
  this.sampleDur = 1 / sampleRate;
  this.radiansPerSample = Math.PI * 2 / sampleRate;
  this.bufferLength = bufferLength;
  this.bufferDuration = bufferLength / sampleRate;
  this.bufferRate = 1 / this.bufferDuration;
  this.slopeFactor = 1 / bufferLength;
  this.filterLoops = bufferLength / 3 | 0;
  this.filterRemain = bufferLength % 3 | 0;
  if (this.filterLoops === 0) {
    this.filterSlope = 0;
  } else {
    this.filterSlope = 1 / this.filterLoops;
  }
};

module.exports = SCRate;
},{}],10:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCGraphNode = require("./SCGraphNode");
var SCSynthBuilder = require("./SCSynthBuilder");

var SCSynth = function (_SCGraphNode) {
  _inherits(SCSynth, _SCGraphNode);

  function SCSynth(context) {
    _classCallCheck(this, SCSynth);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SCSynth).call(this));

    _this.context = context;
    _this.synthdef = null;
    _this.paramIndices = null;
    _this.consts = null;
    _this.params = null;
    _this.buffer = null;
    _this.unitList = null;
    return _this;
  }

  _createClass(SCSynth, [{
    key: "build",
    value: function build(synthdef) {
      var _this2 = this;

      if (this.synthdef !== null) {
        throw new TypeError("synth has be already built");
      }
      this.synthdef = synthdef;
      this.paramIndices = synthdef.paramIndices;

      SCSynthBuilder.build(this, synthdef);

      Object.keys(this.paramIndices).forEach(function (name) {
        Object.defineProperty(_this2, "$" + name, {
          set: function set(value) {
            this.setParam(name, value);
          },
          get: function get() {
            return this.getParam(name);
          },

          enumerable: true, configurable: true
        });
      });

      return this;
    }
  }, {
    key: "setParam",
    value: function setParam(key, value) {
      if (this.paramIndices.hasOwnProperty(key)) {
        if (this.paramIndices[key].length === 1) {
          this.params[this.paramIndices[key].index] = value;
        } else {
          this.params.set(value, this.paramIndices[key].index);
        }
      }
      return this;
    }
  }, {
    key: "getParam",
    value: function getParam(key) {
      if (this.paramIndices.hasOwnProperty(key)) {
        if (this.paramIndices[key].length === 1) {
          return this.params[this.paramIndices[key].index];
        } else {
          return this.params.subarray(this.paramIndices[key].index, this.paramIndices[key].index + this.paramIndices[key].length);
        }
      }
      return 0;
    }
  }, {
    key: "dspProcess",
    value: function dspProcess() {
      var unitList = this.unitList;

      this.buffer.fill(0);

      for (var i = 0, imax = unitList.length; i < imax; i++) {
        unitList[i].dspProcess(unitList[i].bufferLength);
      }
    }
  }]);

  return SCSynth;
}(SCGraphNode);

module.exports = SCSynth;
},{"./SCGraphNode":7,"./SCSynthBuilder":11}],11:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var C = require("./Constants");
var SCUnitRepository = require("./SCUnitRepository");

var CONSTANT_VALUE = -1;
var BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

var SCSynthBuilder = function () {
  function SCSynthBuilder() {
    _classCallCheck(this, SCSynthBuilder);
  }

  _createClass(SCSynthBuilder, null, [{
    key: "build",
    value: function build(synthInstance, synthdef) {
      var context = synthInstance.context;
      var consts = synthdef.consts.map(function (x) {
        return new Float32Array([x]);
      });
      var params = new Float32Array(synthdef.paramValues);
      var bufferLength = synthdef.specs.reduce(function (sum, spec) {
        return sum + spec[4].reduce(function (sum, rate) {
          return sum + $rate(context, rate).bufferLength;
        }, 0);
      }, 0);
      var buffer = new Float32Array(bufferLength);
      var unitList = [];

      synthInstance.consts = consts;
      synthInstance.params = params;
      synthInstance.buffer = buffer;
      synthInstance.unitList = unitList;

      var specs = synthdef.specs;
      var bufferOffset = 0;

      for (var i = 0, imax = specs.length; i < imax; i++) {
        var spec = specs[i];
        var inputSpecs = spec[3];
        var outputSpecs = spec[4];
        var unit = SCUnitRepository.createSCUnit(synthInstance, spec);

        for (var j = 0, jmax = unit.inputs.length; j < jmax; j++) {
          var inputSpec = inputSpecs[j];

          if (inputSpec[0] === CONSTANT_VALUE) {
            unit.inputs[j] = consts[inputSpec[1]];
            unit.inputSpecs[j].rate = C.RATE_SCALAR;
          } else {
            unit.inputs[j] = unitList[inputSpec[0]].outputs[inputSpec[1]];
            unit.inputSpecs[j].rate = unitList[inputSpec[0]].outputSpecs[inputSpec[1]].rate;
            unit.inputSpecs[j].unit = unitList[inputSpec[0]];
          }
        }
        for (var _j = 0, _jmax = unit.outputs.length; _j < _jmax; _j++) {
          var outputSpec = outputSpecs[_j];
          var _bufferLength = $rate(context, outputSpec).bufferLength;

          unit.outputs[_j] = new Float32Array(buffer.buffer, bufferOffset * BYTES_PER_ELEMENT, _bufferLength);
          unit.outputSpecs[_j].rate = outputSpec;

          bufferOffset += _bufferLength;
        }

        var rate = $rate(context, unit.calcRate);

        unit.bufferLength = rate.bufferLength;
        unit.initialize(rate);

        if (unit.dspProcess && unit.calcRate !== C.RATE_DEMAND) {
          unitList[i] = unit;
        } else {
          unitList[i] = null;
        }
      }

      return synthInstance;
    }
  }]);

  return SCSynthBuilder;
}();

function $rate(context, rate) {
  return rate === C.RATE_AUDIO ? context.aRate : context.kRate;
}

module.exports = SCSynthBuilder;
},{"./Constants":4,"./SCUnitRepository":13}],12:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SCUnit = function () {
  function SCUnit(synth, spec) {
    _classCallCheck(this, SCUnit);

    this.context = synth.context;
    this.synth = synth;
    this.name = spec[0];
    this.calcRate = spec[1];
    this.specialIndex = spec[2];
    this.inputs = new Array(spec[3].length);
    this.outputs = new Array(spec[4].length);
    this.inputSpecs = spec[3].map(function () {
      return { rate: 0, unit: null };
    });
    this.outputSpecs = spec[4].map(function () {
      return { rate: 0 };
    });
    this.bufferLength = 0;
    this.dspProcess = null;
    this.done = false;
  }

  _createClass(SCUnit, [{
    key: "initialize",
    value: function initialize() {}
  }, {
    key: "doneAction",
    value: function doneAction(action) {
      this.synth.doneAction(action);
    }
  }]);

  return SCUnit;
}();

module.exports = SCUnit;
},{}],13:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var db = new Map();

var SCUnitRepository = function () {
  function SCUnitRepository() {
    _classCallCheck(this, SCUnitRepository);
  }

  _createClass(SCUnitRepository, null, [{
    key: "createSCUnit",
    value: function createSCUnit(synth, spec) {
      var name = spec[0];

      if (!db.has(name)) {
        throw new TypeError("SCUnit not defined: " + name);
      }

      return new (db.get(name))(synth, spec);
    }
  }, {
    key: "registerSCUnitClass",
    value: function registerSCUnitClass(name, SCUnitClass) {
      return db.set(name, SCUnitClass);
    }
  }, {
    key: "unregisterSCUnitClass",
    value: function unregisterSCUnitClass(name) {
      return db.delete(name);
    }
  }]);

  return SCUnitRepository;
}();

module.exports = SCUnitRepository;
},{}],14:[function(require,module,exports){
"use strict";

var Constants = require("./Constants");
var SCContext = require("./SCContext");
var SCGraphNode = require("./SCGraphNode");
var SCSynth = require("./SCSynth");
var SCUnit = require("./SCUnit");
var SCUnitRepository = require("./SCUnitRepository");
var unit = require("./unit");

module.exports = { Constants: Constants, SCContext: SCContext, SCGraphNode: SCGraphNode, SCSynth: SCSynth, SCUnit: SCUnit, SCUnitRepository: SCUnitRepository, unit: unit };
},{"./Constants":4,"./SCContext":6,"./SCGraphNode":7,"./SCSynth":10,"./SCUnit":12,"./SCUnitRepository":13,"./unit":170}],15:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitA2K = function (_SCUnit) {
  _inherits(SCUnitA2K, _SCUnit);

  function SCUnitA2K() {
    _classCallCheck(this, SCUnitA2K);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitA2K).apply(this, arguments));
  }

  _createClass(SCUnitA2K, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
    }
  }]);

  return SCUnitA2K;
}(SCUnit);

dspProcess["next"] = function () {
  this.outputs[0][0] = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("A2K", SCUnitA2K);
module.exports = SCUnitA2K;
},{"../SCUnit":12,"../SCUnitRepository":13}],16:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitAPF = function (_SCUnit) {
  _inherits(SCUnitAPF, _SCUnit);

  function SCUnitAPF() {
    _classCallCheck(this, SCUnitAPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAPF).apply(this, arguments));
  }

  _createClass(SCUnitAPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._x1 = 0;
      this._x2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitAPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = Math.max(0, Math.min(this.inputs[2][0], 1));
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  var x1 = this._x1;
  var x2 = this._x2;
  if (freq !== this._freq && reson !== this._reson) {
    var b1_next = 2 * reson * Math.cos(freq * this._radiansPerSample);
    var b2_next = -(reson * reson);
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var x0 = inIn[i];
      var y0 = x0 + (b1 + b1_slope * i) * (y1 - x1) + (b2 + b2_slope * i) * (y2 - x2);
      out[i] = y0;
      y2 = y1;
      y1 = y0;
      x2 = x1;
      x1 = x0;
    }
    this._freq = freq;
    this._reson = reson;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _x = inIn[_i];
      var _y = _x + b1 * (y1 - x1) + b2 * (y2 - x2);
      out[_i] = _y;
      y2 = y1;
      y1 = _y;
      x2 = x1;
      x1 = _x;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("APF", SCUnitAPF);
module.exports = SCUnitAPF;
},{"../SCUnit":12,"../SCUnitRepository":13}],17:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var cubicinterp = require("../util/cubicinterp");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitAllpassC = function (_SCUnit) {
  _inherits(SCUnitAllpassC, _SCUnit);

  function SCUnitAllpassC() {
    _classCallCheck(this, SCUnitAllpassC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAllpassC).apply(this, arguments));
  }

  _createClass(SCUnitAllpassC, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitAllpassC;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d0 = dlybuf[irdphase + 1 & mask];
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var d3 = dlybuf[irdphase - 2 & mask];
        var value = cubicinterp(frac, d0, d1, d2, d3) || 0;
        var dwr = value * feedbk + inIn[i] || 0;
        dlybuf[iwrphase & mask] = dwr;
        out[i] = value - feedbk * dwr;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase + 1 & mask];
        var _d2 = dlybuf[irdphase & mask];
        var _d3 = dlybuf[irdphase - 1 & mask];
        var _d4 = dlybuf[irdphase - 2 & mask];
        var _value = cubicinterp(frac, _d, _d2, _d3, _d4) || 0;
        var _dwr = _value * feedbk + inIn[_i] || 0;
        dlybuf[iwrphase & mask] = _dwr;
        out[_i] = _value - feedbk * _dwr;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _frac = dsamp - (dsamp | 0);
      var _d5 = dlybuf[irdphase + 1 & mask];
      var _d6 = dlybuf[irdphase & mask];
      var _d7 = dlybuf[irdphase - 1 & mask];
      var _d8 = dlybuf[irdphase - 2 & mask];
      var _value2 = cubicinterp(_frac, _d5, _d6, _d7, _d8) || 0;
      var _dwr2 = _value2 * feedbk + inIn[_i2] || 0;
      dlybuf[iwrphase & mask] = _dwr2;
      out[_i2] = _value2 - feedbk * _dwr2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("AllpassC", SCUnitAllpassC);
module.exports = SCUnitAllpassC;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/cubicinterp":172,"../util/toPowerOfTwo":176,"./_delay":167}],18:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitAllpassL = function (_SCUnit) {
  _inherits(SCUnitAllpassL, _SCUnit);

  function SCUnitAllpassL() {
    _classCallCheck(this, SCUnitAllpassL);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAllpassL).apply(this, arguments));
  }

  _createClass(SCUnitAllpassL, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitAllpassL;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var value = d1 + frac * (d2 - d1) || 0;
        var dwr = value * feedbk + inIn[i] || 0;
        dlybuf[iwrphase & mask] = dwr;
        out[i] = value - feedbk * dwr;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase & mask];
        var _d2 = dlybuf[irdphase - 1 & mask];
        var _value = _d + frac * (_d2 - _d) || 0;
        var _dwr = _value * feedbk + inIn[_i] || 0;
        dlybuf[iwrphase & mask] = _dwr;
        out[_i] = _value - feedbk * _dwr;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _frac = dsamp - (dsamp | 0);
      var _d3 = dlybuf[irdphase & mask];
      var _d4 = dlybuf[irdphase - 1 & mask];
      var _value2 = _d3 + _frac * (_d4 - _d3) || 0;
      var _dwr2 = _value2 * feedbk + inIn[_i2] || 0;
      dlybuf[iwrphase & mask] = _dwr2;
      out[_i2] = _value2 - feedbk * _dwr2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("AllpassL", SCUnitAllpassL);
module.exports = SCUnitAllpassL;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/toPowerOfTwo":176,"./_delay":167}],19:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitAllpassN = function (_SCUnit) {
  _inherits(SCUnitAllpassN, _SCUnit);

  function SCUnitAllpassN() {
    _classCallCheck(this, SCUnitAllpassN);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAllpassN).apply(this, arguments));
  }

  _createClass(SCUnitAllpassN, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitAllpassN;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var value = dlybuf[irdphase & mask] || 0;
        var dwr = value * feedbk + inIn[i] || 0;
        dlybuf[iwrphase & mask] = dwr;
        out[i] = value - feedbk * dwr;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _value = dlybuf[irdphase & mask] || 0;
        var _dwr = _value * feedbk + inIn[_i] || 0;
        dlybuf[iwrphase & mask] = _dwr;
        out[_i] = _value - feedbk * _dwr;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _value2 = dlybuf[irdphase & mask] || 0;
      var _dwr2 = _value2 * feedbk + inIn[_i2] || 0;
      dlybuf[iwrphase & mask] = _dwr2;
      out[_i2] = _value2 - feedbk * _dwr2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("AllpassN", SCUnitAllpassN);
module.exports = SCUnitAllpassN;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/toPowerOfTwo":176,"./_delay":167}],20:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBPF = function (_SCUnit) {
  _inherits(SCUnitBPF, _SCUnit);

  function SCUnitBPF() {
    _classCallCheck(this, SCUnitBPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBPF).apply(this, arguments));
  }

  _createClass(SCUnitBPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._bw = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitBPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var bw = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || bw !== this._bw) {
    var pfreq = freq * this._radiansPerSample;
    var pbw = bw * pfreq * 0.5;
    var C = pbw ? 1 / Math.tan(pbw) : 0;
    var D = 2 * Math.cos(pfreq);
    var next_a0 = 1 / (1 + C);
    var next_b1 = C * D * next_a0;
    var next_b2 = (1 - C) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._bw = bw;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("BPF", SCUnitBPF);
module.exports = SCUnitBPF;
},{"../SCUnit":12,"../SCUnitRepository":13}],21:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBPZ2 = function (_SCUnit) {
  _inherits(SCUnitBPZ2, _SCUnit);

  function SCUnitBPZ2() {
    _classCallCheck(this, SCUnitBPZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBPZ2).apply(this, arguments));
  }

  _createClass(SCUnitBPZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitBPZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 - x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("BPZ2", SCUnitBPZ2);
module.exports = SCUnitBPZ2;
},{"../SCUnit":12,"../SCUnitRepository":13}],22:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBRF = function (_SCUnit) {
  _inherits(SCUnitBRF, _SCUnit);

  function SCUnitBRF() {
    _classCallCheck(this, SCUnitBRF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBRF).apply(this, arguments));
  }

  _createClass(SCUnitBRF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._a1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._bw = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitBRF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var bw = this.inputs[2][0];
  var a0 = this._a0;
  var a1 = this._a1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || bw !== this._bw) {
    var pfreq = freq * this._radiansPerSample;
    var pbw = bw * pfreq * 0.5;
    var C = Math.tan(pbw);
    var D = 2 * Math.cos(pfreq);
    var next_a0 = 1 / (1 + C);
    var next_a1 = -D * next_a0;
    var next_b2 = (1 - C) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var a1_slope = (next_a1 - a1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var ay = (a1 + a1_slope * i) * y1;
      var y0 = inIn[i] - ay - (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 + y2) + ay;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._bw = bw;
    this._a0 = next_a0;
    this._a1 = next_a1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _ay = a1 * y1;
      var _y = inIn[_i] - _ay - b2 * y2;
      out[_i] = a0 * (_y + y2) + _ay;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("BRF", SCUnitBRF);
module.exports = SCUnitBRF;
},{"../SCUnit":12,"../SCUnitRepository":13}],23:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBRZ2 = function (_SCUnit) {
  _inherits(SCUnitBRZ2, _SCUnit);

  function SCUnitBRZ2() {
    _classCallCheck(this, SCUnitBRZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBRZ2).apply(this, arguments));
  }

  _createClass(SCUnitBRZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitBRZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 + x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("BRZ2", SCUnitBRZ2);
module.exports = SCUnitBRZ2;
},{"../SCUnit":12,"../SCUnitRepository":13}],24:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var wrap = require("../util/wrap");
var fold = require("../util/fold");
var $i2n = "\n+ - * / / % eq ne lt gt le ge min max bitAnd bitOr bitXor lcm gcd round roundUp trunc atan2 hypot\nhypotApx pow leftShift rightShift unsignedRightShift fill ring1 ring2 ring3 ring4 difsqr sumsqr\nsqrsum sqrdif absdif thresh amclip scaleneg clip2 excess fold2 wrap2 firstarg randrange exprandrange\nnumbinaryselectors roundDown".trim().split(/\s/);
var dspProcess = {};

var SCUnitBinaryOpUGen = function (_SCUnit) {
  _inherits(SCUnitBinaryOpUGen, _SCUnit);

  function SCUnitBinaryOpUGen() {
    _classCallCheck(this, SCUnitBinaryOpUGen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBinaryOpUGen).apply(this, arguments));
  }

  _createClass(SCUnitBinaryOpUGen, [{
    key: "initialize",
    value: function initialize(rate) {
      var dspFunc = dspProcess[$i2n[this.specialIndex]];
      if (!dspFunc) {
        throw new Error("BinaryOpUGen[" + $i2n[this.specialIndex] + "] is not defined.");
      }
      this._slopeFactor = rate.slopeFactor;
      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspFunc["dd"];
      } else {
        this.dspProcess = dspFunc[$r2k(this.inputSpecs)];
        this._a = this.inputs[0][0];
        this._b = this.inputs[1][0];
        if (this.dspProcess) {
          this.dspProcess(1);
        } else {
          this.outputs[0][0] = dspFunc(this._a, this._b);
        }
      }
    }
  }]);

  return SCUnitBinaryOpUGen;
}(SCUnit);

function $r2k(inputSpecs) {
  return inputSpecs.map(function (x) {
    return x.rate === C.RATE_AUDIO ? "a" : x.rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}
function gcd(a, b) {
  a = Math.floor(a);
  b = Math.floor(b);
  while (b !== 0) {
    var _ref = [b, a % b];
    a = _ref[0];
    b = _ref[1];
  }
  return Math.abs(a);
}
dspProcess["+"] = function (a, b) {
  return a + b;
};
dspProcess["-"] = function (a, b) {
  return a - b;
};
dspProcess["*"] = function (a, b) {
  return a * b;
};
dspProcess["/"] = function (a, b) {
  return b === 0 ? 0 : a / b;
};
dspProcess["%"] = function (a, b) {
  return b === 0 ? 0 : a % b;
};
dspProcess["eq"] = function (a, b) {
  return a === b ? 1 : 0;
};
dspProcess["ne"] = function (a, b) {
  return a !== b ? 1 : 0;
};
dspProcess["lt"] = function (a, b) {
  return a < b ? 1 : 0;
};
dspProcess["gt"] = function (a, b) {
  return a > b ? 1 : 0;
};
dspProcess["le"] = function (a, b) {
  return a <= b ? 1 : 0;
};
dspProcess["ge"] = function (a, b) {
  return a >= b ? 1 : 0;
};
dspProcess["bitAnd"] = function (a, b) {
  return a & b;
};
dspProcess["bitOr"] = function (a, b) {
  return a | b;
};
dspProcess["bitXor"] = function (a, b) {
  return a ^ b;
};
dspProcess["min"] = function (a, b) {
  return Math.min(a, b);
};
dspProcess["max"] = function (a, b) {
  return Math.max(a, b);
};
dspProcess["lcm"] = function (a, b) {
  if (a === 0 && b === 0) {
    return 0;
  }
  return Math.abs(a * b) / gcd(a, b);
};
dspProcess["gcd"] = function (a, b) {
  return gcd(a, b);
};
dspProcess["round"] = function (a, b) {
  return b === 0 ? a : Math.round(a / b) * b;
};
dspProcess["roundUp"] = function (a, b) {
  return b === 0 ? a : Math.ceil(a / b) * b;
};
dspProcess["roundDown"] = function (a, b) {
  return b === 0 ? a : Math.floor(a / b) * b;
};
dspProcess["trunc"] = function (a, b) {
  return b === 0 ? a : Math.floor(a / b) * b;
};
dspProcess["atan2"] = function (a, b) {
  return Math.atan2(a, b);
};
dspProcess["hypot"] = function (a, b) {
  return Math.sqrt(a * a + b * b);
};
dspProcess["hypotApx"] = function (a, b) {
  var x = Math.abs(a);
  var y = Math.abs(b);
  var minxy = Math.min(x, y);
  return x + y - (Math.sqrt(2) - 1) * minxy;
};
dspProcess["pow"] = function (a, b) {
  return Math.pow(Math.abs(a), b);
};
dspProcess["leftShift"] = function (a, b) {
  if (b < 0) {
    return (a | 0) >> (-b | 0);
  }
  return (a | 0) << (b | 0);
};
dspProcess["rightShift"] = function (a, b) {
  if (b < 0) {
    return (a | 0) << (-b | 0);
  }
  return (a | 0) >> (b | 0);
};
dspProcess["unsignedRightShift"] = function (a, b) {
  if (b < 0) {
    return (a | 0) << (-b | 0);
  }
  return (a | 0) >> (b | 0);
};
dspProcess["ring1"] = function (a, b) {
  return a * b + a;
};
dspProcess["ring2"] = function (a, b) {
  return a * b + a + b;
};
dspProcess["ring3"] = function (a, b) {
  return a * a * b;
};
dspProcess["ring4"] = function (a, b) {
  return a * a * b - a * b * b;
};
dspProcess["difsqr"] = function (a, b) {
  return a * a - b * b;
};
dspProcess["sumsqr"] = function (a, b) {
  return a * a + b * b;
};
dspProcess["sqrsum"] = function (a, b) {
  return (a + b) * (a + b);
};
dspProcess["sqrdif"] = function (a, b) {
  return (a - b) * (a - b);
};
dspProcess["absdif"] = function (a, b) {
  return Math.abs(a - b);
};
dspProcess["thresh"] = function (a, b) {
  return a < b ? 0 : a;
};
dspProcess["amclip"] = function (a, b) {
  return a * 0.5 * (b + Math.abs(b));
};
dspProcess["scaleneg"] = function (a, b) {
  b = 0.5 * b + 0.5;
  return (Math.abs(a) - a) * b + a;
};
dspProcess["clip2"] = function (a, b) {
  return Math.max(-b, Math.min(a, b));
};
dspProcess["excess"] = function (a, b) {
  return a - Math.max(-b, Math.min(a, b));
};
dspProcess["fold2"] = function (val, hi) {
  return fold(val, -hi, hi);
};
dspProcess["wrap2"] = function (val, hi) {
  return wrap(val, -hi, hi);
};
dspProcess["+"]["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] + bIn[i];
  }
};
dspProcess["+"]["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  var nextB = this.inputs[1][0];
  var bSlope = (nextB - this._b) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] + (b + bSlope * i);
  }
  this._b = nextB;
};
dspProcess["+"]["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] + b;
  }
};
dspProcess["+"]["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  var nextA = this.inputs[0][0];
  var aSlope = (nextA - this._a) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a + aSlope * i + bIn[i];
  }
  this._a = nextA;
};
dspProcess["+"]["kk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this.inputs[1][0];
};
dspProcess["+"]["ki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this._b;
};
dspProcess["+"]["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a + bIn[i];
  }
};
dspProcess["+"]["ik"] = function () {
  this.outputs[0][0] = this._a + this.inputs[1][0];
};
dspProcess["-"]["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] - bIn[i];
  }
};
dspProcess["-"]["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  var nextB = this.inputs[1][0];
  var bSlope = (nextB - this._b) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] - (b + bSlope * i);
  }
  this._b = nextB;
};
dspProcess["-"]["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] - b;
  }
};
dspProcess["-"]["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  var nextA = this.inputs[0][0];
  var aSlope = (nextA - this._a) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a + aSlope * i - bIn[i];
  }
  this._a = nextA;
};
dspProcess["-"]["kk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] - this.inputs[1][0];
};
dspProcess["-"]["ki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] - this._b;
};
dspProcess["-"]["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a - bIn[i];
  }
};
dspProcess["-"]["ik"] = function () {
  this.outputs[0][0] = this._a - this.inputs[1][0];
};
dspProcess["*"]["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] * bIn[i];
  }
};
dspProcess["*"]["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  var nextB = this.inputs[1][0];
  var bSlope = (nextB - this._b) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] * (b + bSlope * i);
  }
  this._b = nextB;
};
dspProcess["*"]["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] * b;
  }
};
dspProcess["*"]["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  var nextA = this.inputs[0][0];
  var aSlope = (nextA - this._a) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = (a + aSlope * i) * bIn[i];
  }
  this._a = nextA;
};
dspProcess["*"]["kk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this.inputs[1][0];
};
dspProcess["*"]["ki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this._b;
};
dspProcess["*"]["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a * bIn[i];
  }
};
dspProcess["*"]["ik"] = function () {
  this.outputs[0][0] = this._a * this.inputs[1][0];
};
function binary_aa(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    var bIn = this.inputs[1];
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i], bIn[i]);
    }
  };
}
function binary_ak(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    var b = this._b;
    var nextB = this.inputs[1][0];
    var bSlope = (nextB - this._b) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i], b + bSlope * i);
    }
    this._b = nextB;
  };
}
function binary_ai(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    var b = this._b;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i], b);
    }
  };
}
function binary_ka(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var a = this._a;
    var bIn = this.inputs[1];
    var nextA = this.inputs[0][0];
    var aSlope = (nextA - this._a) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i += 8) {
      out[i] = func(a + aSlope * i, bIn[i]);
    }
    this._a = nextA;
  };
}
function binary_kk(func) {
  return function () {
    this.outputs[0][0] = func(this.inputs[0][0], this.inputs[1][0]);
  };
}
function binary_ki(func) {
  return function () {
    this.outputs[0][0] = func(this.inputs[0][0], this._b);
  };
}
function binary_ia(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var a = this._a;
    var bIn = this.inputs[1];
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(a, bIn[i]);
    }
  };
}
function binary_ik(func) {
  return function () {
    this.outputs[0][0] = func(this._a, this.inputs[1][0]);
  };
}
function binary_dd(func) {
  return function (inNumSamples) {
    if (inNumSamples) {
      var a = demand.next(this, 0, inNumSamples);
      var b = demand.next(this, 1, inNumSamples);
      this.outputs[0][0] = isNaN(a) || isNaN(b) ? NaN : func(a, b);
    } else {
      demand.reset(this, 0);
      demand.reset(this, 1);
    }
  };
}
Object.keys(dspProcess).forEach(function (key) {
  var func = dspProcess[key];
  func["aa"] = func["aa"] || binary_aa(func);
  func["ak"] = func["ak"] || binary_ak(func);
  func["ai"] = func["ai"] || binary_ai(func);
  func["ka"] = func["ka"] || binary_ka(func);
  func["kk"] = func["kk"] || binary_kk(func);
  func["ki"] = func["ki"] || binary_ki(func);
  func["ia"] = func["ia"] || binary_ia(func);
  func["ik"] = func["ik"] || binary_ik(func);
  func["dd"] = binary_dd(func);
});
SCUnitRepository.registerSCUnitClass("BinaryOpUGen", SCUnitBinaryOpUGen);
module.exports = SCUnitBinaryOpUGen;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"../util/fold":173,"../util/wrap":182,"./_demand":168}],25:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");
var dspProcess = {};
var gSine = sine.gSine;
var gInvSine = sine.gInvSine;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;
var kBadValue = sine.kBadValue;

var SCUnitBlip = function (_SCUnit) {
  _inherits(SCUnitBlip, _SCUnit);

  function SCUnitBlip() {
    _classCallCheck(this, SCUnitBlip);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBlip).apply(this, arguments));
  }

  _createClass(SCUnitBlip, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._numharm = this.inputs[1][0] | 0;
      this._cpstoinc = kSineSize * rate.sampleDur * 0.5;
      var N = this._numharm;
      var maxN = Math.max(1, rate.sampleRate * 0.5 / this._freq | 0);
      this._N = Math.max(1, Math.min(N, maxN));
      this._mask = kSineMask;
      this._scale = 0.5 / this._N;
      this._phase = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitBlip;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var numharm = this.inputs[1][0] | 0;
  var phase = this._phase;
  var mask = this._mask;
  var numtbl = gSine,
      dentbl = gInvSine;
  var N = void 0,
      N2 = void 0,
      maxN = void 0,
      prevN = void 0,
      prevN2 = void 0,
      scale = void 0,
      prevScale = void 0,
      crossfade = void 0;
  var tblIndex = void 0,
      t0 = void 0,
      t1 = void 0,
      pfrac = void 0,
      denom = void 0,
      rphase = void 0,
      numer = void 0,
      n1 = void 0,
      n2 = void 0;
  var i = void 0,
      xfade = void 0,
      xfade_slope = void 0;
  if (numharm !== this._numharm || freq !== this._freq) {
    N = numharm;
    maxN = Math.max(1, this._sampleRate * 0.5 / this._freq | 0);
    if (maxN < N) {
      N = maxN;
      freq = this._cpstoinc * Math.max(this._freq, freq);
    } else {
      if (N < 1) {
        N = 1;
      }
      freq = this._cpstoinc * freq;
    }
    crossfade = N !== this._N;
    prevN = this._N;
    prevScale = this._scale;
    this._N = Math.max(1, Math.min(N, maxN));
    this._scale = scale = 0.5 / N;
  } else {
    N = this._N;
    freq = this._cpstoinc * freq;
    scale = this._scale;
    crossfade = false;
  }
  N2 = 2 * N + 1;
  if (crossfade) {
    prevN2 = 2 * prevN + 1;
    xfade_slope = this._slopeFactor;
    xfade = 0;
    for (i = 0; i < inNumSamples; ++i) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[i] = 1;
        } else {
          rphase = phase * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          out[i] = n1 + xfade * (n2 - n1);
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        out[i] = n1 + xfade * (n2 - n1);
      }
      phase += freq;
      xfade += xfade_slope;
    }
  } else {
    for (i = 0; i < inNumSamples; ++i) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[i] = 1;
        } else {
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          out[i] = (numer / denom - 1) * scale;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        out[i] = (numer * denom - 1) * scale;
      }
      phase += freq;
    }
  }
  if (phase >= 65536) {
    phase -= 65536;
  }
  this._phase = phase;
  this._freq = this.inputs[0][0];
  this._numharm = numharm;
};
SCUnitRepository.registerSCUnitClass("Blip", SCUnitBlip);
module.exports = SCUnitBlip;
},{"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],26:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBrownNoise = function (_SCUnit) {
  _inherits(SCUnitBrownNoise, _SCUnit);

  function SCUnitBrownNoise() {
    _classCallCheck(this, SCUnitBrownNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBrownNoise).apply(this, arguments));
  }

  _createClass(SCUnitBrownNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._level = Math.random() * 2 - 1;
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitBrownNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var z = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    z += Math.random() * 0.25 - 0.125;
    if (z > 1) {
      z = 2 - z;
    } else if (z < -1) {
      z = -2 - z;
    }
    out[i] = z;
  }
  this._level = z;
};
SCUnitRepository.registerSCUnitClass("BrownNoise", SCUnitBrownNoise);
module.exports = SCUnitBrownNoise;
},{"../SCUnit":12,"../SCUnitRepository":13}],27:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitClip = function (_SCUnit) {
  _inherits(SCUnitClip, _SCUnit);

  function SCUnitClip() {
    _classCallCheck(this, SCUnitClip);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitClip).apply(this, arguments));
  }

  _createClass(SCUnitClip, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_kk"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._lo = this.inputs[1][0];
      this._hi = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitClip;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = Math.max(loIn[i], Math.min(inIn[i], hiIn[i]));
  }
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_lo = this.inputs[1][0];
  var next_hi = this.inputs[2][0];
  var lo = this._lo;
  var hi = this._hi;
  if (next_lo === lo && next_hi === hi) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = Math.max(lo, Math.min(inIn[i], hi));
    }
  } else {
    var lo_slope = (next_lo - lo) * this._slopeFactor;
    var hi_slope = (next_hi - hi) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = Math.max(lo + lo_slope * _i, Math.min(inIn[_i], hi + hi_slope * _i));
    }
    this._lo = next_lo;
    this._hi = next_hi;
  }
};
SCUnitRepository.registerSCUnitClass("Clip", SCUnitClip);
module.exports = SCUnitClip;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],28:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitClipNoise = function (_SCUnit) {
  _inherits(SCUnitClipNoise, _SCUnit);

  function SCUnitClipNoise() {
    _classCallCheck(this, SCUnitClipNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitClipNoise).apply(this, arguments));
  }

  _createClass(SCUnitClipNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitClipNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = Math.random() < 0.5 ? -1 : +1;
  }
};
SCUnitRepository.registerSCUnitClass("ClipNoise", SCUnitClipNoise);
module.exports = SCUnitClipNoise;
},{"../SCUnit":12,"../SCUnitRepository":13}],29:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitCoinGate = function (_SCUnit) {
  _inherits(SCUnitCoinGate, _SCUnit);

  function SCUnitCoinGate() {
    _classCallCheck(this, SCUnitCoinGate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCoinGate).apply(this, arguments));
  }

  _createClass(SCUnitCoinGate, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._trig = this.inputs[1][0];
    }
  }]);

  return SCUnitCoinGate;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[1];
  var prob = this.inputs[0][0];
  var prevTrig = this._trig;
  for (var i = 0; i < inNumSamples; i++) {
    var curTrig = trigIn[i];
    var level = 0;
    if (prevTrig <= 0 && curTrig > 0) {
      if (Math.random() < prob) {
        level = curTrig;
      }
    }
    prevTrig = curTrig;
    out[i] = level;
  }
  this._trig = prevTrig;
};
dspProcess["next_k"] = function () {
  var trig = this.inputs[1][0];
  var level = 0;
  if (trig > 0 && this._trig <= 0) {
    if (Math.random() < this.inputs[0][0]) {
      level = trig;
    }
  }
  this.outputs[0][0] = level;
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("CoinGate", SCUnitCoinGate);
module.exports = SCUnitCoinGate;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],30:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var cubicinterp = require("../util/cubicinterp");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitCombC = function (_SCUnit) {
  _inherits(SCUnitCombC, _SCUnit);

  function SCUnitCombC() {
    _classCallCheck(this, SCUnitCombC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCombC).apply(this, arguments));
  }

  _createClass(SCUnitCombC, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitCombC;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var frac = dsamp - (dsamp | 0);
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d0 = dlybuf[irdphase + 1 & mask];
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var d3 = dlybuf[irdphase - 2 & mask];
        var value = cubicinterp(frac, d0, d1, d2, d3) || 0;
        dlybuf[iwrphase & mask] = inIn[i] + feedbk * value || 0;
        out[i] = value;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase + 1 & mask];
        var _d2 = dlybuf[irdphase & mask];
        var _d3 = dlybuf[irdphase - 1 & mask];
        var _d4 = dlybuf[irdphase - 2 & mask];
        var _value = cubicinterp(frac, _d, _d2, _d3, _d4) || 0;
        dlybuf[iwrphase & mask] = inIn[_i] + feedbk * _value || 0;
        out[_i] = _value;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _d5 = dlybuf[irdphase + 1 & mask];
      var _d6 = dlybuf[irdphase & mask];
      var _d7 = dlybuf[irdphase - 1 & mask];
      var _d8 = dlybuf[irdphase - 2 & mask];
      var _value2 = cubicinterp(frac, _d5, _d6, _d7, _d8) || 0;
      dlybuf[iwrphase & mask] = inIn[_i2] + feedbk * _value2 || 0;
      out[_i2] = _value2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("CombC", SCUnitCombC);
module.exports = SCUnitCombC;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/cubicinterp":172,"../util/toPowerOfTwo":176,"./_delay":167}],31:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitCombL = function (_SCUnit) {
  _inherits(SCUnitCombL, _SCUnit);

  function SCUnitCombL() {
    _classCallCheck(this, SCUnitCombL);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCombL).apply(this, arguments));
  }

  _createClass(SCUnitCombL, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitCombL;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var frac = dsamp - (dsamp | 0);
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var value = d1 + frac * (d2 - d1) || 0;
        dlybuf[iwrphase & mask] = inIn[i] + feedbk * value || 0;
        out[i] = value;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase & mask];
        var _d2 = dlybuf[irdphase - 1 & mask];
        var _value = _d + frac * (_d2 - _d) || 0;
        dlybuf[iwrphase & mask] = inIn[_i] + feedbk * _value || 0;
        out[_i] = _value;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _d3 = dlybuf[irdphase & mask];
      var _d4 = dlybuf[irdphase - 1 & mask];
      var _value2 = _d3 + frac * (_d4 - _d3) || 0;
      dlybuf[iwrphase & mask] = inIn[_i2] + feedbk * _value2 || 0;
      out[_i2] = _value2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("CombL", SCUnitCombL);
module.exports = SCUnitCombL;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/toPowerOfTwo":176,"./_delay":167}],32:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitCombN = function (_SCUnit) {
  _inherits(SCUnitCombN, _SCUnit);

  function SCUnitCombN() {
    _classCallCheck(this, SCUnitCombN);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCombN).apply(this, arguments));
  }

  _createClass(SCUnitCombN, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitCombN;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var value = dlybuf[irdphase & mask] || 0;
        dlybuf[iwrphase & mask] = inIn[i] + feedbk * value || 0;
        out[i] = value;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _value = dlybuf[irdphase & mask] || 0;
        dlybuf[iwrphase & mask] = inIn[_i] + feedbk * _value || 0;
        out[_i] = _value;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _value2 = dlybuf[irdphase & mask] || 0;
      dlybuf[iwrphase & mask] = inIn[_i2] + feedbk * _value2 || 0;
      out[_i2] = _value2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("CombN", SCUnitCombN);
module.exports = SCUnitCombN;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/toPowerOfTwo":176,"./_delay":167}],33:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitControl = function (_SCUnit) {
  _inherits(SCUnitControl, _SCUnit);

  function SCUnitControl() {
    _classCallCheck(this, SCUnitControl);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitControl).apply(this, arguments));
  }

  _createClass(SCUnitControl, [{
    key: "initialize",
    value: function initialize() {
      if (this.outputs.length === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      this._controls = this.synth.params;
      this.dspProcess(1);
    }
  }]);

  return SCUnitControl;
}(SCUnit);

dspProcess["1"] = function () {
  this.outputs[0][0] = this._controls[this.specialIndex];
};
dspProcess["k"] = function () {
  var controls = this._controls;
  var outputs = this.outputs;
  var numerOfOutputs = outputs.length;
  var specialIndex = this.specialIndex;
  for (var i = 0; i < numerOfOutputs; i++) {
    outputs[i][0] = controls[specialIndex + i];
  }
};
SCUnitRepository.registerSCUnitClass("Control", SCUnitControl);
module.exports = SCUnitControl;
},{"../SCUnit":12,"../SCUnitRepository":13}],34:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitControlDur = function (_SCUnit) {
  _inherits(SCUnitControlDur, _SCUnit);

  function SCUnitControlDur() {
    _classCallCheck(this, SCUnitControlDur);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitControlDur).apply(this, arguments));
  }

  _createClass(SCUnitControlDur, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.kRate.sampleDur;
    }
  }]);

  return SCUnitControlDur;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("ControlDur", SCUnitControlDur);
module.exports = SCUnitControlDur;
},{"../SCUnit":12,"../SCUnitRepository":13}],35:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitControlRate = function (_SCUnit) {
  _inherits(SCUnitControlRate, _SCUnit);

  function SCUnitControlRate() {
    _classCallCheck(this, SCUnitControlRate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitControlRate).apply(this, arguments));
  }

  _createClass(SCUnitControlRate, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.kRate.sampleRate;
    }
  }]);

  return SCUnitControlRate;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("ControlRate", SCUnitControlRate);
module.exports = SCUnitControlRate;
},{"../SCUnit":12,"../SCUnitRepository":13}],36:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitCrackle = function (_SCUnit) {
  _inherits(SCUnitCrackle, _SCUnit);

  function SCUnitCrackle() {
    _classCallCheck(this, SCUnitCrackle);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCrackle).apply(this, arguments));
  }

  _createClass(SCUnitCrackle, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._y1 = Math.random();
      this._y2 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitCrackle;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var paramf = this.inputs[0][0];
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = Math.abs(y1 * paramf - y2 - 0.05) || 0;
    out[i] = y0;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("Crackle", SCUnitCrackle);
module.exports = SCUnitCrackle;
},{"../SCUnit":12,"../SCUnitRepository":13}],37:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitDC = function (_SCUnit) {
  _inherits(SCUnitDC, _SCUnit);

  function SCUnitDC() {
    _classCallCheck(this, SCUnitDC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDC).apply(this, arguments));
  }

  _createClass(SCUnitDC, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0].fill(this.inputs[0][0]);
    }
  }]);

  return SCUnitDC;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("DC", SCUnitDC);
module.exports = SCUnitDC;
},{"../SCUnit":12,"../SCUnitRepository":13}],38:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitDecay = function (_SCUnit) {
  _inherits(SCUnitDecay, _SCUnit);

  function SCUnitDecay() {
    _classCallCheck(this, SCUnitDecay);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDecay).apply(this, arguments));
  }

  _createClass(SCUnitDecay, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._decayTime = NaN;
      this._b1 = 0;
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDecay;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var decayTime = this.inputs[1][0];
  var b1 = this._b1;
  var y1 = this._y1;
  if (decayTime === this._decayTime) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = y1 = inIn[i] + b1 * y1;
    }
  } else {
    var next_b1 = decayTime !== 0 ? Math.exp(log001 / (decayTime * this._sampleRate)) : 0;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = y1 = inIn[_i] + (b1 + b1_slope * _i) * y1;
    }
    this._b1 = next_b1;
    this._decayTime = decayTime;
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("Decay", SCUnitDecay);
module.exports = SCUnitDecay;
},{"../SCUnit":12,"../SCUnitRepository":13}],39:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitDecay2 = function (_SCUnit) {
  _inherits(SCUnitDecay2, _SCUnit);

  function SCUnitDecay2() {
    _classCallCheck(this, SCUnitDecay2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDecay2).apply(this, arguments));
  }

  _createClass(SCUnitDecay2, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._attackTime = NaN;
      this._decayTime = NaN;
      this._b1a = 0;
      this._b1b = 0;
      this._y1a = 0;
      this._y1b = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDecay2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var attackTime = this.inputs[1][0];
  var decayTime = this.inputs[2][0];
  var b1a = this._b1a;
  var b1b = this._b1b;
  var y1a = this._y1a;
  var y1b = this._y1b;
  if (attackTime === this._attackTime && decayTime === this._decayTime) {
    for (var i = 0; i < inNumSamples; i++) {
      y1a = inIn[i] + b1a * y1a;
      y1b = inIn[i] + b1b * y1b;
      out[i] = y1a - y1b;
    }
  } else {
    var next_b1a = decayTime !== 0 ? Math.exp(log001 / (decayTime * this._sampleRate)) : 0;
    var next_b1b = attackTime !== 0 ? Math.exp(log001 / (attackTime * this._sampleRate)) : 0;
    var b1a_slope = (next_b1a - b1a) * this._slopeFactor;
    var b1b_slope = (next_b1b - b1b) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      y1a = inIn[_i] + (b1a + b1a_slope * _i) * y1a;
      y1b = inIn[_i] + (b1b + b1b_slope * _i) * y1b;
      out[_i] = y1a - y1b;
    }
    this._b1a = next_b1a;
    this._b1b = next_b1b;
    this._decayTime = decayTime;
    this._attackTime = attackTime;
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
SCUnitRepository.registerSCUnitClass("Decay2", SCUnitDecay2);
module.exports = SCUnitDecay2;
},{"../SCUnit":12,"../SCUnitRepository":13}],40:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDelay1 = function (_SCUnit) {
  _inherits(SCUnitDelay1, _SCUnit);

  function SCUnitDelay1() {
    _classCallCheck(this, SCUnitDelay1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelay1).apply(this, arguments));
  }

  _createClass(SCUnitDelay1, [{
    key: "initialize",
    value: function initialize() {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._x1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDelay1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = x1;
    x1 = inIn[i];
  }
  this._x1 = x1;
};
dspProcess["next_1"] = function () {
  this.outputs[0][0] = this._x1;
  this._x1 = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("Delay1", SCUnitDelay1);
module.exports = SCUnitDelay1;
},{"../SCUnit":12,"../SCUnitRepository":13}],41:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDelay2 = function (_SCUnit) {
  _inherits(SCUnitDelay2, _SCUnit);

  function SCUnitDelay2() {
    _classCallCheck(this, SCUnitDelay2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelay2).apply(this, arguments));
  }

  _createClass(SCUnitDelay2, [{
    key: "initialize",
    value: function initialize() {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._x1 = 0;
      this._x2 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDelay2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = x1;
    x1 = x2;
    x2 = inIn[i];
  }
  this._x1 = x1;
  this._x2 = x2;
};
dspProcess["next_1"] = function () {
  this.outputs[0][0] = this._x1;
  this._x1 = this._x2;
  this._x2 = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("Delay2", SCUnitDelay2);
module.exports = SCUnitDelay2;
},{"../SCUnit":12,"../SCUnitRepository":13}],42:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var cubicinterp = require("../util/cubicinterp");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitDelayC = function (_SCUnit) {
  _inherits(SCUnitDelayC, _SCUnit);

  function SCUnitDelayC() {
    _classCallCheck(this, SCUnitDelayC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelayC).apply(this, arguments));
  }

  _createClass(SCUnitDelayC, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["k"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._fdelaylen = this._fdelaylen;
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this, this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._numoutput = 0;
      this._iwrphase = 0;
    }
  }]);

  return SCUnitDelayC;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var mask = this._mask;
  var dlybuf = this._dlybuf;
  var iwrphase = this._iwrphase;
  var dsamp = this._dsamp;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    for (var i = 0; i < inNumSamples; i++) {
      dlybuf[iwrphase & mask] = inIn[i];
      var irdphase = iwrphase - (dsamp | 0);
      var d0 = dlybuf[irdphase + 1 & mask];
      var d1 = dlybuf[irdphase & mask];
      var d2 = dlybuf[irdphase - 1 & mask];
      var d3 = dlybuf[irdphase - 2 & mask];
      out[i] = cubicinterp(frac, d0, d1, d2, d3);
      iwrphase += 1;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      dlybuf[iwrphase & mask] = inIn[_i];
      dsamp += dsampSlope;
      var _frac = dsamp - (dsamp | 0);
      var _irdphase = iwrphase - (dsamp | 0);
      var _d = dlybuf[_irdphase + 1 & mask];
      var _d2 = dlybuf[_irdphase & mask];
      var _d3 = dlybuf[_irdphase - 1 & mask];
      var _d4 = dlybuf[_irdphase - 2 & mask];
      out[_i] = cubicinterp(_frac, _d, _d2, _d3, _d4);
      iwrphase += 1;
    }
    this._dsamp = nextDsamp;
    this._delaytime = delaytime;
  }
  if (iwrphase > dlybuf.length) {
    iwrphase -= dlybuf.length;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("DelayC", SCUnitDelayC);
module.exports = SCUnitDelayC;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/cubicinterp":172,"../util/toPowerOfTwo":176}],43:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitDelayL = function (_SCUnit) {
  _inherits(SCUnitDelayL, _SCUnit);

  function SCUnitDelayL() {
    _classCallCheck(this, SCUnitDelayL);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelayL).apply(this, arguments));
  }

  _createClass(SCUnitDelayL, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["k"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._fdelaylen = this._fdelaylen;
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this, this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._numoutput = 0;
      this._iwrphase = 0;
    }
  }]);

  return SCUnitDelayL;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var mask = this._mask;
  var dlybuf = this._dlybuf;
  var iwrphase = this._iwrphase;
  var dsamp = this._dsamp;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    for (var i = 0; i < inNumSamples; i++) {
      dlybuf[iwrphase & mask] = inIn[i];
      var irdphase = iwrphase - (dsamp | 0);
      var d1 = dlybuf[irdphase & mask];
      var d2 = dlybuf[irdphase - 1 & mask];
      out[i] = d1 + frac * (d2 - d1);
      iwrphase += 1;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      dlybuf[iwrphase & mask] = inIn[_i];
      dsamp += dsampSlope;
      var _frac = dsamp - (dsamp | 0);
      var _irdphase = iwrphase - (dsamp | 0);
      var _d = dlybuf[_irdphase & mask];
      var _d2 = dlybuf[_irdphase - 1 & mask];
      out[_i] = _d + _frac * (_d2 - _d);
      iwrphase += 1;
    }
    this._dsamp = nextDsamp;
    this._delaytime = delaytime;
  }
  if (iwrphase > dlybuf.length) {
    iwrphase -= dlybuf.length;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("DelayL", SCUnitDelayL);
module.exports = SCUnitDelayL;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/toPowerOfTwo":176}],44:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitDelayN = function (_SCUnit) {
  _inherits(SCUnitDelayN, _SCUnit);

  function SCUnitDelayN() {
    _classCallCheck(this, SCUnitDelayN);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelayN).apply(this, arguments));
  }

  _createClass(SCUnitDelayN, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["k"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._fdelaylen = this._fdelaylen;
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this, this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._numoutput = 0;
      this._iwrphase = 0;
    }
  }]);

  return SCUnitDelayN;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var mask = this._mask;
  var dlybuf = this._dlybuf;
  var iwrphase = this._iwrphase;
  var dsamp = this._dsamp;
  if (delaytime === this._delaytime) {
    for (var i = 0; i < inNumSamples; i++) {
      dlybuf[iwrphase & mask] = inIn[i];
      var irdphase = iwrphase - (dsamp | 0);
      out[i] = dlybuf[irdphase & mask];
      iwrphase += 1;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      dlybuf[iwrphase & mask] = inIn[_i];
      dsamp += dsampSlope;
      var _irdphase = iwrphase - (dsamp | 0);
      out[_i] = dlybuf[_irdphase & mask];
      iwrphase += 1;
    }
    this._dsamp = nextDsamp;
    this._delaytime = delaytime;
  }
  if (iwrphase > dlybuf.length) {
    iwrphase -= dlybuf.length;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("DelayN", SCUnitDelayN);
module.exports = SCUnitDelayN;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/clamp":171,"../util/toPowerOfTwo":176}],45:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDetectSilence = function (_SCUnit) {
  _inherits(SCUnitDetectSilence, _SCUnit);

  function SCUnitDetectSilence() {
    _classCallCheck(this, SCUnitDetectSilence);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDetectSilence).apply(this, arguments));
  }

  _createClass(SCUnitDetectSilence, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._thresh = this.inputs[1][0];
      this._endCounter = rate.sampleRate * this.inputs[2][0] | 0;
      this._counter = -1;
    }
  }]);

  return SCUnitDetectSilence;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var thresh = this._thresh;
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    var val = Math.abs(inIn[i]);
    if (val > thresh) {
      counter = 0;
      out[i] = 0;
    } else if (counter >= 0) {
      counter += 1;
      if (counter >= this._endCounter) {
        this.doneAction(this.inputs[3][0] | 0);
        out[i] = 1;
      } else {
        out[i] = 0;
      }
    } else {
      out[i] = 0;
    }
  }
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("DetectSilence", SCUnitDetectSilence);
module.exports = SCUnitDetectSilence;
},{"../SCUnit":12,"../SCUnitRepository":13}],46:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDust = function (_SCUnit) {
  _inherits(SCUnitDust, _SCUnit);

  function SCUnitDust() {
    _classCallCheck(this, SCUnitDust);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDust).apply(this, arguments));
  }

  _createClass(SCUnitDust, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._density = 0;
      this._scale = 0;
      this._thresh = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDust;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var density = this.inputs[0][0];
  if (density !== this._density) {
    this._thresh = density * this._sampleDur;
    this._scale = this._thresh > 0 ? 1 / this._thresh : 0;
    this._density = density;
  }
  var thresh = this._thresh;
  var scale = this._scale;
  for (var i = 0; i < inNumSamples; i++) {
    var z = Math.random();
    out[i] = z < thresh ? z * scale : 0;
  }
};
SCUnitRepository.registerSCUnitClass("Dust", SCUnitDust);
module.exports = SCUnitDust;
},{"../SCUnit":12,"../SCUnitRepository":13}],47:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDust2 = function (_SCUnit) {
  _inherits(SCUnitDust2, _SCUnit);

  function SCUnitDust2() {
    _classCallCheck(this, SCUnitDust2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDust2).apply(this, arguments));
  }

  _createClass(SCUnitDust2, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._density = 0;
      this._scale = 0;
      this._thresh = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDust2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var density = this.inputs[0][0];
  if (density !== this._density) {
    this._thresh = density * this._sampleDur;
    this._scale = this._thresh > 0 ? 2 / this._thresh : 0;
    this._density = density;
  }
  var thresh = this._thresh;
  var scale = this._scale;
  for (var i = 0; i < inNumSamples; i++) {
    var z = Math.random();
    out[i] = z < thresh ? z * scale - 1 : 0;
  }
};
SCUnitRepository.registerSCUnitClass("Dust2", SCUnitDust2);
module.exports = SCUnitDust2;
},{"../SCUnit":12,"../SCUnitRepository":13}],48:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var kEnvGen_gate = 0;
var kEnvGen_levelScale = 1;
var kEnvGen_levelBias = 2;
var kEnvGen_timeScale = 3;
var kEnvGen_doneAction = 4;
var kEnvGen_initLevel = 5;
var kEnvGen_numStages = 6;
var kEnvGen_releaseNode = 7;
var kEnvGen_loopNode = 8;
var kEnvGen_nodeOffset = 9;
var shape_Step = 0;
var shape_Linear = 1;
var shape_Exponential = 2;
var shape_Sine = 3;
var shape_Welch = 4;
var shape_Curve = 5;
var shape_Squared = 6;
var shape_Cubed = 7;
var shape_Sustain = 9999;

var SCUnitEnvGen = function (_SCUnit) {
  _inherits(SCUnitEnvGen, _SCUnit);

  function SCUnitEnvGen() {
    _classCallCheck(this, SCUnitEnvGen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitEnvGen).apply(this, arguments));
  }

  _createClass(SCUnitEnvGen, [{
    key: "initialize",
    value: function initialize(rate) {
      this.rate = rate;
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_ak"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._level = this.inputs[kEnvGen_initLevel][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
      this._endLevel = this._level;
      this._counter = 0;
      this._stage = 1000000000;
      this._prevGate = 0;
      this._released = false;
      this._releaseNode = this.inputs[kEnvGen_releaseNode][0] | 0;
      this._a1 = 0;
      this._a2 = 0;
      this._b1 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._grow = 0;
      this._shape = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitEnvGen;
}(SCUnit);

dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var gate = this.inputs[kEnvGen_gate][0];
  var counter = this._counter;
  var level = this._level;
  var prevGate = this._prevGate;
  var numstages = void 0,
      doneAction = void 0,
      loopNode = void 0;
  var envPtr = void 0,
      stageOffset = void 0,
      endLevel = void 0,
      dur = void 0,
      shape = void 0,
      curve = void 0;
  var w = void 0,
      a1 = void 0,
      a2 = void 0,
      b1 = void 0,
      y0 = void 0,
      y1 = void 0,
      y2 = void 0,
      grow = void 0;
  var i = void 0,
      j = 0;
  var counterOffset = 0;
  if (prevGate <= 0 && gate > 0) {
    this._stage = -1;
    this._released = false;
    this.done = false;
    counter = counterOffset;
  } else if (gate <= -1 && prevGate > -1 && !this._released) {
    numstages = this.inputs[kEnvGen_numStages][0] | 0;
    dur = -gate - 1;
    counter = Math.max(1, dur * this.rate.sampleRate | 0) + counterOffset;
    this._stage = numstages;
    this._shape = shape_Linear;
    this._endLevel = this.inputs[this.numInputs - 4][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
    this._grow = (this._endLevel - level) / counter;
    this._released = true;
  } else if (prevGate > 0 && gate <= 0 && this._releaseNode >= 0 && !this._released) {
    counter = counterOffset;
    this._stage = this._releaseNode - 1;
    this._released = true;
  }
  this._prevGate = gate;
  var remain = inNumSamples;
  while (remain) {
    var initSegment = false;
    if (counter === 0) {
      numstages = this.inputs[kEnvGen_numStages][0] | 0;
      if (this._stage + 1 >= numstages) {
        counter = Infinity;
        this._shape = 0;
        level = this._endLevel;
        this.done = true;
        doneAction = this.inputs[kEnvGen_doneAction][0] | 0;
        this.doneAction(doneAction);
      } else if (this._stage + 1 === this._releaseNode && !this._released) {
        loopNode = this.inputs[kEnvGen_loopNode][0] | 0;
        if (loopNode >= 0 && loopNode < numstages) {
          this._stage = loopNode;
          initSegment = true;
        } else {
          counter = Infinity;
          this._shape = shape_Sustain;
          level = this._endLevel;
        }
      } else {
        this._stage += 1;
        initSegment = true;
      }
    }
    if (initSegment) {
      stageOffset = (this._stage << 2) + kEnvGen_nodeOffset;
      if (stageOffset + 4 > this.numInputs) {
        return;
      }
      envPtr = this.inputs;
      endLevel = envPtr[0 + stageOffset][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
      dur = envPtr[1 + stageOffset][0] * this.inputs[kEnvGen_timeScale][0];
      shape = envPtr[2 + stageOffset][0] | 0;
      curve = envPtr[3 + stageOffset][0];
      this._endLevel = endLevel;
      this._shape = shape;
      counter = Math.max(1, dur * this.rate.sampleRate | 0);
      if (counter === 1) {
        this._shape = shape_Linear;
      }
      switch (this._shape) {
        case shape_Step:
          level = endLevel;
          break;
        case shape_Linear:
          this._grow = (endLevel - level) / counter;
          break;
        case shape_Exponential:
          if (Math.abs(level) < 0.000001) {
            level = 0.000001;
          }
          this._grow = Math.pow(endLevel / level, 1 / counter);
          break;
        case shape_Sine:
          w = Math.PI / counter;
          this._a2 = (endLevel + level) * 0.5;
          this._b1 = 2 * Math.cos(w);
          this._y1 = (endLevel - level) * 0.5;
          this._y2 = this._y1 * Math.sin(Math.PI * 0.5 - w);
          level = this._a2 - this._y1;
          break;
        case shape_Welch:
          w = Math.PI * 0.5 / counter;
          this._b1 = 2 * Math.cos(w);
          if (endLevel >= level) {
            this._a2 = level;
            this._y1 = 0;
            this._y2 = -Math.sin(w) * (endLevel - level);
          } else {
            this._a2 = endLevel;
            this._y1 = level - endLevel;
            this._y2 = Math.cos(w) * (level - endLevel);
          }
          level = this._a2 + this._y1;
          break;
        case shape_Curve:
          if (Math.abs(curve) < 0.001) {
            this._shape = shape_Linear;
            this._grow = (endLevel - level) / counter;
          } else {
            a1 = (endLevel - level) / (1 - Math.exp(curve));
            this._a2 = level + a1;
            this._b1 = a1;
            this._grow = Math.exp(curve / counter);
          }
          break;
        case shape_Squared:
          this._y1 = Math.sqrt(level);
          this._y2 = Math.sqrt(endLevel);
          this._grow = (this._y2 - this._y1) / counter;
          break;
        case shape_Cubed:
          this._y1 = Math.pow(level, 0.33333333);
          this._y2 = Math.pow(endLevel, 0.33333333);
          this._grow = (this._y2 - this._y1) / counter;
          break;
      }
    }
    var nsmps = Math.min(remain, counter);
    grow = this._grow;
    a2 = this._a2;
    b1 = this._b1;
    y1 = this._y1;
    y2 = this._y2;
    switch (this._shape) {
      case shape_Step:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
        }
        break;
      case shape_Linear:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          level += grow;
        }
        break;
      case shape_Exponential:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          level *= grow;
        }
        break;
      case shape_Sine:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y0 = b1 * y1 - y2;
          level = a2 - y0;
          y2 = y1;
          y1 = y0;
        }
        break;
      case shape_Welch:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y0 = b1 * y1 - y2;
          level = a2 + y0;
          y2 = y1;
          y1 = y0;
        }
        break;
      case shape_Curve:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          b1 *= grow;
          level = a2 - b1;
        }
        break;
      case shape_Squared:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y1 += grow;
          level = y1 * y1;
        }
        break;
      case shape_Cubed:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y1 += grow;
          level = y1 * y1 * y1;
        }
        break;
      case shape_Sustain:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
        }
        break;
    }
    remain -= nsmps;
    counter -= nsmps;
  }
  this._level = level;
  this._counter = counter;
  this._a2 = a2;
  this._b1 = b1;
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var gate = this.inputs[kEnvGen_gate][0];
  var counter = this._counter;
  var level = this._level;
  var prevGate = this._prevGate;
  var numstages = void 0,
      doneAction = void 0,
      loopNode = void 0;
  var envPtr = void 0,
      stageOffset = void 0,
      endLevel = void 0,
      dur = void 0,
      shape = void 0,
      curve = void 0;
  var w = void 0,
      a1 = void 0,
      a2 = void 0,
      b1 = void 0,
      y0 = void 0,
      y1 = void 0,
      y2 = void 0,
      grow = void 0;
  var counterOffset = 0;
  if (prevGate <= 0 && gate > 0) {
    this._stage = -1;
    this._released = false;
    this.done = false;
    counter = counterOffset;
  } else if (gate <= -1 && prevGate > -1 && !this._released) {
    numstages = this.inputs[kEnvGen_numStages][0] | 0;
    dur = -gate - 1;
    counter = Math.max(1, dur * this.rate.sampleRate | 0) + counterOffset;
    this._stage = numstages;
    this._shape = shape_Linear;
    this._endLevel = this.inputs[this.numInputs - 4][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
    this._grow = (this._endLevel - level) / counter;
    this._released = true;
  } else if (prevGate > 0 && gate <= 0 && this._releaseNode >= 0 && !this._released) {
    counter = counterOffset;
    this._stage = this._releaseNode - 1;
    this._released = true;
  }
  this._prevGate = gate;
  var initSegment = false;
  if (counter <= 0) {
    numstages = this.inputs[kEnvGen_numStages][0] | 0;
    if (this._stage + 1 >= numstages) {
      counter = Infinity;
      this._shape = 0;
      level = this._endLevel;
      this.done = true;
      doneAction = this.inputs[kEnvGen_doneAction][0] | 0;
      this.doneAction(doneAction);
    } else if (this._stage + 1 === this._releaseNode && !this._released) {
      loopNode = this.inputs[kEnvGen_loopNode][0] | 0;
      if (loopNode >= 0 && loopNode < numstages) {
        this._stage = loopNode;
        initSegment = true;
      } else {
        counter = Infinity;
        this._shape = shape_Sustain;
        level = this._endLevel;
      }
    } else {
      this._stage += 1;
      initSegment = true;
    }
  }
  if (initSegment) {
    stageOffset = (this._stage << 2) + kEnvGen_nodeOffset;
    if (stageOffset + 4 > this.numInputs) {
      return;
    }
    envPtr = this.inputs;
    endLevel = envPtr[0 + stageOffset][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
    dur = envPtr[1 + stageOffset][0] * this.inputs[kEnvGen_timeScale][0];
    shape = envPtr[2 + stageOffset][0] | 0;
    curve = envPtr[3 + stageOffset][0];
    this._endLevel = endLevel;
    this._shape = shape;
    counter = Math.max(1, dur * this.rate.sampleRate | 0);
    if (counter === 1) {
      this._shape = shape_Linear;
    }
    switch (this._shape) {
      case shape_Step:
        level = endLevel;
        break;
      case shape_Linear:
        this._grow = (endLevel - level) / counter;
        break;
      case shape_Exponential:
        if (Math.abs(level) < 0.000001) {
          level = 0.000001;
        }
        this._grow = Math.pow(endLevel / level, 1 / counter);
        break;
      case shape_Sine:
        w = Math.PI / counter;
        this._a2 = (endLevel + level) * 0.5;
        this._b1 = 2 * Math.cos(w);
        this._y1 = (endLevel - level) * 0.5;
        this._y2 = this._y1 * Math.sin(Math.PI * 0.5 - w);
        level = this._a2 - this._y1;
        break;
      case shape_Welch:
        w = Math.PI * 0.5 / counter;
        this._b1 = 2 * Math.cos(w);
        if (endLevel >= level) {
          this._a2 = level;
          this._y1 = 0;
          this._y2 = -Math.sin(w) * (endLevel - level);
        } else {
          this._a2 = endLevel;
          this._y1 = level - endLevel;
          this._y2 = Math.cos(w) * (level - endLevel);
        }
        level = this._a2 + this._y1;
        break;
      case shape_Curve:
        if (Math.abs(curve) < 0.001) {
          this._shape = shape_Linear;
          this._grow = (endLevel - level) / counter;
        } else {
          a1 = (endLevel - level) / (1 - Math.exp(curve));
          this._a2 = level + a1;
          this._b1 = a1;
          this._grow = Math.exp(curve / counter);
        }
        break;
      case shape_Squared:
        this._y1 = Math.sqrt(level);
        this._y2 = Math.sqrt(endLevel);
        this._grow = (this._y2 - this._y1) / counter;
        break;
      case shape_Cubed:
        this._y1 = Math.pow(level, 0.33333333);
        this._y2 = Math.pow(endLevel, 0.33333333);
        this._grow = (this._y2 - this._y1) / counter;
        break;
    }
  }
  grow = this._grow;
  a2 = this._a2;
  b1 = this._b1;
  y1 = this._y1;
  y2 = this._y2;
  switch (this._shape) {
    case shape_Step:
      break;
    case shape_Linear:
      level += grow;
      break;
    case shape_Exponential:
      level *= grow;
      break;
    case shape_Sine:
      y0 = b1 * y1 - y2;
      level = a2 - y0;
      y2 = y1;
      y1 = y0;
      break;
    case shape_Welch:
      y0 = b1 * y1 - y2;
      level = a2 + y0;
      y2 = y1;
      y1 = y0;
      break;
    case shape_Curve:
      b1 *= grow;
      level = a2 - b1;
      break;
    case shape_Squared:
      y1 += grow;
      level = y1 * y1;
      break;
    case shape_Cubed:
      y1 += grow;
      level = y1 * y1 * y1;
      break;
    case shape_Sustain:
      break;
  }
  out[0] = level;
  this._level = level;
  this._counter = counter - 1;
  this._a2 = a2;
  this._b1 = b1;
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("EnvGen", SCUnitEnvGen);
module.exports = SCUnitEnvGen;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],49:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitExpRand = function (_SCUnit) {
  _inherits(SCUnitExpRand, _SCUnit);

  function SCUnitExpRand() {
    _classCallCheck(this, SCUnitExpRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitExpRand).apply(this, arguments));
  }

  _createClass(SCUnitExpRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0] || 0.01;
      var hi = this.inputs[1][0];
      var ratio = hi / lo;
      this.outputs[0][0] = Math.pow(ratio, Math.random()) * lo;
    }
  }]);

  return SCUnitExpRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("ExpRand", SCUnitExpRand);
module.exports = SCUnitExpRand;
},{"../SCUnit":12,"../SCUnitRepository":13}],50:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitFOS = function (_SCUnit) {
  _inherits(SCUnitFOS, _SCUnit);

  function SCUnitFOS() {
    _classCallCheck(this, SCUnitFOS);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFOS).apply(this, arguments));
  }

  _createClass(SCUnitFOS, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO && this.inputSpecs[3].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_a"];
        } else {
          this.dspProcess = dspProcess["next_k"];
        }
      }
      this._filterSlope = rate.filterSlope;
      this._y1 = 0;
      this._a0 = 0;
      this._a1 = 0;
      this._b1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitFOS;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var a0In = this.inputs[1];
  var a1In = this.inputs[2];
  var b1In = this.inputs[3];
  var y1 = this._y1;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + b1In[i] * y1;
    out[i] = a0In[i] * y0 + a1In[i] * y1 || 0;
    y1 = y0;
  }
  this._y1 = y1;
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var a0 = this.inputs[1][0];
  var a1 = this.inputs[2][0];
  var b1 = this.inputs[3][0];
  var y1 = this._y1;
  var y0 = _in + b1 * y1;
  this.outputs[0][0] = a0 * y0 + a1 * y1 || 0;
  this._y1 = y0;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_a0 = this.inputs[1][0];
  var next_a1 = this.inputs[2][0];
  var next_b1 = this.inputs[3][0];
  var a0 = this._a0;
  var a1 = this._a1;
  var b1 = this._b1;
  var a0_slope = (next_a0 - a0) * this._filterSlope;
  var a1_slope = (next_a1 - a1) * this._filterSlope;
  var b1_slope = (next_b1 - b1) * this._filterSlope;
  var y1 = this._y1;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + (b1 + b1_slope * i) * y1;
    out[i] = (a0 + a0_slope * i) * y0 + (a1 + a1_slope * i) * y1 || 0;
    y1 = y0;
  }
  this._y1 = y1;
  this._a0 = a0;
  this._a1 = a1;
  this._b1 = b1;
};
SCUnitRepository.registerSCUnitClass("FOS", SCUnitFOS);
module.exports = SCUnitFOS;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],51:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitFSinOsc = function (_SCUnit) {
  _inherits(SCUnitFSinOsc, _SCUnit);

  function SCUnitFSinOsc() {
    _classCallCheck(this, SCUnitFSinOsc);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFSinOsc).apply(this, arguments));
  }

  _createClass(SCUnitFSinOsc, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._freq = this.inputs[0][0];
      var iphase = this.inputs[1][0];
      var w = this._freq * this._radiansPerSample;
      this._b1 = 2 * Math.cos(w);
      this._y1 = Math.sin(iphase);
      this._y2 = Math.sin(iphase - w);
      this.outputs[0][0] = this._y1;
    }
  }]);

  return SCUnitFSinOsc;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  if (freq !== this._freq) {
    this._freq = freq;
    this._b1 = 2 * Math.cos(freq * this._radiansPerSample);
  }
  var b1 = this._b1;
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = b1 * y1 - y2;
    out[i] = y0;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("FSinOsc", SCUnitFSinOsc);
module.exports = SCUnitFSinOsc;
},{"../SCUnit":12,"../SCUnitRepository":13}],52:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fold = require("../util/fold");
var dspProcess = {};

var SCUnitFold = function (_SCUnit) {
  _inherits(SCUnitFold, _SCUnit);

  function SCUnitFold() {
    _classCallCheck(this, SCUnitFold);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFold).apply(this, arguments));
  }

  _createClass(SCUnitFold, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_kk"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._lo = this.inputs[1][0];
      this._hi = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitFold;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = fold(inIn[i], loIn[i], hiIn[i]);
  }
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_lo = this.inputs[1][0];
  var next_hi = this.inputs[2][0];
  var lo = this._lo;
  var hi = this._hi;
  if (next_lo === lo && next_hi === hi) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = fold(inIn[i], lo, hi);
    }
  } else {
    var lo_slope = (next_lo - lo) * this._slopeFactor;
    var hi_slope = (next_hi - hi) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = fold(inIn[_i], lo + lo_slope * _i, hi + hi_slope * _i);
    }
    this._lo = next_lo;
    this._hi = next_hi;
  }
};
SCUnitRepository.registerSCUnitClass("Fold", SCUnitFold);
module.exports = SCUnitFold;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"../util/fold":173}],53:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitFreeVerb = function (_SCUnit) {
  _inherits(SCUnitFreeVerb, _SCUnit);

  function SCUnitFreeVerb() {
    _classCallCheck(this, SCUnitFreeVerb);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFreeVerb).apply(this, arguments));
  }

  _createClass(SCUnitFreeVerb, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._iota0 = 0;
      this._iota1 = 0;
      this._iota2 = 0;
      this._iota3 = 0;
      this._iota4 = 0;
      this._iota5 = 0;
      this._iota6 = 0;
      this._iota7 = 0;
      this._iota8 = 0;
      this._iota9 = 0;
      this._iota10 = 0;
      this._iota11 = 0;
      this._R0_0 = 0;
      this._R1_0 = 0;
      this._R2_0 = 0;
      this._R3_0 = 0;
      this._R4_0 = 0;
      this._R5_0 = 0;
      this._R6_0 = 0;
      this._R7_0 = 0;
      this._R8_0 = 0;
      this._R9_0 = 0;
      this._R10_0 = 0;
      this._R11_0 = 0;
      this._R12_0 = 0;
      this._R13_0 = 0;
      this._R14_0 = 0;
      this._R15_0 = 0;
      this._R16_0 = 0;
      this._R17_0 = 0;
      this._R18_0 = 0;
      this._R19_0 = 0;
      this._R0_1 = 0;
      this._R1_1 = 0;
      this._R2_1 = 0;
      this._R3_1 = 0;
      this._dline0 = new Float32Array(225);
      this._dline1 = new Float32Array(341);
      this._dline2 = new Float32Array(441);
      this._dline3 = new Float32Array(556);
      this._dline4 = new Float32Array(1617);
      this._dline5 = new Float32Array(1557);
      this._dline6 = new Float32Array(1491);
      this._dline7 = new Float32Array(1422);
      this._dline8 = new Float32Array(1277);
      this._dline9 = new Float32Array(1116);
      this._dline10 = new Float32Array(1188);
      this._dline11 = new Float32Array(1356);
      this.dspProcess(1);
    }
  }]);

  return SCUnitFreeVerb;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var ftemp0 = Math.max(0, Math.min(this.inputs[1][0], 1));
  var ftemp1 = 1 - ftemp0;
  var room = Math.max(0, Math.min(this.inputs[2][0], 1));
  var ftemp5 = 0.7 + 0.28 * room;
  var damp = Math.max(0, Math.min(this.inputs[3][0], 1));
  var ftemp6 = 0.4 * damp;
  var ftemp7 = 1 - ftemp6;
  var dline0 = this._dline0;
  var dline1 = this._dline1;
  var dline2 = this._dline2;
  var dline3 = this._dline3;
  var dline4 = this._dline4;
  var dline5 = this._dline5;
  var dline6 = this._dline6;
  var dline7 = this._dline7;
  var dline8 = this._dline8;
  var dline9 = this._dline9;
  var dline10 = this._dline10;
  var dline11 = this._dline11;
  var iota0 = this._iota0;
  var iota1 = this._iota1;
  var iota2 = this._iota2;
  var iota3 = this._iota3;
  var iota4 = this._iota4;
  var iota5 = this._iota5;
  var iota6 = this._iota6;
  var iota7 = this._iota7;
  var iota8 = this._iota8;
  var iota9 = this._iota9;
  var iota10 = this._iota10;
  var iota11 = this._iota11;
  var R0_1 = this._R0_1;
  var R1_1 = this._R1_1;
  var R2_1 = this._R2_1;
  var R3_1 = this._R3_1;
  var R0_0 = this._R0_0;
  var R1_0 = this._R1_0;
  var R2_0 = this._R2_0;
  var R3_0 = this._R3_0;
  var R4_0 = this._R4_0;
  var R5_0 = this._R5_0;
  var R6_0 = this._R6_0;
  var R7_0 = this._R7_0;
  var R8_0 = this._R8_0;
  var R9_0 = this._R9_0;
  var R10_0 = this._R10_0;
  var R11_0 = this._R11_0;
  var R12_0 = this._R12_0;
  var R13_0 = this._R13_0;
  var R14_0 = this._R14_0;
  var R15_0 = this._R15_0;
  var R16_0 = this._R16_0;
  var R17_0 = this._R17_0;
  var R18_0 = this._R18_0;
  var R19_0 = this._R19_0;
  for (var i = 0; i < inNumSamples; i++) {
    var ftemp2 = inIn[i];
    var ftemp4 = 0.015 * ftemp2;
    iota0 = ++iota0 % 225;
    iota1 = ++iota1 % 341;
    iota2 = ++iota2 % 441;
    iota3 = ++iota3 % 556;
    iota4 = ++iota4 % 1617;
    iota5 = ++iota5 % 1557;
    iota6 = ++iota6 % 1491;
    iota7 = ++iota7 % 1422;
    iota8 = ++iota8 % 1277;
    iota9 = ++iota9 % 1116;
    iota10 = ++iota10 % 1188;
    iota11 = ++iota11 % 1356;
    var T0 = dline0[iota0];
    var T1 = dline1[iota1];
    var T2 = dline2[iota2];
    var T3 = dline3[iota3];
    var T4 = dline4[iota4];
    var T5 = dline5[iota5];
    var T6 = dline6[iota6];
    var T7 = dline7[iota7];
    var T8 = dline8[iota8];
    var T9 = dline9[iota9];
    var T10 = dline10[iota10];
    var T11 = dline11[iota11];
    R5_0 = ftemp7 * R4_0 + ftemp6 * R5_0;
    dline4[iota4] = ftemp4 + ftemp5 * R5_0;
    R4_0 = T4;
    R7_0 = ftemp7 * R6_0 + ftemp6 * R7_0;
    dline5[iota5] = ftemp4 + ftemp5 * R7_0;
    R6_0 = T5;
    R9_0 = ftemp7 * R8_0 + ftemp6 * R9_0;
    dline6[iota6] = ftemp4 + ftemp5 * R9_0;
    R8_0 = T6;
    R11_0 = ftemp7 * R10_0 + ftemp6 * R11_0;
    dline7[iota7] = ftemp4 + ftemp5 * R11_0;
    R10_0 = T7;
    R13_0 = ftemp7 * R12_0 + ftemp6 * R13_0;
    dline8[iota8] = ftemp4 + ftemp5 * R13_0;
    R12_0 = T8;
    R15_0 = ftemp7 * R14_0 + ftemp6 * R15_0;
    dline9[iota9] = ftemp4 + ftemp5 * R15_0;
    R14_0 = T9;
    R17_0 = ftemp7 * R16_0 + ftemp6 * R17_0;
    dline10[iota10] = ftemp4 + ftemp5 * R17_0;
    R16_0 = T10;
    R19_0 = ftemp7 * R18_0 + ftemp6 * R19_0;
    dline11[iota11] = ftemp4 + ftemp5 * R19_0;
    R18_0 = T11;
    var ftemp8 = R16_0 + R18_0;
    dline3[iota3] = 0.5 * R3_0 + R4_0 + (R6_0 + R8_0) + (R10_0 + R12_0 + (R14_0 + ftemp8));
    R3_0 = T3;
    R3_1 = R3_0 - (R4_0 + R6_0 + (R8_0 + R10_0) + (R12_0 + R14_0 + ftemp8));
    dline2[iota2] = 0.5 * R2_0 + R3_1;
    R2_0 = T2;
    R2_1 = R2_0 - R3_1;
    dline1[iota1] = 0.5 * R1_0 + R2_1;
    R1_0 = T1;
    R1_1 = R1_0 - R2_1;
    dline0[iota0] = 0.5 * R0_0 + R1_1;
    R0_0 = T0;
    R0_1 = R0_0 - R1_1;
    out[i] = ftemp1 * ftemp2 + ftemp0 * R0_1;
  }
  this._iota0 = iota0;
  this._iota1 = iota1;
  this._iota2 = iota2;
  this._iota3 = iota3;
  this._iota4 = iota4;
  this._iota5 = iota5;
  this._iota6 = iota6;
  this._iota7 = iota7;
  this._iota8 = iota8;
  this._iota9 = iota9;
  this._iota10 = iota10;
  this._iota11 = iota11;
  this._R0_1 = R0_1;
  this._R1_1 = R1_1;
  this._R2_1 = R2_1;
  this._R3_1 = R3_1;
  this._R0_0 = R0_0;
  this._R1_0 = R1_0;
  this._R2_0 = R2_0;
  this._R3_0 = R3_0;
  this._R4_0 = R4_0;
  this._R5_0 = R5_0;
  this._R6_0 = R6_0;
  this._R7_0 = R7_0;
  this._R8_0 = R8_0;
  this._R9_0 = R9_0;
  this._R10_0 = R10_0;
  this._R11_0 = R11_0;
  this._R12_0 = R12_0;
  this._R13_0 = R13_0;
  this._R14_0 = R14_0;
  this._R15_0 = R15_0;
  this._R16_0 = R16_0;
  this._R17_0 = R17_0;
  this._R18_0 = R18_0;
  this._R19_0 = R19_0;
};
SCUnitRepository.registerSCUnitClass("FreeVerb", SCUnitFreeVerb);
module.exports = SCUnitFreeVerb;
},{"../SCUnit":12,"../SCUnitRepository":13}],54:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitGate = function (_SCUnit) {
  _inherits(SCUnitGate, _SCUnit);

  function SCUnitGate() {
    _classCallCheck(this, SCUnitGate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitGate).apply(this, arguments));
  }

  _createClass(SCUnitGate, [{
    key: "initialize",
    value: function initialize() {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_ak"];
      }
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitGate;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curTrig = trigIn[i];
    if (curTrig > 0) {
      level = inIn[i];
    }
    out[i] = level;
  }
  this._level = level;
};
dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trig = this.inputs[1][0];
  if (trig > 0) {
    out.set(inIn.subarray(0, inNumSamples));
    this._level = inIn[inNumSamples - 1];
  } else {
    out.fill(this._level, 0, inNumSamples);
  }
};
SCUnitRepository.registerSCUnitClass("Gate", SCUnitGate);
module.exports = SCUnitGate;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],55:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitGrayNoise = function (_SCUnit) {
  _inherits(SCUnitGrayNoise, _SCUnit);

  function SCUnitGrayNoise() {
    _classCallCheck(this, SCUnitGrayNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitGrayNoise).apply(this, arguments));
  }

  _createClass(SCUnitGrayNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitGrayNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    counter ^= 1 << (Math.random() * 31 | 0);
    out[i] = counter * 4.65661287308e-10;
  }
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("GrayNoise", SCUnitGrayNoise);
module.exports = SCUnitGrayNoise;
},{"../SCUnit":12,"../SCUnitRepository":13}],56:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sqrt2 = Math.sqrt(2);

var SCUnitHPF = function (_SCUnit) {
  _inherits(SCUnitHPF, _SCUnit);

  function SCUnitHPF() {
    _classCallCheck(this, SCUnitHPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHPF).apply(this, arguments));
  }

  _createClass(SCUnitHPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitHPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq) {
    var pfreq = freq * this._radiansPerSample * 0.5;
    var C = Math.tan(pfreq);
    var C2 = C * C;
    var sqrt2C = C * sqrt2;
    var next_a0 = 1 / (1 + sqrt2C + C2);
    var next_b1 = 2 * (1 - C2) * next_a0;
    var next_b2 = -(1 - sqrt2C + C2) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 - 2 * y1 + y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - 2 * y1 + y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("HPF", SCUnitHPF);
module.exports = SCUnitHPF;
},{"../SCUnit":12,"../SCUnitRepository":13}],57:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitHPZ1 = function (_SCUnit) {
  _inherits(SCUnitHPZ1, _SCUnit);

  function SCUnitHPZ1() {
    _classCallCheck(this, SCUnitHPZ1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHPZ1).apply(this, arguments));
  }

  _createClass(SCUnitHPZ1, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitHPZ1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = 0.5 * (x0 - x1);
    x1 = x0;
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("HPZ1", SCUnitHPZ1);
module.exports = SCUnitHPZ1;
},{"../SCUnit":12,"../SCUnitRepository":13}],58:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitHPZ2 = function (_SCUnit) {
  _inherits(SCUnitHPZ2, _SCUnit);

  function SCUnitHPZ2() {
    _classCallCheck(this, SCUnitHPZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHPZ2).apply(this, arguments));
  }

  _createClass(SCUnitHPZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitHPZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 - 2 * x1 + x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("HPZ2", SCUnitHPZ2);
module.exports = SCUnitHPZ2;
},{"../SCUnit":12,"../SCUnitRepository":13}],59:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitIRand = function (_SCUnit) {
  _inherits(SCUnitIRand, _SCUnit);

  function SCUnitIRand() {
    _classCallCheck(this, SCUnitIRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitIRand).apply(this, arguments));
  }

  _createClass(SCUnitIRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var range = hi - lo;
      this.outputs[0][0] = Math.random() * range + lo | 0;
    }
  }]);

  return SCUnitIRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("IRand", SCUnitIRand);
module.exports = SCUnitIRand;
},{"../SCUnit":12,"../SCUnitRepository":13}],60:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitImpulse = function (_SCUnit) {
  _inherits(SCUnitImpulse, _SCUnit);

  function SCUnitImpulse() {
    _classCallCheck(this, SCUnitImpulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitImpulse).apply(this, arguments));
  }

  _createClass(SCUnitImpulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this._phase = this.inputs[1][0];
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
        if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      } else {
        this.dspProcess = dspProcess["next_k"];
        if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      }
      this._slopeFactor = rate.slopeFactor;
      this._phaseOffset = 0;
      this._cpstoinc = rate.sampleDur;
      if (this._phase === 0) {
        this._phase = 1;
      }
    }
  }]);

  return SCUnitImpulse;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var cpstoinc = this._cpstoinc;
  var phaseOffset = this.inputs[1][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase + prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freqIn[i] * cpstoinc;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phaseOffset = this.inputs[1][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase + prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freq;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
};
SCUnitRepository.registerSCUnitClass("Impulse", SCUnitImpulse);
module.exports = SCUnitImpulse;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],61:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitIn = function (_SCUnit) {
  _inherits(SCUnitIn, _SCUnit);

  function SCUnitIn() {
    _classCallCheck(this, SCUnitIn);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitIn).apply(this, arguments));
  }

  _createClass(SCUnitIn, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitIn;
}(SCUnit);

dspProcess["a"] = function () {
  this.outputs[0].set(this._buses[this.inputs[0][0] | 0]);
};
dspProcess["k"] = function () {
  this.outputs[0][0] = this._buses[this.inputs[0][0] | 0][0];
};
SCUnitRepository.registerSCUnitClass("In", SCUnitIn);
module.exports = SCUnitIn;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],62:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitInRange = function (_SCUnit) {
  _inherits(SCUnitInRange, _SCUnit);

  function SCUnitInRange() {
    _classCallCheck(this, SCUnitInRange);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitInRange).apply(this, arguments));
  }

  _createClass(SCUnitInRange, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitInRange;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    var _in = inIn[i];
    out[i] = loIn[i] <= _in && _in <= hiIn[i] ? 1 : 0;
  }
};
SCUnitRepository.registerSCUnitClass("InRange", SCUnitInRange);
module.exports = SCUnitInRange;
},{"../SCUnit":12,"../SCUnitRepository":13}],63:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitIntegrator = function (_SCUnit) {
  _inherits(SCUnitIntegrator, _SCUnit);

  function SCUnitIntegrator() {
    _classCallCheck(this, SCUnitIntegrator);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitIntegrator).apply(this, arguments));
  }

  _createClass(SCUnitIntegrator, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._b1 = this.inputs[1][0];
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitIntegrator;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_b1 = this.inputs[1][0];
  var b1 = this._b1;
  var y1 = this._y1;
  if (b1 === next_b1) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = y1 = inIn[i] + b1 * y1;
    }
  } else {
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = y1 = inIn[_i] + (b1 + b1_slope * _i) * y1;
    }
    this._b1 = next_b1;
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("Integrator", SCUnitIntegrator);
module.exports = SCUnitIntegrator;
},{"../SCUnit":12,"../SCUnitRepository":13}],64:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitK2A = function (_SCUnit) {
  _inherits(SCUnitK2A, _SCUnit);

  function SCUnitK2A() {
    _classCallCheck(this, SCUnitK2A);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitK2A).apply(this, arguments));
  }

  _createClass(SCUnitK2A, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
    }
  }]);

  return SCUnitK2A;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  this.outputs[0].fill(this.inputs[0][0], 0, inNumSamples);
};
SCUnitRepository.registerSCUnitClass("K2A", SCUnitK2A);
module.exports = SCUnitK2A;
},{"../SCUnit":12,"../SCUnitRepository":13}],65:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitKeyState = function (_SCUnit) {
  _inherits(SCUnitKeyState, _SCUnit);

  function SCUnitKeyState() {
    _classCallCheck(this, SCUnitKeyState);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitKeyState).apply(this, arguments));
  }

  _createClass(SCUnitKeyState, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_KEY_STATE, C.UI_KEY_STATE + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitKeyState;
}(SCUnit);

dspProcess["next"] = function () {
  var keyState = this.inputs[0][0];
  var minval = this.inputs[1][0];
  var maxval = this.inputs[2][0];
  var lag = this.inputs[3][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = (keyState | 0) === this._pointVal[0] ? maxval : minval;
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("KeyState", SCUnitKeyState);
module.exports = SCUnitKeyState;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],66:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitKlang = function (_SCUnit) {
  _inherits(SCUnitKlang, _SCUnit);

  function SCUnitKlang() {
    _classCallCheck(this, SCUnitKlang);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitKlang).apply(this, arguments));
  }

  _createClass(SCUnitKlang, [{
    key: "initialize",
    value: function initialize(rate) {
      var numpartials = (this.numInputs - 2) / 3;
      var numcoefs = numpartials * 3;
      var coefs = new Float32Array(numcoefs);
      var inputs = this.inputs;
      var freqscale = inputs[0][0] * rate.radiansPerSample;
      var freqoffset = inputs[1][0] * rate.radiansPerSample;
      var outf = 0;
      for (var i = 0, j = 2, k = -1; i < numpartials; i++) {
        var w = inputs[j++][0] * freqscale + freqoffset;
        var level = inputs[j++][0];
        var phase = inputs[j++][0];
        if (phase !== 0) {
          outf += coefs[++k] = level * Math.sin(phase);
          coefs[++k] = level * Math.sin(phase - w);
        } else {
          outf += coefs[++k] = 0;
          coefs[++k] = level * -Math.sin(w);
        }
        coefs[++k] = 2 * Math.cos(w);
      }
      this.dspProcess = dspProcess["next" + numpartials % 4];
      this._coefs = coefs;
      this._n = numpartials >> 2;
      this.outputs[0][0] = outf;
    }
  }]);

  return SCUnitKlang;
}(SCUnit);

dspProcess["next3"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      b1_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      b1_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      b1_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      b1_3 = void 0;
  var outf = void 0;
  y1_0 = coefs[0];
  y2_0 = coefs[1];
  b1_0 = coefs[2];
  y1_1 = coefs[3];
  y2_1 = coefs[4];
  b1_1 = coefs[5];
  y1_2 = coefs[6];
  y2_2 = coefs[7];
  b1_2 = coefs[8];
  for (var i = 0; i < inNumSamples; i++) {
    outf = y0_0 = b1_0 * y1_0 - y2_0;
    outf += y0_1 = b1_1 * y1_1 - y2_1;
    outf += y0_2 = b1_2 * y1_2 - y2_2;
    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
    y2_2 = y1_2;
    y1_2 = y0_2;
    out[i] = outf;
  }
  coefs[0] = y1_0;
  coefs[1] = y2_0;
  coefs[3] = y1_1;
  coefs[4] = y2_1;
  coefs[6] = y1_2;
  coefs[7] = y2_2;
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[0];
    y2_0 = coefs[1];
    b1_0 = coefs[2];
    y1_1 = coefs[3];
    y2_1 = coefs[4];
    b1_1 = coefs[5];
    y1_2 = coefs[6];
    y2_2 = coefs[7];
    b1_2 = coefs[8];
    y1_3 = coefs[9];
    y2_3 = coefs[10];
    b1_3 = coefs[11];
    for (var _i = 0; _i < inNumSamples; _i++) {
      outf = y0_0 = b1_0 * y1_0 - y2_0;
      outf += y0_1 = b1_1 * y1_1 - y2_1;
      outf += y0_2 = b1_2 * y1_2 - y2_2;
      outf += y0_3 = b1_3 * y1_3 - y2_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
      out[_i] += outf;
    }
    coefs[0] = y1_0;
    coefs[1] = y2_0;
    coefs[3] = y1_1;
    coefs[4] = y2_1;
    coefs[6] = y1_2;
    coefs[7] = y2_2;
    coefs[9] = y1_3;
    coefs[10] = y2_3;
  }
};
dspProcess["next2"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      b1_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      b1_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      b1_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      b1_3 = void 0;
  var outf = void 0;
  y1_0 = coefs[0];
  y2_0 = coefs[1];
  b1_0 = coefs[2];
  y1_1 = coefs[3];
  y2_1 = coefs[4];
  b1_1 = coefs[5];
  for (var i = 0; i < inNumSamples; i++) {
    outf = y0_0 = b1_0 * y1_0 - y2_0;
    outf += y0_1 = b1_1 * y1_1 - y2_1;
    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
    out[i] = outf;
  }
  coefs[0] = y1_0;
  coefs[1] = y2_0;
  coefs[3] = y1_1;
  coefs[4] = y2_1;
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[0];
    y2_0 = coefs[1];
    b1_0 = coefs[2];
    y1_1 = coefs[3];
    y2_1 = coefs[4];
    b1_1 = coefs[5];
    y1_2 = coefs[6];
    y2_2 = coefs[7];
    b1_2 = coefs[8];
    y1_3 = coefs[9];
    y2_3 = coefs[10];
    b1_3 = coefs[11];
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      outf = y0_0 = b1_0 * y1_0 - y2_0;
      outf += y0_1 = b1_1 * y1_1 - y2_1;
      outf += y0_2 = b1_2 * y1_2 - y2_2;
      outf += y0_3 = b1_3 * y1_3 - y2_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
      out[_i2] += outf;
    }
    coefs[0] = y1_0;
    coefs[1] = y2_0;
    coefs[3] = y1_1;
    coefs[4] = y2_1;
    coefs[6] = y1_2;
    coefs[7] = y2_2;
    coefs[9] = y1_3;
    coefs[10] = y2_3;
  }
};
dspProcess["next1"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      b1_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      b1_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      b1_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      b1_3 = void 0;
  var outf = void 0;
  y1_0 = coefs[0];
  y2_0 = coefs[1];
  b1_0 = coefs[2];
  for (var i = 0; i < inNumSamples; i++) {
    outf = y0_0 = b1_0 * y1_0 - y2_0;
    y2_0 = y1_0;
    y1_0 = y0_0;
    out[i] = outf;
  }
  coefs[0] = y1_0;
  coefs[1] = y2_0;
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[0];
    y2_0 = coefs[1];
    b1_0 = coefs[2];
    y1_1 = coefs[3];
    y2_1 = coefs[4];
    b1_1 = coefs[5];
    y1_2 = coefs[6];
    y2_2 = coefs[7];
    b1_2 = coefs[8];
    y1_3 = coefs[9];
    y2_3 = coefs[10];
    b1_3 = coefs[11];
    for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
      outf = y0_0 = b1_0 * y1_0 - y2_0;
      outf += y0_1 = b1_1 * y1_1 - y2_1;
      outf += y0_2 = b1_2 * y1_2 - y2_2;
      outf += y0_3 = b1_3 * y1_3 - y2_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
      out[_i3] += outf;
    }
    coefs[0] = y1_0;
    coefs[1] = y2_0;
    coefs[3] = y1_1;
    coefs[4] = y2_1;
    coefs[6] = y1_2;
    coefs[7] = y2_2;
    coefs[9] = y1_3;
    coefs[10] = y2_3;
  }
};
dspProcess["next0"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      b1_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      b1_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      b1_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      b1_3 = void 0;
  var outf = void 0;
  out.fill(0);
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[0];
    y2_0 = coefs[1];
    b1_0 = coefs[2];
    y1_1 = coefs[3];
    y2_1 = coefs[4];
    b1_1 = coefs[5];
    y1_2 = coefs[6];
    y2_2 = coefs[7];
    b1_2 = coefs[8];
    y1_3 = coefs[9];
    y2_3 = coefs[10];
    b1_3 = coefs[11];
    for (var i = 0; i < inNumSamples; i++) {
      outf = y0_0 = b1_0 * y1_0 - y2_0;
      outf += y0_1 = b1_1 * y1_1 - y2_1;
      outf += y0_2 = b1_2 * y1_2 - y2_2;
      outf += y0_3 = b1_3 * y1_3 - y2_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
      out[i] += outf;
    }
    coefs[0] = y1_0;
    coefs[1] = y2_0;
    coefs[3] = y1_1;
    coefs[4] = y2_1;
    coefs[6] = y1_2;
    coefs[7] = y2_2;
    coefs[9] = y1_3;
    coefs[10] = y2_3;
  }
};
SCUnitRepository.registerSCUnitClass("Klang", SCUnitKlang);
module.exports = SCUnitKlang;
},{"../SCUnit":12,"../SCUnitRepository":13}],67:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitKlank = function (_SCUnit) {
  _inherits(SCUnitKlank, _SCUnit);

  function SCUnitKlank() {
    _classCallCheck(this, SCUnitKlank);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitKlank).apply(this, arguments));
  }

  _createClass(SCUnitKlank, [{
    key: "initialize",
    value: function initialize(rate) {
      var numpartials = (this.numInputs - 4) / 3;
      var numcoefs = (numpartials + 3 & ~3) * 5;
      var coefs = new Float32Array(numcoefs + this.bufferLength);
      var buf = new Float32Array(coefs.buffer, numcoefs * 4);
      var inputs = this.inputs;
      var freqscale = inputs[1][0] * rate.radiansPerSample;
      var freqoffset = inputs[2][0] * rate.radiansPerSample;
      var decayscale = inputs[3][0];
      var sampleRate = rate.sampleRate;
      for (var i = 0, j = 4; i < numpartials; i++) {
        var w = inputs[j++][0] * freqscale + freqoffset;
        var level = inputs[j++][0];
        var time = inputs[j++][0] * decayscale;
        var R = time === 0 ? 0 : Math.exp(log001 / (time * sampleRate));
        var twoR = 2 * R;
        var R2 = R * R;
        var cost = twoR * Math.cos(w) / (1 + R2);
        var k = 20 * (i >> 2) + (i & 3);
        coefs[k] = 0;
        coefs[k + 4] = 0;
        coefs[k + 8] = twoR * cost;
        coefs[k + 12] = -R2;
        coefs[k + 16] = level * 0.25;
      }
      this.dspProcess = dspProcess["next" + numpartials % 4];
      this._numpartials = numpartials;
      this._n = numpartials >> 2;
      this._coefs = coefs;
      this._buf = buf;
      this._x1 = 0;
      this._x2 = 0;
    }
  }]);

  return SCUnitKlank;
}(SCUnit);

dspProcess["next3"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var inf = void 0;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      a0_0 = void 0,
      b1_0 = void 0,
      b2_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      a0_1 = void 0,
      b1_1 = void 0,
      b2_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      a0_2 = void 0,
      b1_2 = void 0,
      b2_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      a0_3 = void 0,
      b1_3 = void 0,
      b2_3 = void 0;
  var k = this._n * 20;
  y1_0 = coefs[k + 0];
  y2_0 = coefs[k + 4];
  b1_0 = coefs[k + 8];
  b2_0 = coefs[k + 12];
  a0_0 = coefs[k + 16];
  y1_1 = coefs[k + 1];
  y2_1 = coefs[k + 5];
  b1_1 = coefs[k + 9];
  b2_1 = coefs[k + 13];
  a0_1 = coefs[k + 17];
  y1_2 = coefs[k + 2];
  y2_2 = coefs[k + 6];
  b1_2 = coefs[k + 10];
  b2_2 = coefs[k + 14];
  a0_2 = coefs[k + 18];
  for (var i = 0; i < inNumSamples; i++) {
    inf = inIn[i];
    y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
    y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
    y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;
    buf[i] = a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2;
    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
    y2_2 = y1_2;
    y1_2 = y0_2;
  }
  coefs[k + 0] = y1_0;
  coefs[k + 4] = y2_0;
  coefs[k + 1] = y1_1;
  coefs[k + 5] = y2_1;
  coefs[k + 2] = y1_2;
  coefs[k + 6] = y2_2;
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[k + 0];
    y2_0 = coefs[k + 4];
    b1_0 = coefs[k + 8];
    b2_0 = coefs[k + 12];
    a0_0 = coefs[k + 16];
    y1_1 = coefs[k + 1];
    y2_1 = coefs[k + 5];
    b1_1 = coefs[k + 9];
    b2_1 = coefs[k + 13];
    a0_1 = coefs[k + 17];
    y1_2 = coefs[k + 2];
    y2_2 = coefs[k + 6];
    b1_2 = coefs[k + 10];
    b2_2 = coefs[k + 14];
    a0_2 = coefs[k + 18];
    y1_3 = coefs[k + 3];
    y2_3 = coefs[k + 7];
    b1_3 = coefs[k + 11];
    b2_3 = coefs[k + 15];
    a0_3 = coefs[k + 19];
    for (var _i = 0; _i < inNumSamples; _i++) {
      inf = inIn[_i];
      y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
      y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
      y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;
      y0_3 = inf + b1_3 * y1_3 + b2_3 * y2_3;
      buf[_i] += a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2 + a0_3 * y0_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
    }
    coefs[k + 0] = y1_0;
    coefs[k + 4] = y2_0;
    coefs[k + 1] = y1_1;
    coefs[k + 5] = y2_1;
    coefs[k + 2] = y1_2;
    coefs[k + 6] = y2_2;
    coefs[k + 3] = y1_3;
    coefs[k + 7] = y2_3;
    k += 20;
  }
  var x1 = this._x1;
  var x2 = this._x2;
  for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
    var x0 = buf[_i2];
    out[_i2] = x0 - x2;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
dspProcess["next2"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var inf = void 0;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      a0_0 = void 0,
      b1_0 = void 0,
      b2_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      a0_1 = void 0,
      b1_1 = void 0,
      b2_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      a0_2 = void 0,
      b1_2 = void 0,
      b2_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      a0_3 = void 0,
      b1_3 = void 0,
      b2_3 = void 0;
  var k = this._n * 20;
  y1_0 = coefs[k + 0];
  y2_0 = coefs[k + 4];
  b1_0 = coefs[k + 8];
  b2_0 = coefs[k + 12];
  a0_0 = coefs[k + 16];
  y1_1 = coefs[k + 1];
  y2_1 = coefs[k + 5];
  b1_1 = coefs[k + 9];
  b2_1 = coefs[k + 13];
  a0_1 = coefs[k + 17];
  for (var i = 0; i < inNumSamples; i++) {
    inf = inIn[i];
    y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
    y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
    buf[i] = a0_0 * y0_0 + a0_1 * y0_1;
    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
  }
  coefs[k + 0] = y1_0;
  coefs[k + 4] = y2_0;
  coefs[k + 1] = y1_1;
  coefs[k + 5] = y2_1;
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[k + 0];
    y2_0 = coefs[k + 4];
    b1_0 = coefs[k + 8];
    b2_0 = coefs[k + 12];
    a0_0 = coefs[k + 16];
    y1_1 = coefs[k + 1];
    y2_1 = coefs[k + 5];
    b1_1 = coefs[k + 9];
    b2_1 = coefs[k + 13];
    a0_1 = coefs[k + 17];
    y1_2 = coefs[k + 2];
    y2_2 = coefs[k + 6];
    b1_2 = coefs[k + 10];
    b2_2 = coefs[k + 14];
    a0_2 = coefs[k + 18];
    y1_3 = coefs[k + 3];
    y2_3 = coefs[k + 7];
    b1_3 = coefs[k + 11];
    b2_3 = coefs[k + 15];
    a0_3 = coefs[k + 19];
    for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
      inf = inIn[_i3];
      y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
      y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
      y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;
      y0_3 = inf + b1_3 * y1_3 + b2_3 * y2_3;
      buf[_i3] += a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2 + a0_3 * y0_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
    }
    coefs[k + 0] = y1_0;
    coefs[k + 4] = y2_0;
    coefs[k + 1] = y1_1;
    coefs[k + 5] = y2_1;
    coefs[k + 2] = y1_2;
    coefs[k + 6] = y2_2;
    coefs[k + 3] = y1_3;
    coefs[k + 7] = y2_3;
    k += 20;
  }
  var x1 = this._x1;
  var x2 = this._x2;
  for (var _i4 = 0; _i4 < inNumSamples; _i4++) {
    var x0 = buf[_i4];
    out[_i4] = x0 - x2;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
dspProcess["next1"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var inf = void 0;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      a0_0 = void 0,
      b1_0 = void 0,
      b2_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      a0_1 = void 0,
      b1_1 = void 0,
      b2_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      a0_2 = void 0,
      b1_2 = void 0,
      b2_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      a0_3 = void 0,
      b1_3 = void 0,
      b2_3 = void 0;
  var k = this._n * 20;
  y1_0 = coefs[k + 0];
  y2_0 = coefs[k + 4];
  b1_0 = coefs[k + 8];
  b2_0 = coefs[k + 12];
  a0_0 = coefs[k + 16];
  for (var i = 0; i < inNumSamples; i++) {
    inf = inIn[i];
    y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
    buf[i] = a0_0 * y0_0;
    y2_0 = y1_0;
    y1_0 = y0_0;
  }
  coefs[k + 0] = y1_0;
  coefs[k + 4] = y2_0;
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[k + 0];
    y2_0 = coefs[k + 4];
    b1_0 = coefs[k + 8];
    b2_0 = coefs[k + 12];
    a0_0 = coefs[k + 16];
    y1_1 = coefs[k + 1];
    y2_1 = coefs[k + 5];
    b1_1 = coefs[k + 9];
    b2_1 = coefs[k + 13];
    a0_1 = coefs[k + 17];
    y1_2 = coefs[k + 2];
    y2_2 = coefs[k + 6];
    b1_2 = coefs[k + 10];
    b2_2 = coefs[k + 14];
    a0_2 = coefs[k + 18];
    y1_3 = coefs[k + 3];
    y2_3 = coefs[k + 7];
    b1_3 = coefs[k + 11];
    b2_3 = coefs[k + 15];
    a0_3 = coefs[k + 19];
    for (var _i5 = 0; _i5 < inNumSamples; _i5++) {
      inf = inIn[_i5];
      y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
      y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
      y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;
      y0_3 = inf + b1_3 * y1_3 + b2_3 * y2_3;
      buf[_i5] += a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2 + a0_3 * y0_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
    }
    coefs[k + 0] = y1_0;
    coefs[k + 4] = y2_0;
    coefs[k + 1] = y1_1;
    coefs[k + 5] = y2_1;
    coefs[k + 2] = y1_2;
    coefs[k + 6] = y2_2;
    coefs[k + 3] = y1_3;
    coefs[k + 7] = y2_3;
    k += 20;
  }
  var x1 = this._x1;
  var x2 = this._x2;
  for (var _i6 = 0; _i6 < inNumSamples; _i6++) {
    var x0 = buf[_i6];
    out[_i6] = x0 - x2;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
dspProcess["next0"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var inf = void 0;
  var y0_0 = void 0,
      y1_0 = void 0,
      y2_0 = void 0,
      a0_0 = void 0,
      b1_0 = void 0,
      b2_0 = void 0;
  var y0_1 = void 0,
      y1_1 = void 0,
      y2_1 = void 0,
      a0_1 = void 0,
      b1_1 = void 0,
      b2_1 = void 0;
  var y0_2 = void 0,
      y1_2 = void 0,
      y2_2 = void 0,
      a0_2 = void 0,
      b1_2 = void 0,
      b2_2 = void 0;
  var y0_3 = void 0,
      y1_3 = void 0,
      y2_3 = void 0,
      a0_3 = void 0,
      b1_3 = void 0,
      b2_3 = void 0;
  var k = this._n * 20;
  buf.fill(0);
  for (var n = 0, nmax = this._n; n < nmax; n++) {
    y1_0 = coefs[k + 0];
    y2_0 = coefs[k + 4];
    b1_0 = coefs[k + 8];
    b2_0 = coefs[k + 12];
    a0_0 = coefs[k + 16];
    y1_1 = coefs[k + 1];
    y2_1 = coefs[k + 5];
    b1_1 = coefs[k + 9];
    b2_1 = coefs[k + 13];
    a0_1 = coefs[k + 17];
    y1_2 = coefs[k + 2];
    y2_2 = coefs[k + 6];
    b1_2 = coefs[k + 10];
    b2_2 = coefs[k + 14];
    a0_2 = coefs[k + 18];
    y1_3 = coefs[k + 3];
    y2_3 = coefs[k + 7];
    b1_3 = coefs[k + 11];
    b2_3 = coefs[k + 15];
    a0_3 = coefs[k + 19];
    for (var i = 0; i < inNumSamples; i++) {
      inf = inIn[i];
      y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
      y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
      y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;
      y0_3 = inf + b1_3 * y1_3 + b2_3 * y2_3;
      buf[i] += a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2 + a0_3 * y0_3;
      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
    }
    coefs[k + 0] = y1_0;
    coefs[k + 4] = y2_0;
    coefs[k + 1] = y1_1;
    coefs[k + 5] = y2_1;
    coefs[k + 2] = y1_2;
    coefs[k + 6] = y2_2;
    coefs[k + 3] = y1_3;
    coefs[k + 7] = y2_3;
    k += 20;
  }
  var x1 = this._x1;
  var x2 = this._x2;
  for (var _i7 = 0; _i7 < inNumSamples; _i7++) {
    var x0 = buf[_i7];
    out[_i7] = x0 - x2;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("Klank", SCUnitKlank);
module.exports = SCUnitKlank;
},{"../SCUnit":12,"../SCUnitRepository":13}],68:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFClipNoise = function (_SCUnit) {
  _inherits(SCUnitLFClipNoise, _SCUnit);

  function SCUnitLFClipNoise() {
    _classCallCheck(this, SCUnitLFClipNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFClipNoise).apply(this, arguments));
  }

  _createClass(SCUnitLFClipNoise, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._counter = 0;
      this._level = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFClipNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, this._sampleRate / Math.max(freq, 0.001) | 0);
      level = Math.random() < 0.5 ? -1 : +1;
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFClipNoise", SCUnitLFClipNoise);
module.exports = SCUnitLFClipNoise;
},{"../SCUnit":12,"../SCUnitRepository":13}],69:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFCub = function (_SCUnit) {
  _inherits(SCUnitLFCub, _SCUnit);

  function SCUnitLFCub() {
    _classCallCheck(this, SCUnitLFCub);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFCub).apply(this, arguments));
  }

  _createClass(SCUnitLFCub, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 2 * rate.sampleDur;
      this._phase = this.inputs[1][0] + 0.5;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFCub;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    var z = void 0;
    if (phase < 1) {
      z = phase;
    } else if (phase < 2) {
      z = 2 - phase;
    } else {
      phase -= 2;
      z = phase;
    }
    out[i] = z * z * (6 - 4 * z) - 1;
    phase += freq;
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFCub", SCUnitLFCub);
module.exports = SCUnitLFCub;
},{"../SCUnit":12,"../SCUnitRepository":13}],70:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFDClipNoise = function (_SCUnit) {
  _inherits(SCUnitLFDClipNoise, _SCUnit);

  function SCUnitLFDClipNoise() {
    _classCallCheck(this, SCUnitLFDClipNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDClipNoise).apply(this, arguments));
  }

  _createClass(SCUnitLFDClipNoise, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._level = 0;
      this._phase = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDClipNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() < 0.5 ? -1 : +1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = smpdur * freq;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() < 0.5 ? -1 : +1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDClipNoise", SCUnitLFDClipNoise);
module.exports = SCUnitLFDClipNoise;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],71:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFDNoise0 = function (_SCUnit) {
  _inherits(SCUnitLFDNoise0, _SCUnit);

  function SCUnitLFDNoise0() {
    _classCallCheck(this, SCUnitLFDNoise0);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDNoise0).apply(this, arguments));
  }

  _createClass(SCUnitLFDNoise0, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._level = 0;
      this._phase = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDNoise0;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() * 2 - 1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = smpdur * freq;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() * 2 - 1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDNoise0", SCUnitLFDNoise0);
module.exports = SCUnitLFDNoise0;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],72:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFDNoise1 = function (_SCUnit) {
  _inherits(SCUnitLFDNoise1, _SCUnit);

  function SCUnitLFDNoise1() {
    _classCallCheck(this, SCUnitLFDNoise1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDNoise1).apply(this, arguments));
  }

  _createClass(SCUnitLFDNoise1, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._phase = 0;
      this._prevLevel = 0;
      this._nextLevel = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDNoise1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var prevLevel = this._prevLevel;
  var nextLevel = this._nextLevel;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      prevLevel = nextLevel;
      nextLevel = Math.random() * 2 - 1;
    }
    out[i] = nextLevel + phase * (prevLevel - nextLevel);
  }
  this._prevLevel = prevLevel;
  this._nextLevel = nextLevel;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = freq * smpdur;
  var prevLevel = this._prevLevel;
  var nextLevel = this._nextLevel;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      prevLevel = nextLevel;
      nextLevel = Math.random() * 2 - 1;
    }
    out[i] = nextLevel + phase * (prevLevel - nextLevel);
  }
  this._prevLevel = prevLevel;
  this._nextLevel = nextLevel;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDNoise1", SCUnitLFDNoise1);
module.exports = SCUnitLFDNoise1;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],73:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var cubicinterp = require("../util/cubicinterp");
var dspProcess = {};

var SCUnitLFDNoise3 = function (_SCUnit) {
  _inherits(SCUnitLFDNoise3, _SCUnit);

  function SCUnitLFDNoise3() {
    _classCallCheck(this, SCUnitLFDNoise3);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDNoise3).apply(this, arguments));
  }

  _createClass(SCUnitLFDNoise3, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._phase = 0;
      this._levelA = 0;
      this._levelB = 0;
      this._levelC = 0;
      this._levelD = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDNoise3;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var a = this._levelA;
  var b = this._levelB;
  var c = this._levelC;
  var d = this._levelD;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      a = b;
      b = c;
      c = d;
      d = Math.random() * 2 - 1;
    }
    out[i] = cubicinterp(1 - phase, a, b, c, d);
  }
  this._levelA = a;
  this._levelB = b;
  this._levelC = c;
  this._levelD = d;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = freq * smpdur;
  var a = this._levelA;
  var b = this._levelB;
  var c = this._levelC;
  var d = this._levelD;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      a = b;
      b = c;
      c = d;
      d = Math.random() * 2 - 1;
    }
    out[i] = cubicinterp(1 - phase, a, b, c, d);
  }
  this._levelA = a;
  this._levelB = b;
  this._levelC = c;
  this._levelD = d;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDNoise3", SCUnitLFDNoise3);
module.exports = SCUnitLFDNoise3;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"../util/cubicinterp":172}],74:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFNoise0 = function (_SCUnit) {
  _inherits(SCUnitLFNoise0, _SCUnit);

  function SCUnitLFNoise0() {
    _classCallCheck(this, SCUnitLFNoise0);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFNoise0).apply(this, arguments));
  }

  _createClass(SCUnitLFNoise0, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = 0;
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFNoise0;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, this._sampleRate / Math.max(freq, 0.001) | 0);
      level = Math.random() * 2 - 1;
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFNoise0", SCUnitLFNoise0);
module.exports = SCUnitLFNoise0;
},{"../SCUnit":12,"../SCUnitRepository":13}],75:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFNoise1 = function (_SCUnit) {
  _inherits(SCUnitLFNoise1, _SCUnit);

  function SCUnitLFNoise1() {
    _classCallCheck(this, SCUnitLFNoise1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFNoise1).apply(this, arguments));
  }

  _createClass(SCUnitLFNoise1, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = Math.random() * 2 - 1;
      this._counter = 0;
      this._slope = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFNoise1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var slope = this._slope;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, this._sampleRate / Math.max(freq, 0.001) | 0);
      var nextLevel = Math.random() * 2 - 1;
      slope = (nextLevel - level) / counter;
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
      level += slope;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._slope = slope;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFNoise1", SCUnitLFNoise1);
module.exports = SCUnitLFNoise1;
},{"../SCUnit":12,"../SCUnitRepository":13}],76:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFNoise2 = function (_SCUnit) {
  _inherits(SCUnitLFNoise2, _SCUnit);

  function SCUnitLFNoise2() {
    _classCallCheck(this, SCUnitLFNoise2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFNoise2).apply(this, arguments));
  }

  _createClass(SCUnitLFNoise2, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = 0;
      this._counter = 0;
      this._slope = 0;
      this._curve = 0;
      this._nextValue = Math.random() * 2 - 1;
      this._nextMidPt = this._nextValue * 0.5;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFNoise2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var slope = this._slope;
  var curve = this._curve;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      var value = this._nextValue;
      this._nextValue = Math.random() * 2 - 1;
      level = this._nextMidPt;
      this._nextMidPt = (this._nextValue + value) * 0.5;
      counter = Math.max(2, this._sampleRate / Math.max(freq, 0.001) | 0);
      var fseglen = counter;
      curve = 2 * (this._nextMidPt - level - fseglen * slope) / (fseglen * fseglen + fseglen);
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
      slope += curve;
      level += slope;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._slope = slope;
  this._curve = curve;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFNoise2", SCUnitLFNoise2);
module.exports = SCUnitLFNoise2;
},{"../SCUnit":12,"../SCUnitRepository":13}],77:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFPar = function (_SCUnit) {
  _inherits(SCUnitLFPar, _SCUnit);

  function SCUnitLFPar() {
    _classCallCheck(this, SCUnitLFPar);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFPar).apply(this, arguments));
  }

  _createClass(SCUnitLFPar, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 4 * rate.sampleDur;
      this._phase = this.inputs[1][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFPar;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  var z = void 0,
      y = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    if (phase < 1) {
      z = phase;
      y = 1 - z * z;
    } else if (phase < 3) {
      z = phase - 2;
      y = z * z - 1;
    } else {
      phase -= 4;
      z = phase;
      y = 1 - z * z;
    }
    out[i] = y;
    phase += freq;
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFPar", SCUnitLFPar);
module.exports = SCUnitLFPar;
},{"../SCUnit":12,"../SCUnitRepository":13}],78:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFPulse = function (_SCUnit) {
  _inherits(SCUnitLFPulse, _SCUnit);

  function SCUnitLFPulse() {
    _classCallCheck(this, SCUnitLFPulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFPulse).apply(this, arguments));
  }

  _createClass(SCUnitLFPulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = rate.sampleDur;
      this._phase = this.inputs[1][0];
      this._duty = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFPulse;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var nextDuty = this.inputs[2][0];
  var duty = this._duty;
  var phase = this._phase;
  var z = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    if (phase > 1) {
      phase -= 1;
      duty = nextDuty;
      z = duty < 0.5 ? 1 : 0;
    } else {
      z = phase < duty ? 1 : 0;
    }
    out[i] = z;
    phase += freq;
  }
  this._duty = duty;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFPulse", SCUnitLFPulse);
module.exports = SCUnitLFPulse;
},{"../SCUnit":12,"../SCUnitRepository":13}],79:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFSaw = function (_SCUnit) {
  _inherits(SCUnitLFSaw, _SCUnit);

  function SCUnitLFSaw() {
    _classCallCheck(this, SCUnitLFSaw);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFSaw).apply(this, arguments));
  }

  _createClass(SCUnitLFSaw, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 2 * rate.sampleDur;
      this._phase = this.inputs[1][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFSaw;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  if (freq >= 0) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = phase;
      phase += freq;
      if (phase >= 1) {
        phase -= 2;
      }
    }
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = phase;
      phase += freq;
      if (phase <= -1) {
        phase += 2;
      }
    }
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFSaw", SCUnitLFSaw);
module.exports = SCUnitLFSaw;
},{"../SCUnit":12,"../SCUnitRepository":13}],80:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFTri = function (_SCUnit) {
  _inherits(SCUnitLFTri, _SCUnit);

  function SCUnitLFTri() {
    _classCallCheck(this, SCUnitLFTri);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFTri).apply(this, arguments));
  }

  _createClass(SCUnitLFTri, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 4 * rate.sampleDur;
      this._phase = this.inputs[1][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFTri;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = phase > 1 ? 2 - phase : phase;
    phase += freq;
    if (phase >= 3) {
      phase -= 4;
    }
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFTri", SCUnitLFTri);
module.exports = SCUnitLFTri;
},{"../SCUnit":12,"../SCUnitRepository":13}],81:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sqrt2 = Math.sqrt(2);

var SCUnitLPF = function (_SCUnit) {
  _inherits(SCUnitLPF, _SCUnit);

  function SCUnitLPF() {
    _classCallCheck(this, SCUnitLPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLPF).apply(this, arguments));
  }

  _createClass(SCUnitLPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = Math.max(0.001, this.inputs[1][0]);
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq) {
    var pfreq = freq * this._radiansPerSample * 0.5;
    var C = 1 / Math.tan(pfreq);
    var C2 = C * C;
    var sqrt2C = C * sqrt2;
    var next_a0 = 1 / (1 + sqrt2C + C2);
    var next_b1 = -2 * (1 - C2) * next_a0;
    var next_b2 = -(1 - sqrt2C + C2) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 + 2 * y1 + y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y + 2 * y1 + y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("LPF", SCUnitLPF);
module.exports = SCUnitLPF;
},{"../SCUnit":12,"../SCUnitRepository":13}],82:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLPZ1 = function (_SCUnit) {
  _inherits(SCUnitLPZ1, _SCUnit);

  function SCUnitLPZ1() {
    _classCallCheck(this, SCUnitLPZ1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLPZ1).apply(this, arguments));
  }

  _createClass(SCUnitLPZ1, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLPZ1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = 0.5 * (x0 + x1);
    x1 = x0;
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("LPZ1", SCUnitLPZ1);
module.exports = SCUnitLPZ1;
},{"../SCUnit":12,"../SCUnitRepository":13}],83:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLPZ2 = function (_SCUnit) {
  _inherits(SCUnitLPZ2, _SCUnit);

  function SCUnitLPZ2() {
    _classCallCheck(this, SCUnitLPZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLPZ2).apply(this, arguments));
  }

  _createClass(SCUnitLPZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLPZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 + 2 * x1 + x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("LPZ2", SCUnitLPZ2);
module.exports = SCUnitLPZ2;
},{"../SCUnit":12,"../SCUnitRepository":13}],84:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag = function (_SCUnit) {
  _inherits(SCUnitLag, _SCUnit);

  function SCUnitLag() {
    _classCallCheck(this, SCUnitLag);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag).apply(this, arguments));
  }

  _createClass(SCUnitLag, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lag = NaN;
      this._b1 = 0;
      this._y1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lag = this.inputs[1][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag === this._lag) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i];
      out[i] = y1 = y0 + b1 * (y1 - y0);
    }
  } else {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
    var b1_slope = (this._b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i];
      out[_i] = y1 = _y + (b1 + b1_slope * _i) * (y1 - _y);
    }
  }
  this._y1 = y1;
};
dspProcess["next_1"] = function () {
  var out = this.outputs[0];
  var lag = this.inputs[1][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = this.inputs[0][0];
  out[0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("Lag", SCUnitLag);
module.exports = SCUnitLag;
},{"../SCUnit":12,"../SCUnitRepository":13}],85:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag2 = function (_SCUnit) {
  _inherits(SCUnitLag2, _SCUnit);

  function SCUnitLag2() {
    _classCallCheck(this, SCUnitLag2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag2).apply(this, arguments));
  }

  _createClass(SCUnitLag2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
        this.dspProcess = dspProcess["next_k"];
      } else {
        if (this.bufferLength === 1) {
          this.dspProcess = dspProcess["next_1_i"];
        } else {
          this.dspProcess = dspProcess["next_i"];
        }
      }
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lag = NaN;
      this._b1 = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag2;
}(SCUnit);

dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lag = this.inputs[1][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var b1 = this._b1;
  if (lag === this._lag) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      y1a = y0a + b1 * (y1a - y0a);
      y1b = y1a + b1 * (y1b - y1a);
      out[i] = y1b;
    }
  } else {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
    var b1_slope = (this._b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1 += b1_slope;
      y1a = _y0a + b1 * (y1a - _y0a);
      y1b = y1a + b1 * (y1b - y1a);
      out[_i] = y1b;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
dspProcess["next_i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var y1a = this._y1a;
  var y1b = this._y1b;
  for (var i = 0; i < inNumSamples; i++) {
    var y0a = inIn[i];
    y1a = y0a + b1 * (y1a - y0a);
    y1b = y1a + b1 * (y1b - y1a);
    out[i] = y1b;
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
dspProcess["next_1_i"] = function () {
  var out = this.outputs[0];
  var y0a = this.inputs[0][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var b1 = this._b1;
  y1a = y0a + b1 * (y1a - y0a);
  y1b = y1a + b1 * (y1b - y1a);
  out[0] = y1b;
  this._y1a = y1a;
  this._y1b = y1b;
};
SCUnitRepository.registerSCUnitClass("Lag2", SCUnitLag2);
module.exports = SCUnitLag2;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],86:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag2UD = function (_SCUnit) {
  _inherits(SCUnitLag2UD, _SCUnit);

  function SCUnitLag2UD() {
    _classCallCheck(this, SCUnitLag2UD);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag2UD).apply(this, arguments));
  }

  _createClass(SCUnitLag2UD, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lagu = 0;
      this._lagd = 0;
      this._b1u = 0;
      this._b1d = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag2UD;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lagu = this.inputs[1][0];
  var lagd = this.inputs[2][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var b1u = this._b1u;
  var b1d = this._b1d;
  if (lagu === this._lagu && lagd === this._lagd) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      if (y0a > y1a) {
        y1a = y0a + b1u * (y1a - y0a);
      } else {
        y1a = y0a + b1d * (y1a - y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      out[i] = y1b;
    }
  } else {
    this._b1u = lagu === 0 ? 0 : Math.exp(log001 / (lagu * this._sampleRate));
    this._b1d = lagd === 0 ? 0 : Math.exp(log001 / (lagd * this._sampleRate));
    this._lagu = lagu;
    this._lagd = lagd;
    var b1u_slope = (this._b1u - b1u) * this._slopeFactor;
    var b1d_slope = (this._b1d - b1d) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1u += b1u_slope;
      b1d += b1d_slope;
      if (_y0a > y1a) {
        y1a = _y0a + b1u * (y1a - _y0a);
      } else {
        y1a = _y0a + b1d * (y1a - _y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      out[_i] = y1b;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
SCUnitRepository.registerSCUnitClass("Lag2UD", SCUnitLag2UD);
module.exports = SCUnitLag2UD;
},{"../SCUnit":12,"../SCUnitRepository":13}],87:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag3 = function (_SCUnit) {
  _inherits(SCUnitLag3, _SCUnit);

  function SCUnitLag3() {
    _classCallCheck(this, SCUnitLag3);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag3).apply(this, arguments));
  }

  _createClass(SCUnitLag3, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
        this.dspProcess = dspProcess["next"];
      } else {
        if (this.bufferLength === 1) {
          this.dspProcess = dspProcess["next_1_i"];
        } else {
          this.dspProcess = dspProcess["next"];
        }
      }
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lag = NaN;
      this._b1 = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this._y1c = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag3;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lag = this.inputs[1][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var y1c = this._y1c;
  var b1 = this._b1;
  if (lag === this._lag) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      y1a = y0a + b1 * (y1a - y0a);
      y1b = y1a + b1 * (y1b - y1a);
      y1c = y1b + b1 * (y1c - y1b);
      out[i] = y1c;
    }
  } else {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
    var b1_slope = (this._b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1 += b1_slope;
      y1a = _y0a + b1 * (y1a - _y0a);
      y1b = y1a + b1 * (y1b - y1a);
      y1c = y1b + b1 * (y1c - y1b);
      out[_i] = y1c;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
  this._y1c = y1c;
};
dspProcess["next_1_i"] = function () {
  var out = this.outputs[0];
  var y0a = this.inputs[0][0];
  var b1 = this._b1;
  var y1a = this._y1a;
  var y1b = this._y1b;
  var y1c = this._y1c;
  y1a = y0a + b1 * (y1a - y0a);
  y1b = y1a + b1 * (y1b - y1a);
  y1c = y1b + b1 * (y1c - y1b);
  out[0] = y1c;
  this._y1a = y1a;
  this._y1b = y1b;
  this._y1c = y1c;
};
SCUnitRepository.registerSCUnitClass("Lag3", SCUnitLag3);
module.exports = SCUnitLag3;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],88:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag3UD = function (_SCUnit) {
  _inherits(SCUnitLag3UD, _SCUnit);

  function SCUnitLag3UD() {
    _classCallCheck(this, SCUnitLag3UD);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag3UD).apply(this, arguments));
  }

  _createClass(SCUnitLag3UD, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lagu = 0;
      this._lagd = 0;
      this._b1u = 0;
      this._b1d = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this._y1c = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag3UD;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lagu = this.inputs[1][0];
  var lagd = this.inputs[2][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var y1c = this._y1c;
  var b1u = this._b1u;
  var b1d = this._b1d;
  if (lagu === this._lagu && lagd === this._lagd) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      if (y0a > y1a) {
        y1a = y0a + b1u * (y1a - y0a);
      } else {
        y1a = y0a + b1d * (y1a - y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      if (y1a > y1b) {
        y1c = y1b + b1u * (y1c - y1b);
      } else {
        y1c = y1b + b1d * (y1c - y1b);
      }
      out[i] = y1c;
    }
  } else {
    this._b1u = lagu === 0 ? 0 : Math.exp(log001 / (lagu * this._sampleRate));
    this._b1d = lagd === 0 ? 0 : Math.exp(log001 / (lagd * this._sampleRate));
    this._lagu = lagu;
    this._lagd = lagd;
    var b1u_slope = (this._b1u - b1u) * this._slopeFactor;
    var b1d_slope = (this._b1d - b1d) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1u += b1u_slope;
      b1d += b1d_slope;
      if (_y0a > y1a) {
        y1a = _y0a + b1u * (y1a - _y0a);
      } else {
        y1a = _y0a + b1d * (y1a - _y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      if (y1a > y1b) {
        y1c = y1b + b1u * (y1c - y1b);
      } else {
        y1c = y1b + b1d * (y1c - y1b);
      }
      out[_i] = y1c;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
  this._y1c = y1c;
};
SCUnitRepository.registerSCUnitClass("Lag3UD", SCUnitLag3UD);
module.exports = SCUnitLag3UD;
},{"../SCUnit":12,"../SCUnitRepository":13}],89:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLagControl = function (_SCUnit) {
  _inherits(SCUnitLagControl, _SCUnit);

  function SCUnitLagControl() {
    _classCallCheck(this, SCUnitLagControl);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLagControl).apply(this, arguments));
  }

  _createClass(SCUnitLagControl, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.outputs.length === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      var numberOfOutputs = this.outputs.length;
      var sampleRate = rate.sampleRate;
      this._controls = this.synth.params;
      this._y1 = new Float32Array(numberOfOutputs);
      this._b1 = new Float32Array(numberOfOutputs);
      for (var i = 0; i < numberOfOutputs; i++) {
        var lag = this.inputs[i][0];
        this._y1[i] = this._controls[i];
        this._b1[i] = lag === 0 ? 0 : Math.exp(log001 / (lag * sampleRate));
      }
      this.dspProcess(1);
    }
  }]);

  return SCUnitLagControl;
}(SCUnit);

dspProcess["1"] = function () {
  var y1 = this._y1;
  var b1 = this._b1;
  var z = this._controls[this.specialIndex];
  var x = z + b1[0] * (y1[0] - z);
  this.outputs[0][0] = y1[0] = x;
};
dspProcess["k"] = function () {
  var controls = this._controls;
  var outputs = this.outputs;
  var numberOfOutputs = this.outputs.length;
  var specialIndex = this.specialIndex;
  var y1 = this._y1;
  var b1 = this._b1;
  for (var i = 0; i < numberOfOutputs; i++) {
    var z = controls[specialIndex + i];
    var x = z + b1[i] * (y1[i] - z);
    outputs[i][0] = y1[i] = x;
  }
};
SCUnitRepository.registerSCUnitClass("LagControl", SCUnitLagControl);
module.exports = SCUnitLagControl;
},{"../SCUnit":12,"../SCUnitRepository":13}],90:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLagUD = function (_SCUnit) {
  _inherits(SCUnitLagUD, _SCUnit);

  function SCUnitLagUD() {
    _classCallCheck(this, SCUnitLagUD);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLagUD).apply(this, arguments));
  }

  _createClass(SCUnitLagUD, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lagu = NaN;
      this._lagd = NaN;
      this._b1u = 0;
      this._b1d = 0;
      this._y1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLagUD;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lagu = this.inputs[1][0];
  var lagd = this.inputs[2][0];
  var b1u = this._b1u;
  var b1d = this._b1d;
  var y1 = this._y1;
  if (lagu === this._lagu && lagd === this._lagd) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i];
      if (y0 > y1) {
        out[i] = y1 = y0 + b1u * (y1 - y0);
      } else {
        out[i] = y1 = y0 + b1d * (y1 - y0);
      }
    }
  } else {
    this._b1u = lagu === 0 ? 0 : Math.exp(log001 / (lagu * this._sampleRate));
    this._b1d = lagd === 0 ? 0 : Math.exp(log001 / (lagd * this._sampleRate));
    this._lagu = lagu;
    this._lagd = lagd;
    var b1u_slope = (this._b1u - b1u) * this._slopeFactor;
    var b1d_slope = (this._b1d - b1d) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i];
      if (_y > y1) {
        out[_i] = y1 = _y + (b1u + b1u_slope * _i) * (y1 - _y);
      } else {
        out[_i] = y1 = _y + (b1d + b1d_slope * _i) * (y1 - _y);
      }
    }
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("LagUD", SCUnitLagUD);
module.exports = SCUnitLagUD;
},{"../SCUnit":12,"../SCUnitRepository":13}],91:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLatch = function (_SCUnit) {
  _inherits(SCUnitLatch, _SCUnit);

  function SCUnitLatch() {
    _classCallCheck(this, SCUnitLatch);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLatch).apply(this, arguments));
  }

  _createClass(SCUnitLatch, [{
    key: "initialize",
    value: function initialize() {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_ak"];
      }
      this._trig = 0;
      this._level = 0;
      this.outputs[0][0] = this.inputs[1][0] > 0 ? this.inputs[0][0] : 0;
    }
  }]);

  return SCUnitLatch;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var trig = this._trig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curTrig = trigIn[i];
    if (trig <= 0 && curTrig > 0) {
      level = inIn[i];
    }
    out[i] = level;
    trig = curTrig;
  }
  this._trig = trig;
  this._level = level;
};
dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trig = this.inputs[0][1];
  var level = this._level;
  if (this._trig <= 0 && trig > 0) {
    level = this.inputs[0][0];
  }
  out.fill(level, 0, inNumSamples);
  this._trig = trig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Latch", SCUnitLatch);
module.exports = SCUnitLatch;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],92:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLeakDC = function (_SCUnit) {
  _inherits(SCUnitLeakDC, _SCUnit);

  function SCUnitLeakDC() {
    _classCallCheck(this, SCUnitLeakDC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLeakDC).apply(this, arguments));
  }

  _createClass(SCUnitLeakDC, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        if (this.inputSpecs[1].rate === C.RATE_SCALAR) {
          this.dspProcess = dspProcess["next_i"];
        } else {
          this.dspProcess = dspProcess["next"];
        }
      }
      this._filterSlope = rate.filterSlope;
      this._b1 = 0;
      this._x1 = this.inputs[0][0];
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLeakDC;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var b1_next = this.inputs[1][0];
  var y1 = this._y1;
  var x1 = this._x1;
  if (b1 === b1_next) {
    for (var i = 0; i < inNumSamples; i++) {
      var x0 = inIn[i];
      out[i] = y1 = x0 - x1 + b1 * y1;
      x1 = x0;
    }
  } else {
    var b1_slope = (b1_next - b1) * this._filterSlope;
    for (var _i = 0; _i < inNumSamples; _i) {
      var _x = inIn[_i];
      out[_i] = y1 = _x - x1 + (b1 + b1_slope * _i) * y1;
      x1 = _x;
    }
    this._b1 = b1_next;
  }
  this._x1 = x1;
  this._y1 = y1;
};
dspProcess["next_i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var y1 = this._y1;
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = y1 = x0 - x1 + b1 * y1;
    x1 = x0;
  }
  this._x1 = x1;
  this._y1 = y1;
};
dspProcess["next_1"] = function () {
  var x0 = this.inputs[0][0];
  var b1 = this.inputs[1][0];
  var y1 = this._y1;
  var x1 = this._x1;
  this.outputs[0][0] = y1 = x0 - x1 + b1 * y1;
  x1 = x0;
  this._x1 = x1;
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("LeakDC", SCUnitLeakDC);
module.exports = SCUnitLeakDC;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],93:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinExp = function (_SCUnit) {
  _inherits(SCUnitLinExp, _SCUnit);

  function SCUnitLinExp() {
    _classCallCheck(this, SCUnitLinExp);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinExp).apply(this, arguments));
  }

  _createClass(SCUnitLinExp, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_1"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._srclo = 0;
      this._srchi = 0;
      this._dstlo = 0;
      this._dsthi = 0;
      this._x = 0;
      this._y = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinExp;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_srclo = this.inputs[1][0];
  var next_srchi = this.inputs[2][0];
  var next_dstlo = this.inputs[3][0] || 0.001;
  var next_dsthi = this.inputs[4][0] || 0.001;
  var srclo = this._srclo;
  var srchi = this._srchi;
  var dstlo = this._dstlo;
  var dsthi = this._dsthi;
  var x = this._x;
  var y = this._y;
  if (srclo !== next_srclo || srchi !== next_srchi || dstlo !== next_dstlo || dsthi !== next_dsthi) {
    var next_x = dsthi / dstlo;
    var next_y = srchi - srclo || 0.001;
    var x_slope = (next_x - x) * this._slopeFactor;
    var y_slope = (next_y - y) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = Math.pow(x + x_slope * i, (inIn[i] - srclo) / (y + y_slope * i)) * dstlo;
    }
    this._srclo = next_srclo;
    this._srchi = next_srchi;
    this._dstlo = next_dstlo;
    this._dsthi = next_dsthi;
    this._x = next_x;
    this._y = next_y;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = Math.pow(x, (inIn[_i] - srclo) / y) * dstlo;
    }
  }
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var srclo = this.inputs[1][0];
  var srchi = this.inputs[2][0];
  var dstlo = this.inputs[3][0] || 0.001;
  var dsthi = this.inputs[4][0] || 0.001;
  if (this._srclo !== srclo || this._srchi !== srchi || this._dstlo !== dstlo || this._dsthi !== dsthi) {
    this._srclo = srclo;
    this._srchi = srchi;
    this._dstlo = dstlo;
    this._dsthi = dsthi;
    this._x = dsthi / dstlo;
    this._y = srchi - srclo || 0.001;
  }
  this.outputs[0][0] = Math.pow(this._x, (_in - srclo) / this._y) * dstlo;
};
SCUnitRepository.registerSCUnitClass("LinExp", SCUnitLinExp);
module.exports = SCUnitLinExp;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],94:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinLin = function (_SCUnit) {
  _inherits(SCUnitLinLin, _SCUnit);

  function SCUnitLinLin() {
    _classCallCheck(this, SCUnitLinLin);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinLin).apply(this, arguments));
  }

  _createClass(SCUnitLinLin, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_1"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._srclo = 0;
      this._srchi = 0;
      this._dstlo = 0;
      this._dsthi = 0;
      this._scale = 1;
      this._offset = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinLin;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_srclo = this.inputs[1][0];
  var next_srchi = this.inputs[2][0];
  var next_dstlo = this.inputs[3][0];
  var next_dsthi = this.inputs[4][0];
  var srclo = this._srclo;
  var srchi = this._srchi;
  var dstlo = this._dstlo;
  var dsthi = this._dsthi;
  var scale = this._scale;
  var offset = this._offset;
  if (srclo !== next_srclo || srchi !== next_srchi || dstlo !== next_dstlo || dsthi !== next_dsthi) {
    var next_scale = (next_dsthi - next_dstlo) / (next_srchi - next_srclo) || 0;
    var next_offset = next_dstlo - next_scale * next_srclo;
    var scale_slope = (next_scale - scale) * this._slopeFactor;
    var offset_slope = (next_offset - offset) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = inIn[i] * (scale + scale_slope * i) + (offset + offset_slope * i);
    }
    this._srclo = next_srclo;
    this._srchi = next_srchi;
    this._dstlo = next_dstlo;
    this._dsthi = next_dsthi;
    this._scale = next_scale;
    this._offset = next_offset;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = inIn[_i] * scale + offset;
    }
  }
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var srclo = this.inputs[1][0];
  var srchi = this.inputs[2][0];
  var dstlo = this.inputs[3][0];
  var dsthi = this.inputs[4][0];
  if (this._srclo !== srclo || this._srchi !== srchi || this._dstlo !== dstlo || this._dsthi !== dsthi) {
    this._srclo = srclo;
    this._srchi = srchi;
    this._dstlo = dstlo;
    this._dsthi = dsthi;
    this._scale = (dsthi - dstlo) / (srchi - srclo) || 0;
    this._offset = dstlo - this._scale * srclo;
  }
  this.outputs[0][0] = _in * this._scale + this._offset;
};
SCUnitRepository.registerSCUnitClass("LinLin", SCUnitLinLin);
module.exports = SCUnitLinLin;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],95:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitLinRand = function (_SCUnit) {
  _inherits(SCUnitLinRand, _SCUnit);

  function SCUnitLinRand() {
    _classCallCheck(this, SCUnitLinRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinRand).apply(this, arguments));
  }

  _createClass(SCUnitLinRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var n = this.inputs[2][0] | 0;
      var range = hi - lo;
      var a = Math.random();
      var b = Math.random();
      if (n <= 0) {
        this.outputs[0][0] = Math.min(a, b) * range + lo;
      } else {
        this.outputs[0][0] = Math.max(a, b) * range + lo;
      }
    }
  }]);

  return SCUnitLinRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("LinRand", SCUnitLinRand);
module.exports = SCUnitLinRand;
},{"../SCUnit":12,"../SCUnitRepository":13}],96:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinXFade2 = function (_SCUnit) {
  _inherits(SCUnitLinXFade2, _SCUnit);

  function SCUnitLinXFade2() {
    _classCallCheck(this, SCUnitLinXFade2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinXFade2).apply(this, arguments));
  }

  _createClass(SCUnitLinXFade2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._pos = Math.max(-1, Math.min(this.inputs[2][0], 1));
      this._amp = this._pos * 0.5 + 0.5;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinXFade2;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var posIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    var pos = Math.max(-1, Math.min(posIn[i], 1));
    var amp = pos * 0.5 + 0.5;
    out[i] = leftIn[i] + amp * (rightIn[i] - leftIn[i]);
  }
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var nextPos = this.inputs[2][0];
  var amp = this._amp;
  if (this._pos !== nextPos) {
    var pos = Math.max(-1, Math.min(nextPos, 1));
    var nextAmp = pos * 0.5 + 0.5;
    var amp_slope = (nextAmp - amp) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = leftIn[i] + (amp + amp_slope * i) * (rightIn[i] - leftIn[i]);
    }
    this._pos = nextPos;
    this._amp = nextAmp;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = leftIn[_i] + amp * (rightIn[_i] - leftIn[_i]);
    }
  }
};
SCUnitRepository.registerSCUnitClass("LinXFade2", SCUnitLinXFade2);
module.exports = SCUnitLinXFade2;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],97:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLine = function (_SCUnit) {
  _inherits(SCUnitLine, _SCUnit);

  function SCUnitLine() {
    _classCallCheck(this, SCUnitLine);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLine).apply(this, arguments));
  }

  _createClass(SCUnitLine, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      var start = this.inputs[0][0];
      var end = this.inputs[1][0];
      var dur = this.inputs[2][0];
      var counter = Math.round(dur * rate.sampleRate);
      this._counter = Math.max(1, counter);
      if (counter === 0) {
        this._level = end;
        this._slope = 0;
      } else {
        this._slope = (end - start) / this._counter;
        this._level = start + this._slope;
      }
      this._endLevel = end;
      this._doneAction = this.inputs[3][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitLine;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var slope = this._slope;
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter === 0) {
      var endLevel = this._endLevel;
      for (var i = 0; i < remain; i++) {
        out[j++] = endLevel;
      }
      remain = 0;
    } else {
      var nsmps = Math.min(remain, counter);
      counter -= nsmps;
      remain -= nsmps;
      for (var _i = 0; _i < nsmps; _i++) {
        out[j++] = level;
        level += slope;
      }
      if (counter === 0) {
        this.doneAction(this._doneAction);
      }
    }
  } while (remain);
  this._counter = counter;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Line", SCUnitLine);
module.exports = SCUnitLine;
},{"../SCUnit":12,"../SCUnitRepository":13}],98:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinen = function (_SCUnit) {
  _inherits(SCUnitLinen, _SCUnit);

  function SCUnitLinen() {
    _classCallCheck(this, SCUnitLinen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinen).apply(this, arguments));
  }

  _createClass(SCUnitLinen, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = 0;
      this._stage = 4;
      this._prevGate = 0;
      this._slope = 0;
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinen;
}(SCUnit);

dspProcess["next"] = function () {
  var out = this.outputs[0];
  var gate = this.inputs[0][0];
  if (this._prevGate <= 0 && gate > 0) {
    this.done = false;
    this._stage = 0;
    var attackTime = this.inputs[1][0];
    var susLevel = this.inputs[2][0];
    var counter = Math.max(1, attackTime * this._sampleRate | 0);
    this._slope = (susLevel - this._level) / counter;
    this._counter = counter;
  }
  switch (this._stage) {
    case 0:
    case 2:
      out[0] = this._level;
      this._level += this._slope;
      this._counter -= 1;
      if (this._counter === 0) {
        this._stage += 1;
      }
      break;
    case 1:
      out[0] = this._level;
      if (gate <= -1) {
        var releaseTime = -gate - 1;
        var _counter = Math.max(1, releaseTime * this._sampleRate | 0);
        this._stage = 2;
        this._slope = -this._level / _counter;
        this._counter = _counter;
      } else if (gate <= 0) {
        var _releaseTime = this.inputs[3][0];
        var _counter2 = Math.max(1, _releaseTime * this._sampleRate | 0);
        this._stage = 2;
        this._slope = -this._level / _counter2;
        this._counter = _counter2;
      }
      break;
    case 3:
      out[0] = 0;
      this.done = true;
      this._stage = 4;
      this.doneAction(this.inputs[4][0]);
      break;
    case 4:
      out[0] = 0;
      break;
  }
  this._prevGate = gate;
};
SCUnitRepository.registerSCUnitClass("Linen", SCUnitLinen);
module.exports = SCUnitLinen;
},{"../SCUnit":12,"../SCUnitRepository":13}],99:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLogistic = function (_SCUnit) {
  _inherits(SCUnitLogistic, _SCUnit);

  function SCUnitLogistic() {
    _classCallCheck(this, SCUnitLogistic);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLogistic).apply(this, arguments));
  }

  _createClass(SCUnitLogistic, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = this.inputs[2][0];
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLogistic;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var paramf = this.inputs[0][0];
  var freq = this.inputs[1][0];
  var sampleRate = this._sampleRate;
  var y1 = this._y1;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, sampleRate / Math.max(0.001, freq)) | 0;
      y1 = paramf * y1 * (1 - y1);
    }
    var nsmps = Math.min(counter, remain);
    counter -= nsmps;
    remain -= nsmps;
    for (var i = 0; i < nsmps; i++) {
      out[j++] = y1;
    }
  } while (remain);
  this._y1 = y1;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("Logistic", SCUnitLogistic);
module.exports = SCUnitLogistic;
},{"../SCUnit":12,"../SCUnitRepository":13}],100:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitMidEQ = function (_SCUnit) {
  _inherits(SCUnitMidEQ, _SCUnit);

  function SCUnitMidEQ() {
    _classCallCheck(this, SCUnitMidEQ);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMidEQ).apply(this, arguments));
  }

  _createClass(SCUnitMidEQ, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._bw = NaN;
      this._db = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitMidEQ;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var bw = this.inputs[2][0];
  var db = this.inputs[3][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || bw !== this._bw || db !== this._db) {
    var amp = Math.pow(10, db * 0.05) - 1;
    var pfreq = freq * this._radiansPerSample;
    var pbw = bw * pfreq * 0.5;
    var C = pbw ? 1 / Math.tan(pbw) : 0;
    var D = 2 * Math.cos(pfreq);
    var next_a0 = 1 / (1 + C);
    var next_b1 = C * D * next_a0;
    var next_b2 = (1 - C) * next_a0;
    var a0_slope = (next_a0 * amp - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var zin = inIn[i];
      var y0 = zin + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = zin + (a0 + a0_slope * i) * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._bw = bw;
    this._db = db;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _zin = inIn[_i];
      var _y = _zin + b1 * y1 + b2 * y2;
      out[_i] = _zin + a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("MidEQ", SCUnitMidEQ);
module.exports = SCUnitMidEQ;
},{"../SCUnit":12,"../SCUnitRepository":13}],101:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitMouseButton = function (_SCUnit) {
  _inherits(SCUnitMouseButton, _SCUnit);

  function SCUnitMouseButton() {
    _classCallCheck(this, SCUnitMouseButton);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMouseButton).apply(this, arguments));
  }

  _createClass(SCUnitMouseButton, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_MOUSE_BUTTON, C.UI_MOUSE_BUTTON + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitMouseButton;
}(SCUnit);

dspProcess["next"] = function () {
  var minval = this.inputs[0][0];
  var maxval = this.inputs[1][0];
  var lag = this.inputs[2][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this.ç));
    this._lag = lag;
  }
  var y0 = this._pointVal[0] ? maxval : minval;
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("MouseButton", SCUnitMouseButton);
module.exports = SCUnitMouseButton;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],102:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitMouseX = function (_SCUnit) {
  _inherits(SCUnitMouseX, _SCUnit);

  function SCUnitMouseX() {
    _classCallCheck(this, SCUnitMouseX);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMouseX).apply(this, arguments));
  }

  _createClass(SCUnitMouseX, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_MOUSE_X, C.UI_MOUSE_X + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitMouseX;
}(SCUnit);

dspProcess["next"] = function () {
  var minval = this.inputs[0][0] || 0.01;
  var maxval = this.inputs[1][0];
  var warp = this.inputs[2][0];
  var lag = this.inputs[3][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = this._pointVal[0];
  if (warp === 0) {
    y0 = (maxval - minval) * y0 + minval;
  } else {
    y0 = Math.pow(maxval / minval, y0) * minval;
    if (isNaN(y0)) {
      y0 = 0;
    }
  }
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("MouseX", SCUnitMouseX);
module.exports = SCUnitMouseX;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],103:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitMouseY = function (_SCUnit) {
  _inherits(SCUnitMouseY, _SCUnit);

  function SCUnitMouseY() {
    _classCallCheck(this, SCUnitMouseY);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMouseY).apply(this, arguments));
  }

  _createClass(SCUnitMouseY, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_MOUSE_Y, C.UI_MOUSE_Y + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitMouseY;
}(SCUnit);

dspProcess["next"] = function () {
  var minval = this.inputs[0][0] || 0.01;
  var maxval = this.inputs[1][0];
  var warp = this.inputs[2][0];
  var lag = this.inputs[3][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = this._pointVal[0];
  if (warp === 0) {
    y0 = (maxval - minval) * y0 + minval;
  } else {
    y0 = Math.pow(maxval / minval, y0) * minval;
    if (isNaN(y0)) {
      y0 = 0;
    }
  }
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("MouseY", SCUnitMouseY);
module.exports = SCUnitMouseY;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],104:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitMulAdd = function (_SCUnit) {
  _inherits(SCUnitMulAdd, _SCUnit);

  function SCUnitMulAdd() {
    _classCallCheck(this, SCUnitMulAdd);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMulAdd).apply(this, arguments));
  }

  _createClass(SCUnitMulAdd, [{
    key: "initialize",
    value: function initialize(rate) {
      this._slopeFactor = rate.slopeFactor;
      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspProcess["d"];
      } else {
        this.dspProcess = dspProcess[$r2k(this.inputSpecs)];
        this._in = this.inputs[0][0];
        this._mul = this.inputs[1][0];
        this._add = this.inputs[2][0];
        if (this.dspProcess) {
          this.dspProcess(1);
        } else {
          this.outputs[0][0] = this._in * this._mul + this._add;
        }
      }
    }
  }]);

  return SCUnitMulAdd;
}(SCUnit);

function $r2k(inputSpecs) {
  return inputSpecs.map(function (x) {
    return x.rate === C.RATE_AUDIO ? "a" : x.rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}
dspProcess["aaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mulIn = this.inputs[1];
  var addIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mulIn[i] + addIn[i];
  }
};
dspProcess["aak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mulIn = this.inputs[1];
  var add = this._add;
  var nextAdd = this.inputs[2][0];
  var addSlope = (nextAdd - add) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mulIn[i] + (add + addSlope * i);
  }
  this._add = nextAdd;
};
dspProcess["aai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mulIn = this.inputs[1];
  var add = this._add;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mulIn[i] + add;
  }
};
dspProcess["aka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var addIn = this.inputs[2];
  var nextMul = this.inputs[1][0];
  var mulSlope = (nextMul - mul) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mulSlope * i) + addIn[i];
  }
  this._mul = nextMul;
};
dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var nextMul = this.inputs[1][0];
  var mulSlope = (nextMul - mul) * this._slopeFactor;
  var nextAdd = this.inputs[2][0];
  var addSlope = (nextAdd - add) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mulSlope * i) + (add + addSlope * i);
  }
  this._mul = nextMul;
  this._add = nextAdd;
};
dspProcess["aki"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var nextMul = this.inputs[1][0];
  var mulSlope = (nextMul - mul) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mulSlope * i) + add;
  }
  this._mul = nextMul;
};
dspProcess["aia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var addIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mul + addIn[i];
  }
};
dspProcess["aik"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var nextAdd = this.inputs[2][0];
  var addSlope = (nextAdd - add) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mul + (add + addSlope * i);
  }
  this._add = nextAdd;
};
dspProcess["aii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var nextMul = this.inputs[1][0];
  var mulSlope = (nextMul - mul) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mulSlope * i) + add;
  }
  this._mul = nextMul;
};
dspProcess["kka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var _in = this._in;
  var mul = this._mul;
  var addIn = this.inputs[2];
  var nextIn = this.inputs[0][0];
  var inSlope = (nextIn - _in) * this._slopeFactor;
  var nextMul = this.inputs[1][0];
  var mulSlope = (nextMul - mul) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = (_in + inSlope * i) * (mul + mulSlope * i) + addIn[i];
  }
  this._in = nextIn;
  this._mul = nextMul;
};
dspProcess["kkk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this.inputs[1][0] + this.inputs[2][0];
};
dspProcess["kki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this.inputs[1][0] + this._add;
};
dspProcess["kia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var _in = this._in;
  var mul = this._mul;
  var addIn = this.inputs[2];
  var nextIn = this.inputs[0][0];
  var inSlope = (nextIn - _in) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = (_in + inSlope * i) * mul + addIn[i];
  }
  this._in = nextIn;
};
dspProcess["kik"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this._mul + this.inputs[2][0];
};
dspProcess["kii"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this._mul + this._add;
};
dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples) {
    var a = demand.next(this, 0, inNumSamples);
    var b = demand.next(this, 1, inNumSamples);
    var c = demand.next(this, 2, inNumSamples);
    this.outputs[0][0] = isNaN(a) || isNaN(b) || isNaN(c) ? NaN : a * b + c;
  } else {
    demand.reset(this, 0);
    demand.reset(this, 1);
    demand.reset(this, 2);
  }
};
SCUnitRepository.registerSCUnitClass("MulAdd", SCUnitMulAdd);
module.exports = SCUnitMulAdd;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_demand":168}],105:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNRand = function (_SCUnit) {
  _inherits(SCUnitNRand, _SCUnit);

  function SCUnitNRand() {
    _classCallCheck(this, SCUnitNRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNRand).apply(this, arguments));
  }

  _createClass(SCUnitNRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var n = this.inputs[2][0] | 0;
      if (n) {
        var sum = 0;
        for (var i = 0; i < n; i++) {
          sum += Math.random();
        }
        this.outputs[0][0] = sum / n * (hi - lo) + lo;
      }
    }
  }]);

  return SCUnitNRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NRand", SCUnitNRand);
module.exports = SCUnitNRand;
},{"../SCUnit":12,"../SCUnitRepository":13}],106:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumAudioBuses = function (_SCUnit) {
  _inherits(SCUnitNumAudioBuses, _SCUnit);

  function SCUnitNumAudioBuses() {
    _classCallCheck(this, SCUnitNumAudioBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumAudioBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumAudioBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfAudioBus;
    }
  }]);

  return SCUnitNumAudioBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumAudioBuses", SCUnitNumAudioBuses);
module.exports = SCUnitNumAudioBuses;
},{"../SCUnit":12,"../SCUnitRepository":13}],107:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumControlBuses = function (_SCUnit) {
  _inherits(SCUnitNumControlBuses, _SCUnit);

  function SCUnitNumControlBuses() {
    _classCallCheck(this, SCUnitNumControlBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumControlBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumControlBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfControlBus;
    }
  }]);

  return SCUnitNumControlBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumControlBuses", SCUnitNumControlBuses);
module.exports = SCUnitNumControlBuses;
},{"../SCUnit":12,"../SCUnitRepository":13}],108:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumInputBuses = function (_SCUnit) {
  _inherits(SCUnitNumInputBuses, _SCUnit);

  function SCUnitNumInputBuses() {
    _classCallCheck(this, SCUnitNumInputBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumInputBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumInputBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfChannels;
    }
  }]);

  return SCUnitNumInputBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumInputBuses", SCUnitNumInputBuses);
module.exports = SCUnitNumInputBuses;
},{"../SCUnit":12,"../SCUnitRepository":13}],109:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumOutputBuses = function (_SCUnit) {
  _inherits(SCUnitNumOutputBuses, _SCUnit);

  function SCUnitNumOutputBuses() {
    _classCallCheck(this, SCUnitNumOutputBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumOutputBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumOutputBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfChannels;
    }
  }]);

  return SCUnitNumOutputBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumOutputBuses", SCUnitNumOutputBuses);
module.exports = SCUnitNumOutputBuses;
},{"../SCUnit":12,"../SCUnitRepository":13}],110:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitOnePole = function (_SCUnit) {
  _inherits(SCUnitOnePole, _SCUnit);

  function SCUnitOnePole() {
    _classCallCheck(this, SCUnitOnePole);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOnePole).apply(this, arguments));
  }

  _createClass(SCUnitOnePole, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._b1 = this.inputs[1][0];
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitOnePole;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var next_b1 = Math.max(-1, Math.min(this.inputs[1][0], 1));
  var y1 = this._y1;
  if (b1 !== next_b1) {
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    if (b1 > 0 && next_b1 >= 0) {
      for (var i = 0; i < inNumSamples; i++) {
        var y0 = inIn[i];
        out[i] = y1 = y0 + (b1 + b1_slope * i) * (y1 - y0);
      }
    } else if (b1 <= 0 && next_b1 <= 0) {
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _y = inIn[_i];
        out[_i] = y1 = _y + (b1 + b1_slope * _i) * (y1 + _y);
      }
    } else {
      for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
        var _y2 = inIn[_i2];
        out[_i2] = y1 = (1 - Math.abs(b1 + b1_slope * _i2)) * _y2 + b1 * y1;
      }
    }
    this._b1 = next_b1;
  } else {
    if (b1 >= 0) {
      for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
        var _y3 = inIn[_i3];
        out[_i3] = y1 = _y3 + b1 * (y1 - _y3);
      }
    } else {
      for (var _i4 = 0; _i4 < inNumSamples; _i4++) {
        var _y4 = inIn[_i4];
        out[_i4] = y1 = _y4 + b1 * (y1 + _y4);
      }
    }
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("OnePole", SCUnitOnePole);
module.exports = SCUnitOnePole;
},{"../SCUnit":12,"../SCUnitRepository":13}],111:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitOneZero = function (_SCUnit) {
  _inherits(SCUnitOneZero, _SCUnit);

  function SCUnitOneZero() {
    _classCallCheck(this, SCUnitOneZero);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOneZero).apply(this, arguments));
  }

  _createClass(SCUnitOneZero, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._b1 = this.inputs[1][0];
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitOneZero;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var next_b1 = Math.max(-1, Math.min(this.inputs[1][0], 1));
  var x1 = this._x1;
  if (b1 !== next_b1) {
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    if (b1 >= 0 && next_b1 >= 0) {
      for (var i = 0; i < inNumSamples; i++) {
        var x0 = inIn[i];
        out[i] = x0 + (b1 + b1_slope * i) * (x1 - x0);
        x1 = x0;
      }
    } else if (b1 <= 0 && next_b1 <= 0) {
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _x = inIn[_i];
        out[_i] = _x + (b1 + b1_slope * _i) * (x1 + _x);
        x1 = _x;
      }
    } else {
      for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
        var _x2 = inIn[_i2];
        out[_i2] = (1 - Math.abs(b1 + b1_slope * _i2)) * _x2 + b1 * x1;
        x1 = _x2;
      }
    }
    this._b1 = next_b1;
  } else {
    if (b1 >= 0) {
      for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
        var _x3 = inIn[_i3];
        out[_i3] = _x3 + b1 * (x1 - _x3);
        x1 = _x3;
      }
    } else {
      for (var _i4 = 0; _i4 < inNumSamples; _i4++) {
        var _x4 = inIn[_i4];
        out[_i4] = _x4 + b1 * (x1 + _x4);
        x1 = _x4;
      }
    }
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("OneZero", SCUnitOneZero);
module.exports = SCUnitOneZero;
},{"../SCUnit":12,"../SCUnitRepository":13}],112:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitOut = function (_SCUnit) {
  _inherits(SCUnitOut, _SCUnit);

  function SCUnitOut() {
    _classCallCheck(this, SCUnitOut);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOut).apply(this, arguments));
  }

  _createClass(SCUnitOut, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitOut;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = (inputs[0][0] | 0) - 1;
  for (var i = 1, imax = inputs.length; i < imax; i++) {
    var bus = buses[firstBusChannel + i];
    var _in = inputs[i];
    for (var j = 0; j < inNumSamples; j++) {
      bus[j] += _in[j];
    }
  }
};
dspProcess["k"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var offset = (inputs[0][0] | 0) - 1;
  for (var i = 1, imax = inputs.length; i < imax; i++) {
    buses[offset + i][0] += inputs[i][0];
  }
};
SCUnitRepository.registerSCUnitClass("Out", SCUnitOut);
module.exports = SCUnitOut;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],113:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var gSine = sine.gSine;

var SCUnitPan2 = function (_SCUnit) {
  _inherits(SCUnitPan2, _SCUnit);

  function SCUnitPan2() {
    _classCallCheck(this, SCUnitPan2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPan2).apply(this, arguments));
  }

  _createClass(SCUnitPan2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._pos = this.inputs[1][0];
      this._level = this.inputs[2][0];
      var ipos = 1024 * this._pos + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      this._leftAmp = this._level * gSine[2048 - ipos];
      this._rightAmp = this._level * gSine[ipos];
      this.dspProcess(1);
    }
  }]);

  return SCUnitPan2;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var inIn = this.inputs[0];
  var posIn = this.inputs[1];
  var nextLevel = this.inputs[2][0];
  var level = this._level;
  var ipos = void 0;
  if (level !== nextLevel) {
    var level_slope = (nextLevel - level) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var _in = inIn[i];
      ipos = 1024 * posIn[i] + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      var amp = level + level_slope * i;
      var leftAmp = amp * gSine[2048 - ipos];
      var rightAmp = amp * gSine[ipos];
      leftOut[i] = _in * leftAmp;
      rightOut[i] = _in * rightAmp;
    }
    this._level = nextLevel;
  } else {
    var _amp = level;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _in2 = inIn[_i];
      ipos = 1024 * posIn[_i] + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      var _leftAmp = _amp * gSine[2048 - ipos];
      var _rightAmp = _amp * gSine[ipos];
      leftOut[_i] = _in2 * _leftAmp;
      rightOut[_i] = _in2 * _rightAmp;
    }
  }
};
dspProcess["next_k"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var inIn = this.inputs[0];
  var nextPos = this.inputs[1][0];
  var nextLevel = this.inputs[2][0];
  var leftAmp = this._leftAmp;
  var rightAmp = this._rightAmp;
  var ipos = void 0;
  if (this._pos !== nextPos || this._level !== nextLevel) {
    ipos = 1024 * nextPos + 1024 + 0.5 | 0;
    ipos = Math.max(0, Math.min(ipos, 2048));
    var nextLeftAmp = nextLevel * gSine[2048 - ipos];
    var nextRightAmp = nextLevel * gSine[ipos];
    var leftAmp_slope = (nextLeftAmp - leftAmp) * this._slopeFactor;
    var rightAmp_slope = (nextRightAmp - rightAmp) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var _in = inIn[i];
      leftOut[i] = _in * (leftAmp + leftAmp_slope * i);
      rightOut[i] = _in * (rightAmp + rightAmp_slope * i);
    }
    this._pos = nextPos;
    this._level = nextLevel;
    this._leftAmp = nextLeftAmp;
    this._rightAmp = nextRightAmp;
  } else {
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      var _in3 = inIn[_i2];
      leftOut[_i2] = _in3 * leftAmp;
      rightOut[_i2] = _in3 * rightAmp;
    }
  }
};
SCUnitRepository.registerSCUnitClass("Pan2", SCUnitPan2);
module.exports = SCUnitPan2;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],114:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var $r2k = ["i", "k", "a"];

var SCUnitPeak = function (_SCUnit) {
  _inherits(SCUnitPeak, _SCUnit);

  function SCUnitPeak() {
    _classCallCheck(this, SCUnitPeak);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPeak).apply(this, arguments));
  }

  _createClass(SCUnitPeak, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._level = this.inputs[0][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitPeak;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var inlevel = Math.abs(inIn[i]);
    out[i] = level = Math.max(inlevel, level);
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var curtrig = this.inputs[1][0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var inlevel = Math.abs(inIn[i]);
    out[i] = level = Math.max(inlevel, level);
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var inlevel = Math.abs(inIn[i]);
    out[i] = level = Math.max(inlevel, level);
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Peak", SCUnitPeak);
module.exports = SCUnitPeak;
},{"../SCUnit":12,"../SCUnitRepository":13}],115:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitPeakFollower = function (_SCUnit) {
  _inherits(SCUnitPeakFollower, _SCUnit);

  function SCUnitPeakFollower() {
    _classCallCheck(this, SCUnitPeakFollower);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPeakFollower).apply(this, arguments));
  }

  _createClass(SCUnitPeakFollower, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._decay = this.inputs[1][0];
      this.outputs[0][0] = this._level = this.inputs[0][0];
    }
  }]);

  return SCUnitPeakFollower;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var decay = this.inputs[1][0];
  var level = this._level;
  if (decay === this._decay) {
    for (var i = 0; i < inNumSamples; i++) {
      var inlevel = Math.abs(inIn[i]);
      if (inlevel >= level) {
        level = inlevel;
      } else {
        level = inlevel + decay * (level - inlevel);
      }
      out[i] = level;
    }
  } else {
    var decay_slope = (decay - this._decay) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _inlevel = Math.abs(inIn[_i]);
      if (_inlevel >= level) {
        level = _inlevel;
      } else {
        level = (1 - Math.abs(decay + decay_slope * _i)) * _inlevel + decay * level;
      }
      out[_i] = level;
    }
  }
  this._level = level;
  this._decay = decay;
};
SCUnitRepository.registerSCUnitClass("PeakFollower", SCUnitPeakFollower);
module.exports = SCUnitPeakFollower;
},{"../SCUnit":12,"../SCUnitRepository":13}],116:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_wrap = require("../util/wrap");
var dspProcess = {};

var SCUnitPhasor = function (_SCUnit) {
  _inherits(SCUnitPhasor, _SCUnit);

  function SCUnitPhasor() {
    _classCallCheck(this, SCUnitPhasor);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPhasor).apply(this, arguments));
  }

  _createClass(SCUnitPhasor, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._prevtrig = this.inputs[0][0];
      this.outputs[0][0] = this._level = this.inputs[2][0];
    }
  }]);

  return SCUnitPhasor;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var rate = this.inputs[1][0];
  var start = this.inputs[2][0];
  var end = this.inputs[3][0];
  var resetPos = this.inputs[4][0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      var frac = 1 - prevtrig / (curtrig - prevtrig);
      level = resetPos + frac * rate;
    }
    out[i] = level;
    level += rate;
    level = sc_wrap(level, start, end);
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Phasor", SCUnitPhasor);
module.exports = SCUnitPhasor;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/wrap":182}],117:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var MAX_KEY = 31;

var SCUnitPinkNoise = function (_SCUnit) {
  _inherits(SCUnitPinkNoise, _SCUnit);

  function SCUnitPinkNoise() {
    _classCallCheck(this, SCUnitPinkNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPinkNoise).apply(this, arguments));
  }

  _createClass(SCUnitPinkNoise, [{
    key: "initialize",
    value: function initialize() {
      var whites = new Uint8Array(5);
      for (var i = 0; i < 5; i++) {
        whites[i] = (Math.random() * 1073741824 | 0) % 25;
      }
      this.dspProcess = dspProcess["next"];
      this._whites = whites;
      this._key = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitPinkNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var whites = this._whites;
  var key = this._key | 0;
  for (var i = 0; i < inNumSamples; i++) {
    var last_key = key++;
    if (key > MAX_KEY) {
      key = 0;
    }
    var diff = last_key ^ key;
    var sum = 0;
    for (var j = 0; j < 5; j++) {
      if (diff & 1 << j) {
        whites[j] = (Math.random() * 1073741824 | 0) % 25;
      }
      sum += whites[j];
    }
    out[i] = sum * 0.01666666 - 1;
  }
  this._key = key;
};
SCUnitRepository.registerSCUnitClass("PinkNoise", SCUnitPinkNoise);
module.exports = SCUnitPinkNoise;
},{"../SCUnit":12,"../SCUnitRepository":13}],118:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var gSine = sine.gSine;
var gInvSine = sine.gInvSine;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;
var kBadValue = sine.kBadValue;

var SCUnitPulse = function (_SCUnit) {
  _inherits(SCUnitPulse, _SCUnit);

  function SCUnitPulse() {
    _classCallCheck(this, SCUnitPulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPulse).apply(this, arguments));
  }

  _createClass(SCUnitPulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._cpstoinc = kSineSize * rate.sampleDur * 0.5;
      this._N = Math.max(1, rate.sampleRate * 0.5 / this._freq | 0);
      this._mask = kSineMask;
      this._scale = 0.5 / this._N;
      this._phase = 0;
      this._duty = 0;
      this._y1 = 0;
    }
  }]);

  return SCUnitPulse;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var duty = this._duty;
  var phase = this._phase;
  var y1 = this._y1;
  var mask = this._mask;
  var numtbl = gSine,
      dentbl = gInvSine;
  var N = void 0,
      N2 = void 0,
      prevN = void 0,
      prevN2 = void 0,
      scale = void 0,
      prevScale = void 0,
      crossfade = void 0;
  var tblIndex = void 0,
      t0 = void 0,
      t1 = void 0,
      pfrac = void 0,
      denom = void 0,
      rphase = void 0,
      numer = void 0,
      n1 = void 0,
      n2 = void 0;
  var phase2 = void 0,
      nextDuty = void 0,
      duty_slope = void 0,
      rscale = void 0,
      pul1 = void 0,
      pul2 = void 0;
  var i = void 0,
      xfade = void 0,
      xfade_slope = void 0;
  if (freq !== this._freq) {
    N = Math.max(1, this._sampleRate * 0.5 / freq | 0);
    if (N !== this._N) {
      freq = this._cpstoinc * Math.max(this._freq, freq);
      crossfade = true;
    } else {
      freq = this._cpstoinc * freq;
      crossfade = false;
    }
    prevN = this._N;
    prevScale = this._scale;
    this._N = N;
    this._scale = scale = 0.5 / N;
  } else {
    N = this._N;
    freq = this._cpstoinc * freq;
    scale = this._scale;
    crossfade = false;
  }
  N2 = 2 * N + 1;
  nextDuty = this.inputs[1][0];
  duty_slope = (nextDuty - duty) * this._slopeFactor;
  rscale = 1 / scale + 1;
  if (crossfade) {
    prevN2 = 2 * prevN + 1;
    xfade_slope = this._slopeFactor;
    xfade = 0;
    for (i = 0; i < inNumSamples; i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul1 = 1;
        } else {
          rphase = phase * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          pul1 = n1 + xfade * (n2 - n1);
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        pul1 = n1 + xfade * (n2 - n1);
      }
      phase2 = phase + duty * kSineSize * 0.5;
      tblIndex = phase2 & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul2 = 1;
        } else {
          rphase = phase2 * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase2 * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          pul2 = n1 + xfade * (n2 - n1);
        }
      } else {
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase2 * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase2 * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        pul2 = n1 + xfade * (n2 - n1);
      }
      out[i] = y1 = pul1 - pul2 + 0.999 * y1;
      phase += freq;
      duty += duty_slope;
      xfade += xfade_slope;
    }
  } else {
    for (i = 0; i < inNumSamples; i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul1 = rscale;
        } else {
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          pul1 = numer / denom;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        pul1 = numer * denom;
      }
      phase2 = phase + duty * kSineSize * 0.5;
      tblIndex = phase2 & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul2 = rscale;
        } else {
          rphase = phase2 * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          pul2 = numer / denom;
        }
      } else {
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase2 * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        pul2 = numer * denom;
      }
      out[i] = y1 = (pul1 - pul2) * scale + 0.999 * y1;
      phase += freq;
      duty += duty_slope;
    }
  }
  if (phase >= 65536) {
    phase -= 65536;
  }
  this._y1 = y1;
  this._phase = phase;
  this._freq = this.inputs[0][0];
  this._duty = nextDuty;
};
SCUnitRepository.registerSCUnitClass("Pulse", SCUnitPulse);
module.exports = SCUnitPulse;
},{"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],119:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var $r2k = ["i", "k", "a"];

var SCUnitPulseCount = function (_SCUnit) {
  _inherits(SCUnitPulseCount, _SCUnit);

  function SCUnitPulseCount() {
    _classCallCheck(this, SCUnitPulseCount);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPulseCount).apply(this, arguments));
  }

  _createClass(SCUnitPulseCount, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._prevreset = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitPulseCount;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var curreset = resetIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = 0;
    } else if (prevtrig <= 0 && curtrig > 0) {
      level += 1;
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var curreset = this.inputs[1][0];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = 0;
    } else if (prevtrig <= 0 && curtrig > 0) {
      level += 1;
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level += 1;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._level = level;
  this._prevtrig = prevtrig;
};
SCUnitRepository.registerSCUnitClass("PulseCount", SCUnitPulseCount);
module.exports = SCUnitPulseCount;
},{"../SCUnit":12,"../SCUnitRepository":13}],120:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitPulseDivider = function (_SCUnit) {
  _inherits(SCUnitPulseDivider, _SCUnit);

  function SCUnitPulseDivider() {
    _classCallCheck(this, SCUnitPulseDivider);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPulseDivider).apply(this, arguments));
  }

  _createClass(SCUnitPulseDivider, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._prevtrig = 0;
      this._level = 0;
      this._counter = Math.floor(this.inputs[2][0] + 0.5);
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitPulseDivider;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var div = this.inputs[1][0] | 0;
  var prevtrig = this._prevtrig;
  var counter = this._counter;
  var z = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      counter += 1;
      if (counter >= div) {
        counter = 0;
        z = 1;
      } else {
        z = 0;
      }
    } else {
      z = 0;
    }
    out[i] = z;
    prevtrig = curtrig;
  }
  this._counter = counter;
  this._prevtrig = prevtrig;
};
SCUnitRepository.registerSCUnitClass("PulseDivider", SCUnitPulseDivider);
module.exports = SCUnitPulseDivider;
},{"../SCUnit":12,"../SCUnitRepository":13}],121:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitRHPF = function (_SCUnit) {
  _inherits(SCUnitRHPF, _SCUnit);

  function SCUnitRHPF() {
    _classCallCheck(this, SCUnitRHPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRHPF).apply(this, arguments));
  }

  _createClass(SCUnitRHPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitRHPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || reson !== this._reson) {
    var qres = Math.max(0.001, reson);
    var pfreq = freq * this._radiansPerSample;
    var D = Math.tan(pfreq * qres * 0.5);
    var C = (1 - D) / (1 + D);
    var cosf = Math.cos(pfreq);
    var next_b1 = (1 + C) * cosf;
    var next_b2 = -C;
    var next_a0 = (1 + C + next_b1) * 0.25;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = (a0 + a0_slope * i) * inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = y0 - 2 * y1 + y2;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._reson = reson;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = a0 * inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = _y - 2 * y1 + y2;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("RHPF", SCUnitRHPF);
module.exports = SCUnitRHPF;
},{"../SCUnit":12,"../SCUnitRepository":13}],122:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitRLPF = function (_SCUnit) {
  _inherits(SCUnitRLPF, _SCUnit);

  function SCUnitRLPF() {
    _classCallCheck(this, SCUnitRLPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRLPF).apply(this, arguments));
  }

  _createClass(SCUnitRLPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitRLPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || reson !== this._reson) {
    var qres = Math.max(0.001, reson);
    var pfreq = freq * this._radiansPerSample;
    var D = Math.tan(pfreq * qres * 0.5);
    var C = (1 - D) / (1 + D);
    var cosf = Math.cos(pfreq);
    var next_b1 = (1 + C) * cosf;
    var next_b2 = -C;
    var next_a0 = (1 + C - next_b1) * 0.25;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = (a0 + a0_slope * i) * inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = y0 + 2 * y1 + y2;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._reson = reson;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = a0 * inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = _y + 2 * y1 + y2;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("RLPF", SCUnitRLPF);
module.exports = SCUnitRLPF;
},{"../SCUnit":12,"../SCUnitRepository":13}],123:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitRadiansPerSample = function (_SCUnit) {
  _inherits(SCUnitRadiansPerSample, _SCUnit);

  function SCUnitRadiansPerSample() {
    _classCallCheck(this, SCUnitRadiansPerSample);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRadiansPerSample).apply(this, arguments));
  }

  _createClass(SCUnitRadiansPerSample, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.aRate.radiansPerSample;
    }
  }]);

  return SCUnitRadiansPerSample;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("RadiansPerSample", SCUnitRadiansPerSample);
module.exports = SCUnitRadiansPerSample;
},{"../SCUnit":12,"../SCUnitRepository":13}],124:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitRamp = function (_SCUnit) {
  _inherits(SCUnitRamp, _SCUnit);

  function SCUnitRamp() {
    _classCallCheck(this, SCUnitRamp);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRamp).apply(this, arguments));
  }

  _createClass(SCUnitRamp, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      this._sampleRate = rate.sampleRate;
      this._counter = 1;
      this._level = this.inputs[0][0];
      this._slope = 0;
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitRamp;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var period = this.inputs[1][0];
  var sampleRate = this._sampleRate;
  var slope = this._slope;
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  while (remain) {
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
      level += slope;
    }
    counter -= nsmps;
    remain -= nsmps;
    if (counter <= 0) {
      counter = period * sampleRate | 0;
      counter = Math.max(1, counter);
      slope = (inIn[j - 1] - level) / counter;
    }
  }
  this._level = level;
  this._slope = slope;
  this._counter = counter;
};
dspProcess["1"] = function () {
  var out = this.outputs[0];
  out[0] = this._level;
  this._level += this._slope;
  this._counter -= 1;
  if (this._counter <= 0) {
    var _in = this.inputs[0][0];
    var period = this.inputs[1][0];
    var counter = period * this._sampleRate | 0;
    this._counter = Math.max(1, counter);
    this._slope = (_in - this._level) / this._counter;
  }
};
SCUnitRepository.registerSCUnitClass("Ramp", SCUnitRamp);
module.exports = SCUnitRamp;
},{"../SCUnit":12,"../SCUnitRepository":13}],125:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitRand = function (_SCUnit) {
  _inherits(SCUnitRand, _SCUnit);

  function SCUnitRand() {
    _classCallCheck(this, SCUnitRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRand).apply(this, arguments));
  }

  _createClass(SCUnitRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var range = hi - lo;
      this.outputs[0][0] = Math.random() * range + lo;
    }
  }]);

  return SCUnitRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("Rand", SCUnitRand);
module.exports = SCUnitRand;
},{"../SCUnit":12,"../SCUnitRepository":13}],126:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitReplaceOut = function (_SCUnit) {
  _inherits(SCUnitReplaceOut, _SCUnit);

  function SCUnitReplaceOut() {
    _classCallCheck(this, SCUnitReplaceOut);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitReplaceOut).apply(this, arguments));
  }

  _createClass(SCUnitReplaceOut, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitReplaceOut;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = (inputs[0][0] | 0) - 1;
  for (var i = 1, imax = inputs.length; i < imax; i++) {
    var bus = buses[firstBusChannel + i];
    var _in = inputs[i];
    bus.set(_in.subarray(0, inNumSamples));
  }
};
dspProcess["k"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var offset = (inputs[0][0] | 0) - 1;
  for (var i = 1, imax = inputs.length; i < imax; i++) {
    buses[offset + i][0] = inputs[i][0];
  }
};
SCUnitRepository.registerSCUnitClass("ReplaceOut", SCUnitReplaceOut);
module.exports = SCUnitReplaceOut;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],127:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitResonz = function (_SCUnit) {
  _inherits(SCUnitResonz, _SCUnit);

  function SCUnitResonz() {
    _classCallCheck(this, SCUnitResonz);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitResonz).apply(this, arguments));
  }

  _createClass(SCUnitResonz, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._rq = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitResonz;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var rq = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || rq !== this._rq) {
    var ffreq = freq * this._radiansPerSample;
    var B = ffreq * rq;
    var R = 1 - B * 0.5;
    var twoR = 2 * R;
    var R2 = R * R;
    var cost = twoR * Math.cos(ffreq) / (1 + R2);
    var b1_next = twoR * cost;
    var b2_next = -R2;
    var a0_next = (1 - R2) * 0.5;
    var a0_slope = (a0_next - a0) * this._slopeFactor;
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._rq = rq;
    this._a0 = a0_next;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("Resonz", SCUnitResonz);
module.exports = SCUnitResonz;
},{"../SCUnit":12,"../SCUnitRepository":13}],128:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitRingz = function (_SCUnit) {
  _inherits(SCUnitRingz, _SCUnit);

  function SCUnitRingz() {
    _classCallCheck(this, SCUnitRingz);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRingz).apply(this, arguments));
  }

  _createClass(SCUnitRingz, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._decayTime = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitRingz;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var decayTime = this.inputs[2][0];
  var a0 = 0.5;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || decayTime !== this._decayTime) {
    var ffreq = freq * this._radiansPerSample;
    var R = decayTime === 0 ? 0 : Math.exp(log001 / (decayTime * this._sampleRate));
    var twoR = 2 * R;
    var R2 = R * R;
    var cost = twoR * Math.cos(ffreq) / (1 + R2);
    var b1_next = twoR * cost;
    var b2_next = -R2;
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = a0 * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._decayTime = decayTime;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("Ringz", SCUnitRingz);
module.exports = SCUnitRingz;
},{"../SCUnit":12,"../SCUnitRepository":13}],129:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitRunningMax = function (_SCUnit) {
  _inherits(SCUnitRunningMax, _SCUnit);

  function SCUnitRunningMax() {
    _classCallCheck(this, SCUnitRunningMax);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRunningMax).apply(this, arguments));
  }

  _createClass(SCUnitRunningMax, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._level = this.inputs[0][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitRunningMax;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var inlevel = inIn[i];
    if (inlevel > level) {
      level = inlevel;
    }
    out[i] = level;
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var curtrig = this.inputs[1][0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel > level) {
      level = inlevel;
    }
    out[i] = level;
  }
  if (this._prevtrig <= 0 && curtrig > 0) {
    level = inlevel;
  }
  this._prevtrig = curtrig;
  this._level = level;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel > level) {
      level = inlevel;
    }
    out[i] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("RunningMax", SCUnitRunningMax);
module.exports = SCUnitRunningMax;
},{"../SCUnit":12,"../SCUnitRepository":13}],130:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitRunningMin = function (_SCUnit) {
  _inherits(SCUnitRunningMin, _SCUnit);

  function SCUnitRunningMin() {
    _classCallCheck(this, SCUnitRunningMin);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRunningMin).apply(this, arguments));
  }

  _createClass(SCUnitRunningMin, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._level = this.inputs[0][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitRunningMin;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var inlevel = inIn[i];
    if (inlevel < level) {
      level = inlevel;
    }
    out[i] = level;
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var curtrig = this.inputs[1][0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel < level) {
      level = inlevel;
    }
    out[i] = level;
  }
  if (this._prevtrig <= 0 && curtrig > 0) {
    level = inlevel;
  }
  this._prevtrig = curtrig;
  this._level = level;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel < level) {
      level = inlevel;
    }
    out[i] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("RunningMin", SCUnitRunningMin);
module.exports = SCUnitRunningMin;
},{"../SCUnit":12,"../SCUnitRepository":13}],131:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSOS = function (_SCUnit) {
  _inherits(SCUnitSOS, _SCUnit);

  function SCUnitSOS() {
    _classCallCheck(this, SCUnitSOS);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSOS).apply(this, arguments));
  }

  _createClass(SCUnitSOS, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength !== 1) {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO && this.inputSpecs[3].rate === C.RATE_AUDIO && this.inputSpecs[4].rate === C.RATE_AUDIO && this.inputSpecs[5].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_a"];
        } else if (this.inputSpecs[1].rate === C.RATE_SCALAR && this.inputSpecs[2].rate === C.RATE_SCALAR && this.inputSpecs[3].rate === C.RATE_SCALAR && this.inputSpecs[4].rate === C.RATE_SCALAR && this.inputSpecs[5].rate === C.RATE_SCALAR) {
          this.dspProcess = dspProcess["next_i"];
        } else {
          this.dspProcess = dspProcess["next_k"];
        }
      } else {
        this.dspProcess = dspProcess["next_1"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._y1 = 0;
      this._y2 = 0;
      this._a0 = this.inputs[1][0];
      this._a1 = this.inputs[2][0];
      this._a2 = this.inputs[3][0];
      this._b1 = this.inputs[4][0];
      this._b2 = this.inputs[5][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitSOS;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var a0In = this.inputs[1];
  var a1In = this.inputs[2];
  var a2In = this.inputs[3];
  var b1In = this.inputs[4];
  var b2In = this.inputs[5];
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + b1In[i] * y1 + b2In[i] * y2;
    out[i] = a0In[i] * y0 + a1In[i] * y1 + a2In[i] * y2;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_a0 = this.inputs[1][0];
  var next_a1 = this.inputs[2][0];
  var next_a2 = this.inputs[3][0];
  var next_b1 = this.inputs[4][0];
  var next_b2 = this.inputs[5][0];
  var a0 = this._a0;
  var a1 = this._a1;
  var a2 = this._a2;
  var b1 = this._b1;
  var b2 = this._b2;
  var a0_slope = (next_a0 - a0) * this._slopeFactor;
  var a1_slope = (next_a1 - a1) * this._slopeFactor;
  var a2_slope = (next_a2 - a2) * this._slopeFactor;
  var b1_slope = (next_b1 - b1) * this._slopeFactor;
  var b2_slope = (next_b2 - b2) * this._slopeFactor;
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
    out[i] = (a0 + a0_slope * i) * y0 + (a1 + a1_slope * i) * y1 + (a2 + a2_slope * i) * y2;
    y2 = y1;
    y1 = y0;
  }
  this._a0 = a0;
  this._a1 = a1;
  this._a2 = a2;
  this._b1 = b1;
  this._b2 = b2;
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var a0 = this._a0;
  var a1 = this._a1;
  var a2 = this._a2;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + b1 * y1 + b2 * y2;
    out[i] = a0 * y0 + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var a0 = this.inputs[1][0];
  var a1 = this.inputs[2][0];
  var a2 = this.inputs[3][0];
  var b1 = this.inputs[4][0];
  var b2 = this.inputs[5][0];
  var y1 = this._y1;
  var y2 = this._y2;
  var y0 = _in + b1 * y1 + b2 * y2;
  this.outputs[0][0] = a0 * y0 + a1 * y1 + a2 * y2;
  y2 = y1;
  y1 = y0;
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("SOS", SCUnitSOS);
module.exports = SCUnitSOS;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],132:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitSampleDur = function (_SCUnit) {
  _inherits(SCUnitSampleDur, _SCUnit);

  function SCUnitSampleDur() {
    _classCallCheck(this, SCUnitSampleDur);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSampleDur).apply(this, arguments));
  }

  _createClass(SCUnitSampleDur, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.aRate.sampleDur;
    }
  }]);

  return SCUnitSampleDur;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("SampleDur", SCUnitSampleDur);
module.exports = SCUnitSampleDur;
},{"../SCUnit":12,"../SCUnitRepository":13}],133:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitSampleRate = function (_SCUnit) {
  _inherits(SCUnitSampleRate, _SCUnit);

  function SCUnitSampleRate() {
    _classCallCheck(this, SCUnitSampleRate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSampleRate).apply(this, arguments));
  }

  _createClass(SCUnitSampleRate, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.aRate.sampleRate;
    }
  }]);

  return SCUnitSampleRate;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("SampleRate", SCUnitSampleRate);
module.exports = SCUnitSampleRate;
},{"../SCUnit":12,"../SCUnitRepository":13}],134:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var numtbl = sine.gSine;
var dentbl = sine.gInvSine;
var kBadValue = sine.kBadValue;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;

var SCUnitSaw = function (_SCUnit) {
  _inherits(SCUnitSaw, _SCUnit);

  function SCUnitSaw() {
    _classCallCheck(this, SCUnitSaw);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSaw).apply(this, arguments));
  }

  _createClass(SCUnitSaw, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._cpstoinc = kSineSize * rate.sampleDur * 0.5;
      this._N = Math.max(1, rate.sampleRate * 0.5 / this._freq | 0);
      this._mask = kSineMask;
      this._scale = 0.5 / this._N;
      this._phase = 0;
      this._y1 = -0.46;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSaw;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var mask = this._mask;
  var freq = this.inputs[0][0];
  var phase = this._phase;
  var y1 = this._y1;
  var N = void 0,
      N2 = void 0,
      prevN = void 0,
      prevN2 = void 0,
      scale = void 0,
      prevScale = void 0,
      crossfade = void 0;
  var tblIndex = void 0,
      t0 = void 0,
      t1 = void 0,
      pfrac = void 0,
      denom = void 0,
      rphase = void 0,
      numer = void 0,
      n1 = void 0,
      n2 = void 0;
  var xfade = void 0,
      xfade_slope = void 0;
  if (freq !== this._freq) {
    N = Math.max(1, this._sampleRate * 0.5 / freq | 0);
    if (N !== this._N) {
      freq = this._cpstoinc * Math.max(this._freq, freq);
      crossfade = true;
    } else {
      freq = this._cpstoinc * freq;
      crossfade = false;
    }
    prevN = this._N;
    prevScale = this._scale;
    this._N = N;
    this._scale = scale = 0.5 / N;
  } else {
    N = this._N;
    freq = this._cpstoinc * freq;
    scale = this._scale;
    crossfade = false;
  }
  N2 = 2 * N + 1;
  if (crossfade) {
    prevN2 = 2 * prevN + 1;
    xfade_slope = this._slopeFactor;
    xfade = 0;
    for (var i = 0; i < inNumSamples; i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[i] = y1 = 1 + 0.999 * y1;
        } else {
          rphase = phase * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          out[i] = y1 = n1 + xfade * (n2 - n1) + 0.999 * y1;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        out[i] = y1 = n1 + xfade * (n2 - n1) + 0.999 * y1;
      }
      phase += freq;
      xfade += xfade_slope;
    }
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[_i] = y1 = 1 + 0.999 * y1;
        } else {
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          out[_i] = y1 = (numer / denom - 1) * scale + 0.999 * y1;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        out[_i] = y1 = (numer * denom - 1) * scale + 0.999 * y1;
      }
      phase += freq;
    }
  }
  if (phase >= 65536) {
    phase -= 65536;
  }
  this._y1 = y1;
  this._phase = phase;
  this._freq = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("Saw", SCUnitSaw);
module.exports = SCUnitSaw;
},{"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],135:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSelect = function (_SCUnit) {
  _inherits(SCUnitSelect, _SCUnit);

  function SCUnitSelect() {
    _classCallCheck(this, SCUnitSelect);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSelect).apply(this, arguments));
  }

  _createClass(SCUnitSelect, [{
    key: "initialize",
    value: function initialize() {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._maxIndex = this.inputs.length - 1;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSelect;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inputs = this.inputs;
  var whichIn = inputs[0];
  var maxIndex = this._maxIndex;
  for (var i = 0; i < inNumSamples; i++) {
    var index = Math.max(1, Math.min((whichIn[i] | 0) + 1, maxIndex));
    out[i] = inputs[index][i];
  }
};
dspProcess["next_k"] = function () {
  var index = Math.max(1, Math.min((this.inputs[0][0] | 0) + 1, this._maxIndex));
  this.outputs[0].set(this.inputs[index]);
};
dspProcess["next_1"] = function () {
  var index = Math.max(1, Math.min((this.inputs[0][0] | 0) + 1, this._maxIndex));
  this.outputs[0][0] = this.inputs[index][0];
};
SCUnitRepository.registerSCUnitClass("Select", SCUnitSelect);
module.exports = SCUnitSelect;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],136:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSetResetFF = function (_SCUnit) {
  _inherits(SCUnitSetResetFF, _SCUnit);

  function SCUnitSetResetFF() {
    _classCallCheck(this, SCUnitSetResetFF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSetResetFF).apply(this, arguments));
  }

  _createClass(SCUnitSetResetFF, [{
    key: "initialize",
    value: function initialize() {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._prevtrig = 0;
      this._prevreset = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitSetResetFF;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var curreset = resetIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = 0;
    } else if (prevtrig <= 0 && curtrig > 0) {
      level = 1;
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  var curtrig = void 0,
      curreset = void 0;
  curtrig = trigIn[0];
  curreset = resetIn[0];
  if (prevreset <= 0 && curreset > 0) {
    level = 0;
  } else if (prevtrig <= 0 && curtrig > 0) {
    level = 1;
  }
  out[0] = level;
  prevtrig = curtrig;
  prevreset = curreset;
  for (var i = 1; i < inNumSamples; i++) {
    curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level = 1;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
SCUnitRepository.registerSCUnitClass("SetResetFF", SCUnitSetResetFF);
module.exports = SCUnitSetResetFF;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],137:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");
var dspProcess = {};
var table = sine.gSineWavetable;
var mask = sine.kSineMask;

var SCUnitSinOsc = function (_SCUnit) {
  _inherits(SCUnitSinOsc, _SCUnit);

  function SCUnitSinOsc() {
    _classCallCheck(this, SCUnitSinOsc);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSinOsc).apply(this, arguments));
  }

  _createClass(SCUnitSinOsc, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess[$r2k(this.inputSpecs)] || null;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._phase = this.inputs[1][0];
      this._radtoinc = sine.kSineSize / (2 * Math.PI);
      this._cpstoinc = sine.kSineSize * (1 / rate.sampleRate);
      this._x = 0;
      if (this.dspProcess) {
        this.dspProcess(1);
      }
    }
  }]);

  return SCUnitSinOsc;
}(SCUnit);

function $r2k(inputSpecs) {
  return inputSpecs.map(function (x) {
    return x.rate === C.RATE_AUDIO ? "a" : x.rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}
dspProcess["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var phaseIn = this.inputs[1];
  var cpstoinc = this._cpstoinc;
  var radtoinc = this._radtoinc;
  var x = this._x;
  for (var i = 0; i < inNumSamples; i++) {
    var pphase = x + radtoinc * phaseIn[i];
    var index = (pphase & mask) << 1;
    out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
    x += freqIn[i] * cpstoinc;
  }
  this._x = x;
};
dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var nextPhase = this.inputs[1][0];
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var phase = this._phase;
  var x = this._x;
  if (nextPhase === phase) {
    phase *= radtoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + phase;
      var index = (pphase & mask) << 1;
      out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freqIn[i] * cpstoinc;
    }
  } else {
    var phaseSlope = (nextPhase - phase) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _pphase = x + radtoinc * phase;
      var _index = (_pphase & mask) << 1;
      out[_i] = table[_index] + (_pphase - (_pphase | 0)) * table[_index + 1];
      phase += phaseSlope;
      x += freqIn[_i] * cpstoinc;
    }
    this._phase = nextPhase;
  }
  this._x = x;
};
dspProcess["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var phase = this._phase * this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var x = this._x;
  for (var i = 0; i < inNumSamples; i++) {
    var pphase = x + phase;
    var index = (pphase & mask) << 1;
    out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
    x += cpstoinc * freqIn[i];
  }
  this._x = x;
};
dspProcess["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var nextFreq = this.inputs[0][0];
  var phaseIn = this.inputs[1];
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var freq = this._freq;
  var x = this._x;
  if (nextFreq === freq) {
    freq *= cpstoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + radtoinc * phaseIn[i];
      var index = (pphase & mask) << 1;
      out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freq;
    }
  } else {
    var freqSlope = (nextFreq - freq) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      var _pphase2 = x + radtoinc * phaseIn[_i2];
      var _index2 = (_pphase2 & mask) << 1;
      out[_i2] = table[_index2] + (_pphase2 - (_pphase2 | 0)) * table[_index2 + 1];
      x += freq * cpstoinc;
      freq += freqSlope;
    }
    this._freq = nextFreq;
  }
  this._x = x;
};
dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var nextFreq = this.inputs[0][0];
  var nextPhase = this.inputs[1][0];
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var freq = this._freq;
  var phase = this._phase;
  var x = this._x;
  if (nextFreq === freq && nextPhase === phase) {
    freq *= cpstoinc;
    phase *= radtoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + phase;
      var index = (pphase & mask) << 1;
      out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freq;
    }
  } else {
    var freqSlope = (nextFreq - freq) * this._slopeFactor;
    var phaseSlope = (nextPhase - phase) * this._slopeFactor;
    for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
      var _pphase3 = x + radtoinc * phase;
      var _index3 = (_pphase3 & mask) << 1;
      out[_i3] = table[_index3] + (_pphase3 - (_pphase3 | 0)) * table[_index3 + 1];
      x += freq * cpstoinc;
      freq += freqSlope;
      phase += phaseSlope;
    }
    this._freq = nextFreq;
    this._phase = nextPhase;
  }
  this._x = x;
};
dspProcess["ki"] = dspProcess["kk"];
dspProcess["ia"] = dspProcess["kk"];
dspProcess["ik"] = dspProcess["kk"];
dspProcess["ii"] = dspProcess["kk"];
SCUnitRepository.registerSCUnitClass("SinOsc", SCUnitSinOsc);
module.exports = SCUnitSinOsc;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],138:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");
var dspProcess = {};
var gSineWavetable = sine.gSineWavetable;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;

var SCUnitSinOscFB = function (_SCUnit) {
  _inherits(SCUnitSinOscFB, _SCUnit);

  function SCUnitSinOscFB() {
    _classCallCheck(this, SCUnitSinOscFB);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSinOscFB).apply(this, arguments));
  }

  _createClass(SCUnitSinOscFB, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._radtoinc = kSineSize / (Math.PI * 2);
      this._cpstoinc = kSineSize * rate.sampleDur;
      this._mask = kSineMask;
      this._table = gSineWavetable;
      this._freq = this.inputs[0][0];
      this._feedback = this.inputs[1][0] * this._radtoinc;
      this._y = 0;
      this._x = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSinOscFB;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var nextFreq = this.inputs[0][0];
  var nextFeedback = this.inputs[1][0];
  var mask = this._mask;
  var table = this._table;
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var freq = this._freq;
  var feedback = this._feedback;
  var y = this._y;
  var x = this._x;
  if (nextFreq === freq && nextFeedback === feedback) {
    freq *= cpstoinc;
    feedback *= radtoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + feedback * y;
      var index = (pphase & mask) << 1;
      out[i] = y = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freq;
    }
  } else {
    var freq_slope = (nextFreq - freq) * this._slopeFactor;
    var feedback_slope = (nextFeedback - feedback) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _pphase = x + radtoinc * (feedback + feedback_slope * _i) * y;
      var _index = (_pphase & mask) << 1;
      out[_i] = y = table[_index] + (_pphase - (_pphase | 0)) * table[_index + 1];
      x += (freq + freq_slope * _i) * cpstoinc;
    }
    this._freq = nextFreq;
    this._feedback = nextFeedback;
  }
  this._y = y;
  this._x = x;
};
SCUnitRepository.registerSCUnitClass("SinOscFB", SCUnitSinOscFB);
module.exports = SCUnitSinOscFB;
},{"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],139:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSlew = function (_SCUnit) {
  _inherits(SCUnitSlew, _SCUnit);

  function SCUnitSlew() {
    _classCallCheck(this, SCUnitSlew);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSlew).apply(this, arguments));
  }

  _createClass(SCUnitSlew, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._level = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitSlew;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var upf = +this.inputs[1][0] * this._sampleDur;
  var dnf = -this.inputs[2][0] * this._sampleDur;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var slope = inIn[i] - level;
    level += Math.max(dnf, Math.min(slope, upf));
    out[i] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Slew", SCUnitSlew);
module.exports = SCUnitSlew;
},{"../SCUnit":12,"../SCUnitRepository":13}],140:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSlope = function (_SCUnit) {
  _inherits(SCUnitSlope, _SCUnit);

  function SCUnitSlope() {
    _classCallCheck(this, SCUnitSlope);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSlope).apply(this, arguments));
  }

  _createClass(SCUnitSlope, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sr = rate.sampleRate;
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitSlope;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var sr = this._sr;
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = sr * (x0 - x1);
    x1 = x0;
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("Slope", SCUnitSlope);
module.exports = SCUnitSlope;
},{"../SCUnit":12,"../SCUnitRepository":13}],141:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_wrap = require("../util/wrap");
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitStepper = function (_SCUnit) {
  _inherits(SCUnitStepper, _SCUnit);

  function SCUnitStepper() {
    _classCallCheck(this, SCUnitStepper);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitStepper).apply(this, arguments));
  }

  _createClass(SCUnitStepper, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._prevreset = 0;
      this._level = this.inputs[5][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitStepper;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var zmin = this.inputs[2][0];
  var zmax = this.inputs[3][0];
  var step = this.inputs[4][0];
  var resetval = this.inputs[5][0];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var curreset = resetIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = sc_wrap(resetval, zmin, zmax);
    } else if (prevtrig <= 0 && curtrig > 0) {
      level = sc_wrap(level + step, zmin, zmax);
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var curreset = this.inputs[1][0];
  var zmin = this.inputs[2][0];
  var zmax = this.inputs[3][0];
  var step = this.inputs[4][0];
  var resetval = this.inputs[5][0];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = sc_wrap(resetval, zmin, zmax);
    } else if (prevtrig <= 0 && curtrig > 0) {
      level = sc_wrap(level + step, zmin, zmax);
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["0"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var zmin = this.inputs[2][0];
  var zmax = this.inputs[3][0];
  var step = this.inputs[4][0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level = sc_wrap(level + step, zmin, zmax);
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._level = level;
  this._prevtrig = prevtrig;
};
SCUnitRepository.registerSCUnitClass("Stepper", SCUnitStepper);
module.exports = SCUnitStepper;
},{"../SCUnit":12,"../SCUnitRepository":13,"../util/wrap":182}],142:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitSubsampleOffset = function (_SCUnit) {
  _inherits(SCUnitSubsampleOffset, _SCUnit);

  function SCUnitSubsampleOffset() {
    _classCallCheck(this, SCUnitSubsampleOffset);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSubsampleOffset).apply(this, arguments));
  }

  _createClass(SCUnitSubsampleOffset, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitSubsampleOffset;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("SubsampleOffset", SCUnitSubsampleOffset);
module.exports = SCUnitSubsampleOffset;
},{"../SCUnit":12,"../SCUnitRepository":13}],143:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitSum3 = function (_SCUnit) {
  _inherits(SCUnitSum3, _SCUnit);

  function SCUnitSum3() {
    _classCallCheck(this, SCUnitSum3);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSum3).apply(this, arguments));
  }

  _createClass(SCUnitSum3, [{
    key: "initialize",
    value: function initialize(rate) {
      this._slopeFactor = rate.slopeFactor;
      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspProcess["d"];
      } else {
        this.dspProcess = dspProcess[$r2k(this.inputSpecs)] || null;
        this._in0 = this.inputs[0][0];
        this._in1 = this.inputs[1][0];
        this._in2 = this.inputs[2][0];
        if (this.dspProcess) {
          this.dspProcess(1);
        } else {
          this.outputs[0][0] = this._in0 + this._in1 + this._in2;
        }
      }
    }
  }]);

  return SCUnitSum3;
}(SCUnit);

function $r2k(inputSpecs) {
  return inputSpecs.map(function (x) {
    return x.rate === C.RATE_AUDIO ? "a" : x.rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}
dspProcess["aaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i];
  }
};
dspProcess["aak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in2 = this._in2;
  var nextIn2 = this.inputs[2][0];
  var in2Slope = (nextIn2 - in2) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + (in2 + in2Slope * i);
  }
  this._in2 = nextIn2;
};
dspProcess["aai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in2 = this._in2;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + in2;
  }
};
dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in12 = this._in1 + this._in2;
  var nextIn12 = this.inputs[1][0] + this.inputs[2][0];
  var in12Slope = (nextIn12 - in12) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + (in12 + in12Slope * i);
  }
  this._in1 = this.inputs[1][0];
  this._in2 = this.inputs[2][0];
};
dspProcess["aki"] = dspProcess["akk"];
dspProcess["aii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in12 = this._in1 + this._in2;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + in12;
  }
};
dspProcess["kkk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this.inputs[1][0] + this.inputs[2][0];
};
dspProcess["kki"] = dspProcess["kkk"];
dspProcess["kii"] = dspProcess["kkk"];
dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples) {
    var a = demand.next(this, 0, inNumSamples);
    var b = demand.next(this, 1, inNumSamples);
    var c = demand.next(this, 2, inNumSamples);
    this.outputs[0][0] = isNaN(a) || isNaN(b) || isNaN(c) ? NaN : a + b + c;
  } else {
    demand.reset(this, 0);
    demand.reset(this, 1);
    demand.reset(this, 2);
  }
};
SCUnitRepository.registerSCUnitClass("Sum3", SCUnitSum3);
module.exports = SCUnitSum3;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_demand":168}],144:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitSum4 = function (_SCUnit) {
  _inherits(SCUnitSum4, _SCUnit);

  function SCUnitSum4() {
    _classCallCheck(this, SCUnitSum4);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSum4).apply(this, arguments));
  }

  _createClass(SCUnitSum4, [{
    key: "initialize",
    value: function initialize(rate) {
      this._slopeFactor = rate.slopeFactor;
      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspProcess["d"];
      } else {
        this.dspProcess = dspProcess[$r2k(this.inputSpecs)] || null;
        this._in0 = this.inputs[0][0];
        this._in1 = this.inputs[1][0];
        this._in2 = this.inputs[2][0];
        this._in3 = this.inputs[3][0];
        if (this.dspProcess) {
          this.dspProcess(1);
        } else {
          this.outputs[0][0] = this._in0 + this._in1 + this._in2 + this._in3;
        }
      }
    }
  }]);

  return SCUnitSum4;
}(SCUnit);

function $r2k(inputSpecs) {
  return inputSpecs.map(function (x) {
    return x.rate === C.RATE_AUDIO ? "a" : x.rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}
dspProcess["aaaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  var inIn3 = this.inputs[3];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i] + inIn3[i];
  }
};
dspProcess["aaak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  var in3 = this._in3;
  var nextIn3 = this.inputs[3][0];
  var in3Slope = (nextIn3 - in3) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i] + (in3 + in3Slope * i);
  }
  this._in3 = nextIn3;
};
dspProcess["aaai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  var in3 = this._in3;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i] + in3;
  }
};
dspProcess["aakk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in23 = this._in2 + this._in3;
  var nextIn23 = this.inputs[2][0] + this.inputs[3][0];
  var in23Slope = (nextIn23 - in23) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + (in23 + in23Slope * i);
  }
  this._in2 = this.inputs[2][0];
  this._in3 = this.inputs[2][0];
};
dspProcess["aaki"] = dspProcess["aakk"];
dspProcess["aaii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in23 = this._in2 + this._in3;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + in23;
  }
};
dspProcess["akkk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in123 = this._in1 + this._in2 + this._in3;
  var nextIn123 = this.inputs[1][0] + this.inputs[2][0] + this.inputs[3][0];
  var in123Slope = (nextIn123 - in123) * this._slopeFactor;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + (in123 + in123Slope * i);
  }
  this._in1 = this.inputs[1][0];
  this._in2 = this.inputs[2][0];
  this._in3 = this.inputs[3][0];
};
dspProcess["akki"] = dspProcess["akkk"];
dspProcess["akii"] = dspProcess["akkk"];
dspProcess["aiii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in123 = this._in1 + this._in2 + this._in3;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + in123;
  }
};
dspProcess["kkkk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this.inputs[1][0] + this.inputs[2][0] + this.inputs[3][0];
};
dspProcess["kkki"] = dspProcess["kkkk"];
dspProcess["kkii"] = dspProcess["kkkk"];
dspProcess["kiii"] = dspProcess["kkkk"];
dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples) {
    var a = demand.next(this, 0, inNumSamples);
    var b = demand.next(this, 1, inNumSamples);
    var c = demand.next(this, 2, inNumSamples);
    var d = demand.next(this, 3, inNumSamples);
    this.outputs[0][0] = isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d) ? NaN : a + b + c + d;
  } else {
    demand.reset(this, 0);
    demand.reset(this, 1);
    demand.reset(this, 2);
    demand.reset(this, 3);
  }
};
SCUnitRepository.registerSCUnitClass("Sum4", SCUnitSum4);
module.exports = SCUnitSum4;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_demand":168}],145:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSweep = function (_SCUnit) {
  _inherits(SCUnitSweep, _SCUnit);

  function SCUnitSweep() {
    _classCallCheck(this, SCUnitSweep);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSweep).apply(this, arguments));
  }

  _createClass(SCUnitSweep, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._prevtrig = this.inputs[0][0];
      this._level = 0;
    }
  }]);

  return SCUnitSweep;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var rate = this.inputs[1][0] * this._sampleDur;
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      var frac = -prevtrig / (curtrig - prevtrig);
      level = frac * rate;
    } else {
      level += rate;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Sweep", SCUnitSweep);
module.exports = SCUnitSweep;
},{"../SCUnit":12,"../SCUnitRepository":13}],146:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSyncSaw = function (_SCUnit) {
  _inherits(SCUnitSyncSaw, _SCUnit);

  function SCUnitSyncSaw() {
    _classCallCheck(this, SCUnitSyncSaw);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSyncSaw).apply(this, arguments));
  }

  _createClass(SCUnitSyncSaw, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_aa"];
        } else {
          this.dspProcess = dspProcess["next_ak"];
        }
      } else {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_ka"];
        } else {
          this.dspProcess = dspProcess["next_kk"];
        }
      }
      this._freqMul = 2 * rate.sampleDur;
      this._phase1 = 0;
      this._phase2 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSyncSaw;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1In = this.inputs[0];
  var freq2In = this.inputs[1];
  var freqMul = this._freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    var freq1x = freq1In[i] * freqMul;
    var freq2x = freq2In[i] * freqMul;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1In = this.inputs[0];
  var freq2In = this.inputs[1];
  var freqMul = this._freqMul;
  var freq2x = freq2In[0] * freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    var freq1x = freq1In[i] * freqMul;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
dspProcess["next_ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1In = this.inputs[0];
  var freq2In = this.inputs[1];
  var freqMul = this._freqMul;
  var freq1x = freq1In[0] * freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    var freq2x = freq2In[i] * freqMul;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1x = this.inputs[0][0] * this._freqMul;
  var freq2x = this.inputs[1][0] * this._freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
SCUnitRepository.registerSCUnitClass("SyncSaw", SCUnitSyncSaw);
module.exports = SCUnitSyncSaw;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],147:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitT2A = function (_SCUnit) {
  _inherits(SCUnitT2A, _SCUnit);

  function SCUnitT2A() {
    _classCallCheck(this, SCUnitT2A);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitT2A).apply(this, arguments));
  }

  _createClass(SCUnitT2A, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitT2A;
}(SCUnit);

dspProcess["next"] = function () {
  var out = this.outputs[0];
  var level = this.input[0][0];
  out.fill(0);
  if (this._level <= 0 && level > 0) {
    this.outputs[0][this.input[1][0] | 0] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("T2A", SCUnitT2A);
module.exports = SCUnitT2A;
},{"../SCUnit":12,"../SCUnitRepository":13}],148:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitT2K = function (_SCUnit) {
  _inherits(SCUnitT2K, _SCUnit);

  function SCUnitT2K() {
    _classCallCheck(this, SCUnitT2K);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitT2K).apply(this, arguments));
  }

  _createClass(SCUnitT2K, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.outputs[0][0] = this.input[0][0];
    }
  }]);

  return SCUnitT2K;
}(SCUnit);

dspProcess["next"] = function () {
  var inIn = this.input[0];
  var out = 0;
  for (var i = 0, imax = inIn.length; i < imax; i++) {
    var val = inIn[i];
    if (val > out) {
      out = val;
    }
  }
  this.outputs[0][0] = out;
};
SCUnitRepository.registerSCUnitClass("T2K", SCUnitT2K);
module.exports = SCUnitT2K;
},{"../SCUnit":12,"../SCUnitRepository":13}],149:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTExpRand = function (_SCUnit) {
  _inherits(SCUnitTExpRand, _SCUnit);

  function SCUnitTExpRand() {
    _classCallCheck(this, SCUnitTExpRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTExpRand).apply(this, arguments));
  }

  _createClass(SCUnitTExpRand, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._trig = this.inputs[2][0];
      var lo = this.inputs[0][0] || 0.01;
      var hi = this.inputs[1][0];
      var ratio = hi / lo;
      this.outputs[0][0] = this._value = Math.pow(ratio, Math.random()) * lo;
    }
  }]);

  return SCUnitTExpRand;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[2];
  var value = this._value;
  var prev = this._trig;
  var next = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    next = trigIn[i];
    if (next > 0 && prev <= 0) {
      var lo = this.inputs[0][0] || 0.01;
      var hi = this.inputs[1][0];
      var ratio = hi / lo;
      out[i] = value = Math.pow(ratio, Math.random()) * lo;
    } else {
      out[i] = value;
    }
    prev = next;
  }
  this._trig = next;
  this._value = value;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[2][0];
  if (trig > 0 && this._trig <= 0) {
    var lo = this.inputs[0][0] || 0.01;
    var hi = this.inputs[1][0];
    var ratio = hi / lo;
    out[0] = this._value = Math.pow(ratio, Math.random()) * lo;
  } else {
    out[0] = this._value;
  }
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("TExpRand", SCUnitTExpRand);
module.exports = SCUnitTExpRand;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],150:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTIRand = function (_SCUnit) {
  _inherits(SCUnitTIRand, _SCUnit);

  function SCUnitTIRand() {
    _classCallCheck(this, SCUnitTIRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTIRand).apply(this, arguments));
  }

  _createClass(SCUnitTIRand, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      var lo = this.inputs[0][0] | 0;
      var hi = this.inputs[1][0] | 0;
      this.outputs[0][0] = this._value = Math.random() * (hi - lo) + lo | 0;
      this._trig = this.inputs[2][0];
    }
  }]);

  return SCUnitTIRand;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[2];
  var value = this._value;
  var prev = this._trig;
  var next = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    next = trigIn[i];
    if (next > 0 && prev <= 0) {
      var lo = this.inputs[0][0] | 0;
      var hi = this.inputs[1][0] | 0;
      out[i] = value = Math.random() * (hi - lo) + lo | 0;
    } else {
      out[i] = value;
    }
    prev = next;
  }
  this._trig = next;
  this._value = value;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[2][0];
  if (trig > 0 && this._trig <= 0) {
    var lo = this.inputs[0][0] | 0;
    var hi = this.inputs[1][0] | 0;
    out[0] = this._value = Math.random() * (hi - lo) + lo | 0;
  } else {
    out[0] = this._value;
  }
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("TIRand", SCUnitTIRand);
module.exports = SCUnitTIRand;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],151:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTRand = function (_SCUnit) {
  _inherits(SCUnitTRand, _SCUnit);

  function SCUnitTRand() {
    _classCallCheck(this, SCUnitTRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTRand).apply(this, arguments));
  }

  _createClass(SCUnitTRand, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._trig = this.inputs[2][0];
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      this.outputs[0][0] = this._value = Math.random() * (hi - lo) + lo;
    }
  }]);

  return SCUnitTRand;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[2];
  var value = this._value;
  var prev = this._trig;
  var next = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    next = trigIn[i];
    if (next > 0 && prev <= 0) {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      out[i] = value = Math.random() * (hi - lo) + lo;
    } else {
      out[i] = value;
    }
    prev = next;
  }
  this._trig = next;
  this._value = value;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[2][0];
  if (trig > 0 && this._trig <= 0) {
    var lo = this.inputs[0][0];
    var hi = this.inputs[1][0];
    out[0] = this._value = Math.random() * (hi - lo) + lo;
  } else {
    out[0] = this._value;
  }
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("TRand", SCUnitTRand);
module.exports = SCUnitTRand;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],152:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTimer = function (_SCUnit) {
  _inherits(SCUnitTimer, _SCUnit);

  function SCUnitTimer() {
    _classCallCheck(this, SCUnitTimer);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTimer).apply(this, arguments));
  }

  _createClass(SCUnitTimer, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._prevfrac = 0;
      this._previn = this.inputs[0][0];
      this._counter = 0;
      this.outputs[0][0] = this._level = 0;
    }
  }]);

  return SCUnitTimer;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var sampleDur = this._sampleDur;
  var previn = this._previn;
  var prevfrac = this._prevfrac;
  var level = this._level;
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    var curin = inIn[i];
    counter += 1;
    if (previn <= 0 && curin > 0) {
      var frac = -previn / (curin - previn);
      level = sampleDur * (frac + counter - prevfrac);
      prevfrac = frac;
      counter = 0;
    }
    out[i] = level;
    previn = curin;
  }
  this._previn = previn;
  this._prevfrac = prevfrac;
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("Timer", SCUnitTimer);
module.exports = SCUnitTimer;
},{"../SCUnit":12,"../SCUnitRepository":13}],153:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitToggleFF = function (_SCUnit) {
  _inherits(SCUnitToggleFF, _SCUnit);

  function SCUnitToggleFF() {
    _classCallCheck(this, SCUnitToggleFF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitToggleFF).apply(this, arguments));
  }

  _createClass(SCUnitToggleFF, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._prevtrig = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitToggleFF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  var curtrig = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level = 1 - level;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("ToggleFF", SCUnitToggleFF);
module.exports = SCUnitToggleFF;
},{"../SCUnit":12,"../SCUnitRepository":13}],154:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrig = function (_SCUnit) {
  _inherits(SCUnitTrig, _SCUnit);

  function SCUnitTrig() {
    _classCallCheck(this, SCUnitTrig);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrig).apply(this, arguments));
  }

  _createClass(SCUnitTrig, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO && this.inputSpecs[0].rate !== C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_k"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sr = rate.sampleRate;
      this._counter = 0;
      this._trig = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitTrig;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var level = this._level;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    curTrig = trigIn[i];
    if (counter > 0) {
      counter -= 1;
      zout = counter ? level : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = level = curTrig;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = trig;
  this._counter = counter;
  this._level = level;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var level = this._level;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  curTrig = trigIn[0];
  for (var i = 0; i < inNumSamples; i++) {
    if (counter > 0) {
      counter -= 1;
      zout = counter ? level : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = level = curTrig;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = curTrig;
  this._counter = counter;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Trig", SCUnitTrig);
module.exports = SCUnitTrig;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],155:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrig1 = function (_SCUnit) {
  _inherits(SCUnitTrig1, _SCUnit);

  function SCUnitTrig1() {
    _classCallCheck(this, SCUnitTrig1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrig1).apply(this, arguments));
  }

  _createClass(SCUnitTrig1, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO && this.inputSpecs[0].rate !== C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_k"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sr = rate.sampleRate;
      this._counter = 0;
      this._trig = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitTrig1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    curTrig = trigIn[i];
    if (counter > 0) {
      counter -= 1;
      zout = counter ? 1 : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = 1;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = trig;
  this._counter = counter;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  curTrig = trigIn[0];
  for (var i = 0; i < inNumSamples; i++) {
    if (counter > 0) {
      counter -= 1;
      zout = counter ? 1 : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = 1;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = trig;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("Trig1", SCUnitTrig1);
module.exports = SCUnitTrig1;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],156:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrigControl = function (_SCUnit) {
  _inherits(SCUnitTrigControl, _SCUnit);

  function SCUnitTrigControl() {
    _classCallCheck(this, SCUnitTrigControl);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrigControl).apply(this, arguments));
  }

  _createClass(SCUnitTrigControl, [{
    key: "initialize",
    value: function initialize() {
      if (this.outputs.length === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      this._controls = this.synth.params;
      this.dspProcess(1);
    }
  }]);

  return SCUnitTrigControl;
}(SCUnit);

dspProcess["1"] = function () {
  var controls = this._controls;
  var specialIndex = this.specialIndex;
  this.outputs[0][0] = controls[specialIndex];
  controls[specialIndex] = 0;
};
dspProcess["k"] = function () {
  var controls = this._controls;
  var outputs = this.outputs;
  var numberOfChannels = outputs.length;
  var specialIndex = this.specialIndex;
  for (var i = 0; i < numberOfChannels; i++) {
    outputs[i][0] = controls[specialIndex + i];
    controls[specialIndex + i] = 0;
  }
};
SCUnitRepository.registerSCUnitClass("TrigControl", SCUnitTrigControl);
module.exports = SCUnitTrigControl;
},{"../SCUnit":12,"../SCUnitRepository":13}],157:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrigImpulse = function (_SCUnit) {
  _inherits(SCUnitTrigImpulse, _SCUnit);

  function SCUnitTrigImpulse() {
    _classCallCheck(this, SCUnitTrigImpulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrigImpulse).apply(this, arguments));
  }

  _createClass(SCUnitTrigImpulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this._phase = this.inputs[2][0];
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_ka"];
        if (this.inputSpecs[2].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      } else {
        this.dspProcess = dspProcess["next_kk"];
        if (this.inputSpecs[2].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      }
      this._slopeFactor = rate.slopeFactor;
      this._phaseOffset = 0;
      this._cpstoinc = rate.sampleDur;
      if (this._phase === 0) {
        this._phase = 1;
      }
      this._prevTrig = this.inputs[0][0];
    }
  }]);

  return SCUnitTrigImpulse;
}(SCUnit);

dspProcess["next_ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trig = this.inputs[0];
  var freqIn = this.inputs[1];
  var cpstoinc = this._cpstoinc;
  var prevTrig = this._prevTrig;
  var phaseOffset = this.inputs[2][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase;
  if (trig > 0 && prevTrig <= 0) {
    phase = phaseOffset;
    if (this.inputSpecs[2].rate !== C.SCALAR) {
      phase = 1;
    }
    if (phase === 0) {
      phase = 1;
    }
  }
  phase += prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freqIn[i] * cpstoinc;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
  this._prevTrig = trig;
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trig = this.inputs[0][0];
  var freq = this.inputs[1][0] * this._cpstoinc;
  var prevTrig = this._prevTrig;
  var phaseOffset = this.inputs[2][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase;
  if (trig > 0 && prevTrig <= 0) {
    phase = phaseOffset;
    if (this.inputSpecs[2].rate !== C.SCALAR) {
      phase = 1;
    }
    if (phase === 0) {
      phase = 1;
    }
  }
  phase += prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freq;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
  this._prevTrig = trig;
};
SCUnitRepository.registerSCUnitClass("TrigImpulse", SCUnitTrigImpulse);
module.exports = SCUnitTrigImpulse;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13}],158:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTwoPole = function (_SCUnit) {
  _inherits(SCUnitTwoPole, _SCUnit);

  function SCUnitTwoPole() {
    _classCallCheck(this, SCUnitTwoPole);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTwoPole).apply(this, arguments));
  }

  _createClass(SCUnitTwoPole, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitTwoPole;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = Math.max(0, Math.min(this.inputs[2][0], 1));
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || reson !== this._reson) {
    var b1_next = 2 * reson * Math.cos(freq * this._radiansPerSample);
    var b2_next = -(reson * reson);
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = y0;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._reson = reson;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = _y;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("TwoPole", SCUnitTwoPole);
module.exports = SCUnitTwoPole;
},{"../SCUnit":12,"../SCUnitRepository":13}],159:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTwoZero = function (_SCUnit) {
  _inherits(SCUnitTwoZero, _SCUnit);

  function SCUnitTwoZero() {
    _classCallCheck(this, SCUnitTwoZero);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTwoZero).apply(this, arguments));
  }

  _createClass(SCUnitTwoZero, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._x1 = 0;
      this._x2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitTwoZero;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = Math.max(0, Math.min(this.inputs[2][0], 1));
  var b1 = this._b1;
  var b2 = this._b2;
  var x1 = this._x1;
  var x2 = this._x2;
  if (freq !== this._freq || reson !== this._reson) {
    var b1_next = -2 * reson * Math.cos(freq * this._radiansPerSample);
    var b2_next = reson * reson;
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var x0 = inIn[i];
      out[i] = x0 + (b1 + b1_slope * i) * x1 + (b2 + b2_slope * i) * x2;
      x2 = x1;
      x1 = x0;
    }
    this._freq = freq;
    this._reson = reson;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _x = inIn[_i];
      out[_i] = _x + b1 * x1 + b2 * x2;
      x2 = x1;
      x1 = _x;
    }
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("TwoZero", SCUnitTwoZero);
module.exports = SCUnitTwoZero;
},{"../SCUnit":12,"../SCUnitRepository":13}],160:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var $i2n = "\nneg not isNil notNil bitNot abs asFloat asInt ceil floor frac sign squared cubed sqrt exp reciprocal\nmidicps cpsmidi midiratio ratiomidi dbamp ampdb octcps cpsoct log log2 log10 sin cos tan asin acos\natan sinh cosh tanh rand rand2 linrand bilinrand sum3rand distort softclip coin digitvalue silence\nthru rectWindow hanWindow welWindow triWindow ramp scurve numunaryselectors num tilde pi to_i half\ntwice".trim().split(/\s/);
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitUnaryOpUGen = function (_SCUnit) {
  _inherits(SCUnitUnaryOpUGen, _SCUnit);

  function SCUnitUnaryOpUGen() {
    _classCallCheck(this, SCUnitUnaryOpUGen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitUnaryOpUGen).apply(this, arguments));
  }

  _createClass(SCUnitUnaryOpUGen, [{
    key: "initialize",
    value: function initialize() {
      var dspFunc = dspProcess[$i2n[this.specialIndex]];
      if (!dspFunc) {
        throw new Error("UnaryOpUGen[" + $i2n[this.specialIndex] + "] is not defined.");
      }
      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspFunc["d"];
      } else {
        this.dspProcess = dspFunc[$r2k[this.inputSpecs[0].rate]] || null;
        this._a = this.inputs[0][0];
        if (this.dspProcess) {
          this.dspProcess(1);
        } else {
          this.outputs[0][0] = dspFunc(this._a);
        }
      }
    }
  }]);

  return SCUnitUnaryOpUGen;
}(SCUnit);

dspProcess["neg"] = function (a) {
  return -a;
};
dspProcess["not"] = function (a) {
  return a === 0 ? 1 : 0;
};
dspProcess["abs"] = function (a) {
  return Math.abs(a);
};
dspProcess["ceil"] = function (a) {
  return Math.ceil(a);
};
dspProcess["floor"] = function (a) {
  return Math.floor(a);
};
dspProcess["frac"] = function (a) {
  if (a < 0) {
    return 1 + (a - (a | 0));
  }
  return a - (a | 0);
};
dspProcess["sign"] = function (a) {
  return Math.sign(a);
};
dspProcess["squared"] = function (a) {
  return a * a;
};
dspProcess["cubed"] = function (a) {
  return a * a * a;
};
dspProcess["sqrt"] = function (a) {
  return Math.sqrt(Math.abs(a));
};
dspProcess["exp"] = function (a) {
  return Math.exp(a);
};
dspProcess["reciprocal"] = function (a) {
  return 1 / a;
};
dspProcess["midicps"] = function (a) {
  return 440 * Math.pow(2, (a - 69) * 1 / 12);
};
dspProcess["cpsmidi"] = function (a) {
  return Math.log(Math.abs(a) * 1 / 440) * Math.LOG2E * 12 + 69;
};
dspProcess["midiratio"] = function (a) {
  return Math.pow(2, a * 1 / 12);
};
dspProcess["ratiomidi"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG2E * 12;
};
dspProcess["dbamp"] = function (a) {
  return Math.pow(10, a * 0.05);
};
dspProcess["ampdb"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG10E * 20;
};
dspProcess["octcps"] = function (a) {
  return 440 * Math.pow(2, a - 4.75);
};
dspProcess["cpsoct"] = function (a) {
  return Math.log(Math.abs(a) * 1 / 440) * Math.LOG2E + 4.75;
};
dspProcess["log"] = function (a) {
  return Math.log(Math.abs(a));
};
dspProcess["log2"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG2E;
};
dspProcess["log10"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG10E;
};
dspProcess["sin"] = function (a) {
  return Math.sin(a);
};
dspProcess["cos"] = function (a) {
  return Math.cos(a);
};
dspProcess["tan"] = function (a) {
  return Math.tan(a);
};
dspProcess["asin"] = function (a) {
  return Math.asin(Math.max(-1, Math.min(a, 1)));
};
dspProcess["acos"] = function (a) {
  return Math.acos(Math.max(-1, Math.min(a, 1)));
};
dspProcess["atan"] = function (a) {
  return Math.atan(a);
};
dspProcess["sinh"] = function (a) {
  return Math.sinh(a);
};
dspProcess["cosh"] = function (a) {
  return Math.cosh(a);
};
dspProcess["tanh"] = function (a) {
  return Math.tanh(a);
};
dspProcess["rand"] = function (a) {
  return Math.random() * a;
};
dspProcess["rand2"] = function (a) {
  return (Math.random() * 2 - 1) * a;
};
dspProcess["linrand"] = function (a) {
  return Math.min(Math.random(), Math.random()) * a;
};
dspProcess["bilinrand"] = function (a) {
  return (Math.random() - Math.random()) * a;
};
dspProcess["sum3rand"] = function (a) {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 0.666666667 * a;
};
dspProcess["distort"] = function (a) {
  return a / (1 + Math.abs(a));
};
dspProcess["softclip"] = function (a) {
  var absa = Math.abs(a);
  return absa <= 0.5 ? a : (absa - 0.25) / a;
};
dspProcess["coin"] = function (a) {
  return Math.random() < a ? 1 : 0;
};
dspProcess["num"] = function (a) {
  return +a;
};
dspProcess["tilde"] = function (a) {
  return ~a;
};
dspProcess["pi"] = function (a) {
  return Math.PI * a;
};
dspProcess["to_i"] = function (a) {
  return a | 0;
};
dspProcess["half"] = function (a) {
  return a * 0.5;
};
dspProcess["twice"] = function (a) {
  return a * 2;
};
function unary_k(func) {
  return function () {
    this.outputs[0][0] = func(this.inputs[0][0]);
  };
}
function unary_a(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i]);
    }
  };
}
function unary_d(func) {
  return function (inNumSamples) {
    if (inNumSamples) {
      var a = demand.next(this, 0, inNumSamples);
      this.outputs[0][0] = isNaN(a) ? NaN : func(a);
    } else {
      demand.reset(this, 0);
    }
  };
}
Object.keys(dspProcess).forEach(function (key) {
  var func = dspProcess[key];
  func["a"] = func["a"] || unary_a(func);
  func["k"] = func["k"] || unary_k(func);
  func["d"] = unary_d(func);
});
SCUnitRepository.registerSCUnitClass("UnaryOpUGen", SCUnitUnaryOpUGen);
module.exports = SCUnitUnaryOpUGen;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_demand":168}],161:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitVarLag = function (_SCUnit) {
  _inherits(SCUnitVarLag, _SCUnit);

  function SCUnitVarLag() {
    _classCallCheck(this, SCUnitVarLag);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitVarLag).apply(this, arguments));
  }

  _createClass(SCUnitVarLag, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sampleRate = rate.sampleRate;
      var lagTime = this.inputs[1][0];
      var counter = Math.max(1, lagTime * rate.sampleRate | 0);
      this._level = this.inputs[2][0];
      this._counter = counter;
      this._in = this.inputs[0][0];
      this._slope = (this._in - this._level) / counter;
      this._lagTime = lagTime;
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitVarLag;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var lagTime = this.inputs[1][0];
  var _in = this.inputs[0][0];
  var slope = this._slope;
  var level = this._level;
  var counter = this._counter;
  if (_in !== this._in) {
    this._counter = counter = Math.max(1, lagTime * this._sampleRate | 0);
    this._slope = slope = (_in - this._in) / counter;
    this._in = _in;
    this._lagTime = lagTime;
  } else if (lagTime !== this._lagTime) {
    var scaleFactor = lagTime / this._lagTime;
    this._counter = counter = Math.max(1, this._counter * scaleFactor | 0);
    this._slope = slope = this._slope / scaleFactor || 0;
    this._lagTime = lagTime;
  }
  _in = this._in;
  if (counter > 0) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = level;
      if (counter > 0) {
        level += slope;
        counter -= 1;
      } else {
        level = _in;
      }
    }
  } else {
    out.fill(level);
  }
  this._level = level;
  this._slope = slope;
  this._counter = counter;
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var lagTime = this.inputs[1][0];
  var counter = this._counter;
  if (_in !== this._in) {
    this._counter = counter = Math.max(1, lagTime * this._sampleRate | 0);
    this._slope = (_in - this._level) / counter;
    this._in = _in;
    this._lagTime = lagTime;
  } else if (lagTime !== this._lagTime) {
    if (counter !== 0) {
      var scaleFactor = lagTime / this._lagTime;
      this._counter = counter = Math.max(1, this._counter * scaleFactor | 0);
      this._slope = this._slope / scaleFactor;
    }
    this._lagTime = lagTime;
  }
  this.outputs[0][0] = this._level;
  if (this._counter > 0) {
    this._level += this._slope;
    this._counter -= 1;
  } else {
    this._level = this._in;
  }
};
SCUnitRepository.registerSCUnitClass("VarLag", SCUnitVarLag);
module.exports = SCUnitVarLag;
},{"../SCUnit":12,"../SCUnitRepository":13}],162:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitWhiteNoise = function (_SCUnit) {
  _inherits(SCUnitWhiteNoise, _SCUnit);

  function SCUnitWhiteNoise() {
    _classCallCheck(this, SCUnitWhiteNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitWhiteNoise).apply(this, arguments));
  }

  _createClass(SCUnitWhiteNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitWhiteNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = Math.random() * 2 - 1;
  }
};
SCUnitRepository.registerSCUnitClass("WhiteNoise", SCUnitWhiteNoise);
module.exports = SCUnitWhiteNoise;
},{"../SCUnit":12,"../SCUnitRepository":13}],163:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var wrap = require("../util/wrap");
var dspProcess = {};

var SCUnitWrap = function (_SCUnit) {
  _inherits(SCUnitWrap, _SCUnit);

  function SCUnitWrap() {
    _classCallCheck(this, SCUnitWrap);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitWrap).apply(this, arguments));
  }

  _createClass(SCUnitWrap, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_kk"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._lo = this.inputs[1][0];
      this._hi = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitWrap;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = wrap(inIn[i], loIn[i], hiIn[i]);
  }
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_lo = this.inputs[1][0];
  var next_hi = this.inputs[2][0];
  var lo = this._lo;
  var hi = this._hi;
  if (next_lo === lo && next_hi === hi) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = wrap(inIn[i], lo, hi);
    }
  } else {
    var lo_slope = (next_lo - lo) * this._slopeFactor;
    var hi_slope = (next_hi - hi) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = wrap(inIn[_i], lo + lo_slope * _i, hi + hi_slope * _i);
    }
    this._lo = next_lo;
    this._hi = next_hi;
  }
};
SCUnitRepository.registerSCUnitClass("Wrap", SCUnitWrap);
module.exports = SCUnitWrap;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"../util/wrap":182}],164:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var gSine = sine.gSine;

var SCUnitXFade2 = function (_SCUnit) {
  _inherits(SCUnitXFade2, _SCUnit);

  function SCUnitXFade2() {
    _classCallCheck(this, SCUnitXFade2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitXFade2).apply(this, arguments));
  }

  _createClass(SCUnitXFade2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      var ipos = void 0;
      this._slopeFactor = rate.slopeFactor;
      this._pos = this.inputs[2][0];
      this._level = this.inputs[3][0];
      ipos = 1024 * this._pos + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      this._leftAmp = this._level * gSine[2048 - ipos];
      this._rightAmp = this._level * gSine[ipos];
      this.dspProcess(1);
    }
  }]);

  return SCUnitXFade2;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var posIn = this.inputs[2];
  var nextLevel = this.inputs[3][0];
  var level = this._level;
  var ipos = void 0;
  if (level !== nextLevel) {
    var level_slope = (nextLevel - this._level) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      ipos = 1024 * posIn[i] + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      var amp = level + level_slope * i;
      var leftAmp = amp * gSine[2048 - ipos];
      var rightAmp = amp * gSine[ipos];
      out[i] = leftIn[i] * leftAmp + rightIn[i] * rightAmp;
    }
    this._level = nextLevel;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      ipos = 1024 * posIn[_i] + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      var _amp = level;
      var _leftAmp = _amp * gSine[2048 - ipos];
      var _rightAmp = _amp * gSine[ipos];
      out[_i] = leftIn[_i] * _leftAmp + rightIn[_i] * _rightAmp;
    }
  }
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var nextPos = this.inputs[2][0];
  var nextLevel = this.inputs[3][0];
  var leftAmp = this._leftAmp;
  var rightAmp = this._rightAmp;
  var ipos = void 0;
  if (this._pos !== nextPos || this._level !== nextLevel) {
    ipos = 1024 * nextPos + 1024 + 0.5 | 0;
    ipos = Math.max(0, Math.min(ipos, 2048));
    var nextLeftAmp = nextLevel * gSine[2048 - ipos];
    var nextRightAmp = nextLevel * gSine[ipos];
    var slopeFactor = this._slopeFactor;
    var leftAmp_slope = (nextLeftAmp - leftAmp) * slopeFactor;
    var rightAmp_slope = (nextRightAmp - rightAmp) * slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = leftIn[i] * (leftAmp + leftAmp_slope * i) + rightIn[i] * (rightAmp + rightAmp_slope * i);
    }
    this._pos = nextPos;
    this._level = nextLevel;
    this._leftAmp = nextLeftAmp;
    this._rightAmp = nextRightAmp;
  } else {
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      out[_i2] = leftIn[_i2] * leftAmp + rightIn[_i2] * rightAmp;
    }
  }
};
SCUnitRepository.registerSCUnitClass("XFade2", SCUnitXFade2);
module.exports = SCUnitXFade2;
},{"../Constants":4,"../SCUnit":12,"../SCUnitRepository":13,"./_sine":169}],165:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitXLine = function (_SCUnit) {
  _inherits(SCUnitXLine, _SCUnit);

  function SCUnitXLine() {
    _classCallCheck(this, SCUnitXLine);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitXLine).apply(this, arguments));
  }

  _createClass(SCUnitXLine, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      var start = this.inputs[0][0] || 0.001;
      var end = this.inputs[1][0] || 0.001;
      var dur = this.inputs[2][0];
      var counter = Math.round(dur * rate.sampleRate);
      if (counter === 0) {
        this._level = end;
        this._counter = 0;
        this._growth = 0;
      } else {
        this._counter = counter;
        this._growth = Math.pow(end / start, 1 / counter);
        this._level = start * this._growth;
      }
      this._endLevel = end;
      this._doneAction = this.inputs[3][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitXLine;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var growth = this._growth;
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter === 0) {
      var endLevel = this._endLevel;
      for (var i = 0; i < remain; i++) {
        out[j++] = endLevel;
      }
      remain = 0;
    } else {
      var nsmps = Math.min(remain, counter);
      counter -= nsmps;
      remain -= nsmps;
      for (var _i = 0; _i < nsmps; _i++) {
        out[j++] = level;
        level *= growth;
      }
      if (counter === 0) {
        this.doneAction(this._doneAction);
      }
    }
  } while (remain);
  this._counter = counter;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("XLine", SCUnitXLine);
module.exports = SCUnitXLine;
},{"../SCUnit":12,"../SCUnitRepository":13}],166:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitZeroCrossing = function (_SCUnit) {
  _inherits(SCUnitZeroCrossing, _SCUnit);

  function SCUnitZeroCrossing() {
    _classCallCheck(this, SCUnitZeroCrossing);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitZeroCrossing).apply(this, arguments));
  }

  _createClass(SCUnitZeroCrossing, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._prevfrac = 0;
      this._previn = this.inputs[0][0];
      this._counter = 0;
      this.outputs[0][0] = this._level = 0;
    }
  }]);

  return SCUnitZeroCrossing;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var sampleRate = this._sampleRate;
  var previn = this._previn;
  var prevfrac = this._prevfrac;
  var level = this._level;
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    var curin = inIn[i];
    counter += 1;
    if (counter > 4 && previn <= 0 && curin > 0) {
      var frac = -previn / (curin - previn);
      level = sampleRate / (frac + counter - prevfrac);
      prevfrac = frac;
      counter = 0;
    }
    out[i] = level;
    previn = curin;
  }
  this._previn = previn;
  this._prevfrac = prevfrac;
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("ZeroCrossing", SCUnitZeroCrossing);
module.exports = SCUnitZeroCrossing;
},{"../SCUnit":12,"../SCUnitRepository":13}],167:[function(require,module,exports){
"use strict";

var log001 = Math.log(0.001);

function feedback(delaytime, decaytime) {
  if (delaytime === 0 || decaytime === 0) {
    return 0;
  }
  if (decaytime > 0) {
    return +Math.exp(log001 * delaytime / +decaytime);
  } else {
    return -Math.exp(log001 * delaytime / -decaytime);
  }
}

module.exports = { feedback: feedback };
},{}],168:[function(require,module,exports){
"use strict";

var C = require("../Constants");

function next(unit, index, offset) {
  var fromUnit = unit.inputSpecs[index].unit;

  if (fromUnit) {
    switch (fromUnit.calcRate) {
      case C.RATE_AUDIO:
        return unit.inputs[index][offset - 1];
      case C.RATE_DEMAND:
        fromUnit.process(offset);
        break;
    }
  }

  return unit.inputs[index][0];
}

function reset(unit, index) {
  var fromUnit = unit.inputSpecs[index].unit;

  if (fromUnit && fromUnit.calcRate === C.RATE_DEMAND) {
    fromUnit.process(0);
  }
}

module.exports = { next: next, reset: reset };
},{"../Constants":4}],169:[function(require,module,exports){
"use strict";

var kSineSize = 8192;
var kSineMask = kSineSize - 1;
var kBadValue = new Float32Array([1e20])[0];
var gSine = new Float32Array(kSineSize + 1);
var gInvSine = new Float32Array(kSineSize + 1);
var gSineWavetable = new Float32Array(kSineSize * 2);

function makeSine() {
  for (var i = 0; i < kSineSize; i++) {
    var d = Math.sin(i / kSineSize * 2 * Math.PI);

    gSine[i] = d;
    gInvSine[i] = 1 / d;
  }
  gSine[kSineSize] = gSine[0];
  gInvSine[0] = gInvSine[kSineSize >> 1] = gInvSine[kSineSize] = kBadValue;

  var sz1 = kSineSize;
  var sz2 = sz1 >> 1;

  for (var _i = 1; _i <= 8; _i++) {
    gInvSine[_i] = gInvSine[sz1 - _i] = gInvSine[sz2 - _i] = gInvSine[sz2 + _i] = kBadValue;
  }
}

function makeSineWaveTable() {
  var val1 = void 0,
      val2 = void 0;
  var j = 0;

  for (var i = 0; i < kSineSize - 1; i++) {
    val1 = gSine[i];
    val2 = gSine[i + 1];
    gSineWavetable[j++] = 2 * val1 - val2;
    gSineWavetable[j++] = val2 - val1;
  }

  val1 = gSine[kSineSize - 1];
  val2 = gSine[0];
  gSineWavetable[j++] = 2 * val1 - val2;
  gSineWavetable[j++] = val2 - val1;
}

makeSine();
makeSineWaveTable();

module.exports = { kSineSize: kSineSize, kSineMask: kSineMask, kBadValue: kBadValue, gSine: gSine, gInvSine: gInvSine, gSineWavetable: gSineWavetable };
},{}],170:[function(require,module,exports){
"use strict";

module.exports = {
  SCUnitA2K: require("./SCUnitA2K"),
  SCUnitAPF: require("./SCUnitAPF"),
  SCUnitAllpassC: require("./SCUnitAllpassC"),
  SCUnitAllpassL: require("./SCUnitAllpassL"),
  SCUnitAllpassN: require("./SCUnitAllpassN"),
  SCUnitBPF: require("./SCUnitBPF"),
  SCUnitBPZ2: require("./SCUnitBPZ2"),
  SCUnitBRF: require("./SCUnitBRF"),
  SCUnitBRZ2: require("./SCUnitBRZ2"),
  SCUnitBinaryOpUGen: require("./SCUnitBinaryOpUGen"),
  SCUnitBlip: require("./SCUnitBlip"),
  SCUnitBrownNoise: require("./SCUnitBrownNoise"),
  SCUnitClip: require("./SCUnitClip"),
  SCUnitClipNoise: require("./SCUnitClipNoise"),
  SCUnitCoinGate: require("./SCUnitCoinGate"),
  SCUnitCombC: require("./SCUnitCombC"),
  SCUnitCombL: require("./SCUnitCombL"),
  SCUnitCombN: require("./SCUnitCombN"),
  SCUnitControl: require("./SCUnitControl"),
  SCUnitControlDur: require("./SCUnitControlDur"),
  SCUnitControlRate: require("./SCUnitControlRate"),
  SCUnitCrackle: require("./SCUnitCrackle"),
  SCUnitDC: require("./SCUnitDC"),
  SCUnitDecay: require("./SCUnitDecay"),
  SCUnitDecay2: require("./SCUnitDecay2"),
  SCUnitDelay1: require("./SCUnitDelay1"),
  SCUnitDelay2: require("./SCUnitDelay2"),
  SCUnitDelayC: require("./SCUnitDelayC"),
  SCUnitDelayL: require("./SCUnitDelayL"),
  SCUnitDelayN: require("./SCUnitDelayN"),
  SCUnitDetectSilence: require("./SCUnitDetectSilence"),
  SCUnitDust: require("./SCUnitDust"),
  SCUnitDust2: require("./SCUnitDust2"),
  SCUnitEnvGen: require("./SCUnitEnvGen"),
  SCUnitExpRand: require("./SCUnitExpRand"),
  SCUnitFOS: require("./SCUnitFOS"),
  SCUnitFSinOsc: require("./SCUnitFSinOsc"),
  SCUnitFold: require("./SCUnitFold"),
  SCUnitFreeVerb: require("./SCUnitFreeVerb"),
  SCUnitGate: require("./SCUnitGate"),
  SCUnitGrayNoise: require("./SCUnitGrayNoise"),
  SCUnitHPF: require("./SCUnitHPF"),
  SCUnitHPZ1: require("./SCUnitHPZ1"),
  SCUnitHPZ2: require("./SCUnitHPZ2"),
  SCUnitIRand: require("./SCUnitIRand"),
  SCUnitImpulse: require("./SCUnitImpulse"),
  SCUnitIn: require("./SCUnitIn"),
  SCUnitInRange: require("./SCUnitInRange"),
  SCUnitIntegrator: require("./SCUnitIntegrator"),
  SCUnitK2A: require("./SCUnitK2A"),
  SCUnitKeyState: require("./SCUnitKeyState"),
  SCUnitKlang: require("./SCUnitKlang"),
  SCUnitKlank: require("./SCUnitKlank"),
  SCUnitLFClipNoise: require("./SCUnitLFClipNoise"),
  SCUnitLFCub: require("./SCUnitLFCub"),
  SCUnitLFDClipNoise: require("./SCUnitLFDClipNoise"),
  SCUnitLFDNoise0: require("./SCUnitLFDNoise0"),
  SCUnitLFDNoise1: require("./SCUnitLFDNoise1"),
  SCUnitLFDNoise3: require("./SCUnitLFDNoise3"),
  SCUnitLFNoise0: require("./SCUnitLFNoise0"),
  SCUnitLFNoise1: require("./SCUnitLFNoise1"),
  SCUnitLFNoise2: require("./SCUnitLFNoise2"),
  SCUnitLFPar: require("./SCUnitLFPar"),
  SCUnitLFPulse: require("./SCUnitLFPulse"),
  SCUnitLFSaw: require("./SCUnitLFSaw"),
  SCUnitLFTri: require("./SCUnitLFTri"),
  SCUnitLPF: require("./SCUnitLPF"),
  SCUnitLPZ1: require("./SCUnitLPZ1"),
  SCUnitLPZ2: require("./SCUnitLPZ2"),
  SCUnitLag: require("./SCUnitLag"),
  SCUnitLag2: require("./SCUnitLag2"),
  SCUnitLag2UD: require("./SCUnitLag2UD"),
  SCUnitLag3: require("./SCUnitLag3"),
  SCUnitLag3UD: require("./SCUnitLag3UD"),
  SCUnitLagControl: require("./SCUnitLagControl"),
  SCUnitLagUD: require("./SCUnitLagUD"),
  SCUnitLatch: require("./SCUnitLatch"),
  SCUnitLeakDC: require("./SCUnitLeakDC"),
  SCUnitLinExp: require("./SCUnitLinExp"),
  SCUnitLinLin: require("./SCUnitLinLin"),
  SCUnitLinRand: require("./SCUnitLinRand"),
  SCUnitLinXFade2: require("./SCUnitLinXFade2"),
  SCUnitLine: require("./SCUnitLine"),
  SCUnitLinen: require("./SCUnitLinen"),
  SCUnitLogistic: require("./SCUnitLogistic"),
  SCUnitMidEQ: require("./SCUnitMidEQ"),
  SCUnitMouseButton: require("./SCUnitMouseButton"),
  SCUnitMouseX: require("./SCUnitMouseX"),
  SCUnitMouseY: require("./SCUnitMouseY"),
  SCUnitMulAdd: require("./SCUnitMulAdd"),
  SCUnitNRand: require("./SCUnitNRand"),
  SCUnitNumAudioBuses: require("./SCUnitNumAudioBuses"),
  SCUnitNumControlBuses: require("./SCUnitNumControlBuses"),
  SCUnitNumInputBuses: require("./SCUnitNumInputBuses"),
  SCUnitNumOutputBuses: require("./SCUnitNumOutputBuses"),
  SCUnitOnePole: require("./SCUnitOnePole"),
  SCUnitOneZero: require("./SCUnitOneZero"),
  SCUnitOut: require("./SCUnitOut"),
  SCUnitPan2: require("./SCUnitPan2"),
  SCUnitPeak: require("./SCUnitPeak"),
  SCUnitPeakFollower: require("./SCUnitPeakFollower"),
  SCUnitPhasor: require("./SCUnitPhasor"),
  SCUnitPinkNoise: require("./SCUnitPinkNoise"),
  SCUnitPulse: require("./SCUnitPulse"),
  SCUnitPulseCount: require("./SCUnitPulseCount"),
  SCUnitPulseDivider: require("./SCUnitPulseDivider"),
  SCUnitRHPF: require("./SCUnitRHPF"),
  SCUnitRLPF: require("./SCUnitRLPF"),
  SCUnitRadiansPerSample: require("./SCUnitRadiansPerSample"),
  SCUnitRamp: require("./SCUnitRamp"),
  SCUnitRand: require("./SCUnitRand"),
  SCUnitReplaceOut: require("./SCUnitReplaceOut"),
  SCUnitResonz: require("./SCUnitResonz"),
  SCUnitRingz: require("./SCUnitRingz"),
  SCUnitRunningMax: require("./SCUnitRunningMax"),
  SCUnitRunningMin: require("./SCUnitRunningMin"),
  SCUnitSOS: require("./SCUnitSOS"),
  SCUnitSampleDur: require("./SCUnitSampleDur"),
  SCUnitSampleRate: require("./SCUnitSampleRate"),
  SCUnitSaw: require("./SCUnitSaw"),
  SCUnitSelect: require("./SCUnitSelect"),
  SCUnitSetResetFF: require("./SCUnitSetResetFF"),
  SCUnitSinOsc: require("./SCUnitSinOsc"),
  SCUnitSinOscFB: require("./SCUnitSinOscFB"),
  SCUnitSlew: require("./SCUnitSlew"),
  SCUnitSlope: require("./SCUnitSlope"),
  SCUnitStepper: require("./SCUnitStepper"),
  SCUnitSubsampleOffset: require("./SCUnitSubsampleOffset"),
  SCUnitSum3: require("./SCUnitSum3"),
  SCUnitSum4: require("./SCUnitSum4"),
  SCUnitSweep: require("./SCUnitSweep"),
  SCUnitSyncSaw: require("./SCUnitSyncSaw"),
  SCUnitT2A: require("./SCUnitT2A"),
  SCUnitT2K: require("./SCUnitT2K"),
  SCUnitTExpRand: require("./SCUnitTExpRand"),
  SCUnitTIRand: require("./SCUnitTIRand"),
  SCUnitTRand: require("./SCUnitTRand"),
  SCUnitTimer: require("./SCUnitTimer"),
  SCUnitToggleFF: require("./SCUnitToggleFF"),
  SCUnitTrig: require("./SCUnitTrig"),
  SCUnitTrig1: require("./SCUnitTrig1"),
  SCUnitTrigControl: require("./SCUnitTrigControl"),
  SCUnitTrigImpulse: require("./SCUnitTrigImpulse"),
  SCUnitTwoPole: require("./SCUnitTwoPole"),
  SCUnitTwoZero: require("./SCUnitTwoZero"),
  SCUnitUnaryOpUGen: require("./SCUnitUnaryOpUGen"),
  SCUnitVarLag: require("./SCUnitVarLag"),
  SCUnitWhiteNoise: require("./SCUnitWhiteNoise"),
  SCUnitWrap: require("./SCUnitWrap"),
  SCUnitXFade2: require("./SCUnitXFade2"),
  SCUnitXLine: require("./SCUnitXLine"),
  SCUnitZeroCrossing: require("./SCUnitZeroCrossing")
};
},{"./SCUnitA2K":15,"./SCUnitAPF":16,"./SCUnitAllpassC":17,"./SCUnitAllpassL":18,"./SCUnitAllpassN":19,"./SCUnitBPF":20,"./SCUnitBPZ2":21,"./SCUnitBRF":22,"./SCUnitBRZ2":23,"./SCUnitBinaryOpUGen":24,"./SCUnitBlip":25,"./SCUnitBrownNoise":26,"./SCUnitClip":27,"./SCUnitClipNoise":28,"./SCUnitCoinGate":29,"./SCUnitCombC":30,"./SCUnitCombL":31,"./SCUnitCombN":32,"./SCUnitControl":33,"./SCUnitControlDur":34,"./SCUnitControlRate":35,"./SCUnitCrackle":36,"./SCUnitDC":37,"./SCUnitDecay":38,"./SCUnitDecay2":39,"./SCUnitDelay1":40,"./SCUnitDelay2":41,"./SCUnitDelayC":42,"./SCUnitDelayL":43,"./SCUnitDelayN":44,"./SCUnitDetectSilence":45,"./SCUnitDust":46,"./SCUnitDust2":47,"./SCUnitEnvGen":48,"./SCUnitExpRand":49,"./SCUnitFOS":50,"./SCUnitFSinOsc":51,"./SCUnitFold":52,"./SCUnitFreeVerb":53,"./SCUnitGate":54,"./SCUnitGrayNoise":55,"./SCUnitHPF":56,"./SCUnitHPZ1":57,"./SCUnitHPZ2":58,"./SCUnitIRand":59,"./SCUnitImpulse":60,"./SCUnitIn":61,"./SCUnitInRange":62,"./SCUnitIntegrator":63,"./SCUnitK2A":64,"./SCUnitKeyState":65,"./SCUnitKlang":66,"./SCUnitKlank":67,"./SCUnitLFClipNoise":68,"./SCUnitLFCub":69,"./SCUnitLFDClipNoise":70,"./SCUnitLFDNoise0":71,"./SCUnitLFDNoise1":72,"./SCUnitLFDNoise3":73,"./SCUnitLFNoise0":74,"./SCUnitLFNoise1":75,"./SCUnitLFNoise2":76,"./SCUnitLFPar":77,"./SCUnitLFPulse":78,"./SCUnitLFSaw":79,"./SCUnitLFTri":80,"./SCUnitLPF":81,"./SCUnitLPZ1":82,"./SCUnitLPZ2":83,"./SCUnitLag":84,"./SCUnitLag2":85,"./SCUnitLag2UD":86,"./SCUnitLag3":87,"./SCUnitLag3UD":88,"./SCUnitLagControl":89,"./SCUnitLagUD":90,"./SCUnitLatch":91,"./SCUnitLeakDC":92,"./SCUnitLinExp":93,"./SCUnitLinLin":94,"./SCUnitLinRand":95,"./SCUnitLinXFade2":96,"./SCUnitLine":97,"./SCUnitLinen":98,"./SCUnitLogistic":99,"./SCUnitMidEQ":100,"./SCUnitMouseButton":101,"./SCUnitMouseX":102,"./SCUnitMouseY":103,"./SCUnitMulAdd":104,"./SCUnitNRand":105,"./SCUnitNumAudioBuses":106,"./SCUnitNumControlBuses":107,"./SCUnitNumInputBuses":108,"./SCUnitNumOutputBuses":109,"./SCUnitOnePole":110,"./SCUnitOneZero":111,"./SCUnitOut":112,"./SCUnitPan2":113,"./SCUnitPeak":114,"./SCUnitPeakFollower":115,"./SCUnitPhasor":116,"./SCUnitPinkNoise":117,"./SCUnitPulse":118,"./SCUnitPulseCount":119,"./SCUnitPulseDivider":120,"./SCUnitRHPF":121,"./SCUnitRLPF":122,"./SCUnitRadiansPerSample":123,"./SCUnitRamp":124,"./SCUnitRand":125,"./SCUnitReplaceOut":126,"./SCUnitResonz":127,"./SCUnitRingz":128,"./SCUnitRunningMax":129,"./SCUnitRunningMin":130,"./SCUnitSOS":131,"./SCUnitSampleDur":132,"./SCUnitSampleRate":133,"./SCUnitSaw":134,"./SCUnitSelect":135,"./SCUnitSetResetFF":136,"./SCUnitSinOsc":137,"./SCUnitSinOscFB":138,"./SCUnitSlew":139,"./SCUnitSlope":140,"./SCUnitStepper":141,"./SCUnitSubsampleOffset":142,"./SCUnitSum3":143,"./SCUnitSum4":144,"./SCUnitSweep":145,"./SCUnitSyncSaw":146,"./SCUnitT2A":147,"./SCUnitT2K":148,"./SCUnitTExpRand":149,"./SCUnitTIRand":150,"./SCUnitTRand":151,"./SCUnitTimer":152,"./SCUnitToggleFF":153,"./SCUnitTrig":154,"./SCUnitTrig1":155,"./SCUnitTrigControl":156,"./SCUnitTrigImpulse":157,"./SCUnitTwoPole":158,"./SCUnitTwoZero":159,"./SCUnitUnaryOpUGen":160,"./SCUnitVarLag":161,"./SCUnitWhiteNoise":162,"./SCUnitWrap":163,"./SCUnitXFade2":164,"./SCUnitXLine":165,"./SCUnitZeroCrossing":166}],171:[function(require,module,exports){
"use strict";

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(value, maxValue));
}

module.exports = clamp;
},{}],172:[function(require,module,exports){
"use strict";

function cubicinterp(x, y0, y1, y2, y3) {
  var c0 = y1;
  var c1 = 0.5 * (y2 - y0);
  var c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  var c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

  return ((c3 * x + c2) * x + c1) * x + c0;
}

module.exports = cubicinterp;
},{}],173:[function(require,module,exports){
"use strict";

function fold(val, lo, hi) {
  if (hi === lo) {
    return lo;
  }

  if (val >= hi) {
    val = hi * 2 - val;
    if (val >= lo) {
      return val;
    }
  } else if (val < lo) {
    val = lo * 2 - val;
    if (val < hi) {
      return val;
    }
  } else {
    return val;
  }

  var range1 = hi - lo;
  var range2 = range1 * 2;
  var x = val - lo - range2 * Math.floor(x / range2);

  if (x >= range1) {
    return range2 - x + lo;
  }

  return x + lo;
}

module.exports = fold;
},{}],174:[function(require,module,exports){
"use strict";

module.exports.clamp = require("./clamp");
module.exports.cubicinterp = require("./cubicinterp");
module.exports.toNumber = require("./toNumber");
module.exports.toPowerOfTwo = require("./toPowerOfTwo");
module.exports.toValidBlockSize = require("./toValidBlockSize");
module.exports.toValidNumberOfAudioBus = require("./toValidNumberOfAudioBus");
module.exports.toValidNumberOfChannels = require("./toValidNumberOfChannels");
module.exports.toValidNumberOfControlBus = require("./toValidNumberOfControlBus");
module.exports.toValidSampleRate = require("./toValidSampleRate");
},{"./clamp":171,"./cubicinterp":172,"./toNumber":175,"./toPowerOfTwo":176,"./toValidBlockSize":177,"./toValidNumberOfAudioBus":178,"./toValidNumberOfChannels":179,"./toValidNumberOfControlBus":180,"./toValidSampleRate":181}],175:[function(require,module,exports){
"use strict";

function toNumber(value) {
  return +value || 0;
}

module.exports = toNumber;
},{}],176:[function(require,module,exports){
"use strict";

function toPowerOfTwo(value, round) {
  round = round || Math.round;
  return 1 << round(Math.log(value) / Math.log(2));
}

module.exports = toPowerOfTwo;
},{}],177:[function(require,module,exports){
"use strict";

var clamp = require("./clamp");
var toPowerOfTwo = require("./toPowerOfTwo");
var MIN_BLOCK_SIZE = 8;
var MAX_BLOCK_SIZE = 1024;

function toValidBlockSize(value) {
  return clamp(toPowerOfTwo(value), MIN_BLOCK_SIZE, MAX_BLOCK_SIZE);
}

module.exports = toValidBlockSize;
},{"./clamp":171,"./toPowerOfTwo":176}],178:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MIN_NUMBER_OF_AUDIO_BUS = 2;
var MAX_NUMBER_OF_AUDIO_BUS = 1024;

function toValidNumberOfAudioBus(value) {
  return clamp(toNumber(value) | 0, MIN_NUMBER_OF_AUDIO_BUS, MAX_NUMBER_OF_AUDIO_BUS);
}

module.exports = toValidNumberOfAudioBus;
},{"./clamp":171,"./toNumber":175}],179:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MAX_NUMBER_OF_CHANNELS = 32;

function toValidNumberOfChannels(value) {
  return clamp(toNumber(value) | 0, 1, MAX_NUMBER_OF_CHANNELS);
}

module.exports = toValidNumberOfChannels;
},{"./clamp":171,"./toNumber":175}],180:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MIN_NUMBER_OF_AUDIO_BUS = 2;
var MAX_NUMBER_OF_AUDIO_BUS = 1024;

function toValidNumberOfControlBus(value) {
  return clamp(toNumber(value) | 0, MIN_NUMBER_OF_AUDIO_BUS, MAX_NUMBER_OF_AUDIO_BUS);
}

module.exports = toValidNumberOfControlBus;
},{"./clamp":171,"./toNumber":175}],181:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MIN_SAMPLERATE = 3000;
var MAX_SAMPLERATE = 192000;

function toValidSampleRate(value) {
  return clamp(toNumber(value) | 0, MIN_SAMPLERATE, MAX_SAMPLERATE);
}

module.exports = toValidSampleRate;
},{"./clamp":171,"./toNumber":175}],182:[function(require,module,exports){
"use strict";

function wrap(val, lo, hi) {
  if (hi === lo) {
    return lo;
  }

  var range = hi - lo;

  if (val >= hi) {
    val -= range;
    if (val < hi) {
      return val;
    }
  } else if (val < lo) {
    val += range;
    if (val >= lo) {
      return val;
    }
  } else {
    return val;
  }

  return val - range * Math.floor((val - lo) / range);
}

module.exports = wrap;
},{}],183:[function(require,module,exports){
(function (process,global){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":3}],184:[function(require,module,exports){
(function (global){
"use strict";

require("setimmediate");

var scsynth = require("scsynth");

var context = null;
var synth = null;
var buffers = null;
var rIndex = 0;
var wIndex = 0;
var running = false;

global.onmessage = function (e) {
  recvMessage(e.data);
};

function loop() {
  if (!running) {
    return;
  }
  if (buffers[rIndex]) {
    context.process();
    buffers[rIndex].set(context.outputs[0], 0);
    buffers[rIndex].set(context.outputs[1], context.outputs[0].length);
    global.postMessage(buffers[rIndex], [buffers[rIndex].buffer]);
    buffers[rIndex] = null;
    rIndex = (rIndex + 1) % buffers.length;
  }
  setImmediate(loop);
}

function recvMessage(data) {
  if (data instanceof Float32Array) {
    buffers[wIndex] = data;
    wIndex = (wIndex + 1) % buffers.length;
    return;
  }
  if (data.type === "init" && context === null) {
    context = new scsynth.SCContext(data.value);
    buffers = Array.from({ length: data.value.bufferSlots }, function () {
      return new Float32Array(data.value.blockSize * 2);
    });
  }
  if (context) {
    if (data.type === "start") {
      running = true;
      loop();
    }
    if (data.type === "stop") {
      running = false;
    }
    if (data.type === "synthdef") {
      if (synth) {
        synth.end();
      }
      synth = context.createSynth(data.value);
      context.addToTail(synth);
    }
    if (data.type === "param" && synth) {
      synth.params.set(data.value);
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"scsynth":14,"setimmediate":183}]},{},[184]);