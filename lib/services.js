
const MODULE_FILE_PATTERN = /^[^.].*?\.js$/;

var Primus = require('primus');
var co = require('co');
var fs = require('co-fs');
var path = require('path');
var events = require('events');

var packet = require('./packet');
var ServicesException = require('./exceptions').ServicesException;

var slice = Array.prototype.slice;

var primus;
var emitter;

/**
Expose plugin callback
*/
module.exports = function * services(beyo, options) {
  options = options || {};

  if (!emitter) {
    emitter = loadEmitter(options.emitter, options.emitterOptions);
  } else if (options.emitter) {
    throw ServicesException('Emitter has already been configured!');
  }

  if (!primus) {
    if (options.server) {
      module.exports.primus = primus = loadServer(beyo, options.server);

      yield saveClientLibrary(beyo, options.clientLibraryPath);
    } else {
      throw ServicesException('Server has not been configured!');
    }
  } else if (options.server) {
    throw ServicesException('Server has already been configured!');
  }

  if (options.servicesPath) {
    yield loadServices(beyo, options.servicesPath, options);
  }

  return emitter;
};


function * saveClientLibrary(beyo, clientLibraryPath) {
  var _fs = require('fs');
  var source = path.join(__dirname, '..', 'client', 'library.js');
  var stream;

  var primusLib = path.join(clientLibraryPath, 'primus.js');
  var servicesLib = path.join(clientLibraryPath, 'beyo-services.js');

  if (yield (fs.exists)(primusLib)) {
    yield (fs.unlink)(primusLib);
  }
  if (yield (fs.exists)(servicesLib)) {
    beyo.logger.log('info', '[Services]', 'Replacing client library');
    yield (fs.unlink)(servicesLib);
  }

  beyo.logger.log('debug', '[Services]', 'Generating client library at', path.relative(process.cwd(), clientLibraryPath));

  yield function (done) {
    primus.save(primusLib, done);
  };

  stream = _fs.createWriteStream(servicesLib);
  stream.write('\n' +
  '+function (context) {\n' +
  '  var Primus = context["Primus"];\n' +
  '  Primus.serverConfig = {\n' +
  '    url: ' + JSON.stringify(getServerUrl()) + '\n' +
  '  };\n' +
  '}(window || global);\n');
  _fs.createReadStream(source).pipe(stream);
}


function getServerUrl() {
  var addr = primus.server.address();
  return 'http://' + addr.address + ':' + addr.port;
}


function loadServer(beyo, serverOptions) {
  var primus = Primus.createServer(serverOptions);

  primus.on('connection', function (spark) {
    beyo.logger.log('debug', '[Services]', 'Connection from', spark.address.ip + ':' + spark.address.port, '(' + spark.id + ')');

    bindSpark(beyo, spark);
  });

  return primus;
}


function loadEmitter(emitter, emitterOptions) {
  var module;

  if (typeof emitter === 'string') {
    emitter = emitter.split(':');

    module = require(emitter[0]);

    if (emitter[1]) {
      emitter = new module[emitter[1]](emitterOptions);
    } else {
      emitter = new module(emitterOptions);
    }
  } else if (emitter instanceof Function) {
    emitter = new emitter(emitterOptions);
  } else {
    emitter = new (events.EventEmitter)(emitterOptions);
  }

  if (!(emitter instanceof events.EventEmitter)) {
    throw ServicesException('Emitter should be an instance of EventEmitter!');
  }

  return emitter;
}


function * loadServices(beyo, servicesPath, options) {
  var files;
  var file;
  var i;
  var ilen;
  var loadedModule;
  var loadedModules = [];

  if (typeof servicesPath !== 'string') {
    throw ServicesException('Service path must be a string');
  } else if (!(yield fs.exists(servicesPath))) {
    throw ServicesException('Service path not found `' + String(servicesPath) + '`');
  }

  files = yield fs.readdir(servicesPath);

  for (i = 0, ilen = files.length; i < ilen; ++i) {
    file = path.join(path.resolve(process.cwd(), servicesPath), files[i]);

    if (file.match(MODULE_FILE_PATTERN)) {
      beyo.logger.log('debug', '[Services]', 'Loading', path.relative(process.cwd(), file));

      loadedModule = require(file);

      if (!(loadedModule instanceof Function)) {
        throw ServicesException('Service should be a function');
      }

      loadedModules.push(loadedModule);
    }
  }

  primus.on('connection', function (spark) {
    var i = 0;
    var ilen = loadedModules.length;
    var service;

    if (emitter) {
      co(function * () {
        for (; i < ilen; ++i) {
          service = loadedModules[i];

          yield service(beyo, emitter, options);
        }
      })(function (err) {
        if (err) {
          beyo.logger.log('error', '[Services]', err);
        }
      });
    }
  });
}

function bindSpark(beyo, spark) {
  var binder = {};

  function createListener(uid, event) {
    var listener = function bound() {
      spark.write(packet.EmitPacket(uid, event, slice.call(arguments)));
    };

    if (binder[uid]) {
      destroyListener(uid);
    }

    //console.log("Create listener", uid, "for", event);

    binder[uid] = {
      event: event,
      listener: listener
    };

    emitter.addListener(event, listener);
  }

  function destroyListener(uid) {
    var event;
    var listener;

    if (binder[uid]) {
      event = binder[uid].event;
      listener = binder[uid].listener;

      //console.log("Destroying listener", uid, "for", event);

      delete binder[uid];

      emitter.removeListener(event, listener);
    }
  }

  function cleanup() {
    var keys = Object.keys(binder);
    var bound;
    for (var i = 0, ilen = keys.length; i < ilen; ++i) {
      bound = binder[keys[i]];
      emitter.removeListener(bound.event, bound.listener);
    }

    beyo.logger.log('debug', '[Services]', 'Cleaning up', spark.address.ip + ':' + spark.address.port, '(' + spark.id + ')');

    binder = {};
  }

  spark.on('data', function onData(data) {
    var dataPacket;

    if (data !== null && typeof data === 'object') {
      dataPacket = packet.parse(data);

      if (dataPacket instanceof packet.AddListenerPacket) {
        createListener(dataPacket.uid, dataPacket.event);
      } else if (dataPacket instanceof packet.RemoveListenerPacket) {
        destroyListener(dataPacket.uid);
      } else if (dataPacket instanceof packet.EmitPacket) {
        emitter.emit.apply(emitter, [dataPacket.event].concat(dataPacket.args));
      }
    }
  });

  spark.on('end', cleanup);
}
