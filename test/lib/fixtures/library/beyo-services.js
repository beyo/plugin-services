
+function (context) {
  var Primus = context["Primus"];
  Primus.serverConfig = {
    url: "http://0.0.0.0:1234"
  };
}(window || global);
+function (name, context, global, definition) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports[name] = context[name] = definition.call(context, global['Primus']);
  } else if (typeof define == "function" && define.amd) {
    define(['Primus'], function reference(Primus) {
      return context[name] = definition.call(context, Primus);
    });
  }
}("Services", this, window || global, function services(Primus) {/*globals require, define */
  'use strict';

  var primusUrl = Primus.serverConfig && Primus.serverConfig.url;
  var primusOptions = Primus.serverConfig && Primus.serverConfig.options;
  var isConnected = false;

  var slice = Array.prototype.slice;
  var primus = Primus.connect(primusUrl, primusOptions);
  var binder = {};

  function Services() {
    this.emit = emitEvent;
    this.on = addListener;
    this.off = removeListener;
  }

  Object.defineProperty(Services.prototype, 'primus', {
    enumerable: true,
    configurable: false,
    get: function getPrimus() {
      return primus;
    }
  });

  function emitEvent(event) {
    if (isConnected) {
      primus.write(createPacket('emit', {
        event: event,
        args: slice.call(arguments, 1)
      }));
    } else {
      console.warn('Cannot emit event', event, 'because the connection is down');
    }
  }

  function addListener(event, listener, uid) {
    uid = uid || newUID();

    while (binder[uid] && (binder[uid].event !== event || binder[uid].listener !== listener)) {
      if (arguments.length < 3) {
        uid = newUID();
      } else {
        throw new Error('Listener conflict for event ' + event + ' with uid ' + uid);
      }
    }

    binder[uid] = {
      event: event,
      listener: listener
    };

    if (isConnected) {
      primus.write(createPacket('addListener', {
        event: event,
        uid: uid
      }));
    }
  }

  function removeListener(event, listener) {
    var uid;
    var keys = Object.keys(binder);

    for (var i = 0, ilen = keys.length; i < ilen && !uid; ++i) {
      uid = keys[i];
      if ((binder[uid].event === event) && (binder[uid].listener === listener)) {
        if (isConnected) {
          primus.write(createPacket('removeListener', {
            uid: uid
          }));
        }

        delete binder[uid];
      }
    }
  }


  function newUID() {
    var uid = '';
    for (var i = 0; i < 5; ++i) {
      if (i > 0) {
        uid += '-';
      }
      uid += Math.random().toString(36).substring(2, 8);
    }

    return uid;
  }

  function createPacket(type, options) {
    var packet = {
      _: 'SERVICES',
      type: type,
    };

    for (var k in options) {
      packet[k] = options[k];
    }

    return packet;
  }

  function processPacket(packet) {
    if (packet._ === 'SERVICES') {
      if (packet.type === 'emit') {
        if (binder[packet.uid]) {
          binder[packet.uid].listener.apply(null, packet.args);
        }
      }
    }
  }


  // primus events

  primus.on('open', function open() {
    isConnected = true;

    // rebind all event listeners to the server...
    for (var uid in binder) {
      primus.write(createPacket('addListener', {
        event: binder[uid].event,
        uid: uid
      }));
    }
  });

  primus.on('reconnecting', function () {
    isConnected = false;
  });

  primus.on('data', processPacket);

  primus.on('end', function () {
    isConnected = false;
  });


  return new Services();
});
