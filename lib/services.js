
const MODULE_FILE_PATTERN = /^[^.].*?\.js$/;

var Primus = require('primus');
var co = require('co');
var fs = require('co-fs');
var path = require('path');
var mkdirp = require('mkdirp');
var events = require('events');

var packet = require('./packet');
var ServicesException = require('./exceptions').ServicesException;

var slice = Array.prototype.slice;

var primus;
var emitter;
var remoteConnection;

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
      yield loadServer(beyo, options.server);
    } else {
      throw ServicesException('Server has not been configured!');
    }

    yield setupRemoteConnectionInfo(options.server, options.remoteConnection);
    yield saveClientLibrary(beyo, options.clientLibraryPath);
  } else if (options.server) {
    throw ServicesException('Server has already been configured!');
  }

  if (options.servicesPath) {
    yield loadServices(beyo, options.servicesPath, options);
  }

  return {
    emitter: emitter,
    getServerUrl: getServerUrl
  };
};


function getServerUrl() {
  return 'http://' + remoteConnection.address + (remoteConnection.port ? (':' + remoteConnection.port) : '');
}


function * loadServer(beyo, serverOptions) {
  var timer;

  module.exports.primus = primus = Primus.createServer(serverOptions);
  
  primus.on('connection', function (spark) {
    beyo.logger.log('debug', '[Services]', 'Connection from', spark.address.ip + ':' + spark.address.port, '(' + spark.id + ')');

    bindSpark(beyo, spark);
  });

  // make sure we do have a server socket!!
  try {
    timer = setTimeout(function () {
      throw ServicesException('Server socket timeout');
    }, 3000);

    while (!primus.server.address()) {
      yield function (done) { setImmediate(done); };
    }

    clearTimeout(timer);
  } catch (e) {
    beyo.logger.log('error', '[Services]', e.message);
  }
}


function * setupRemoteConnectionInfo(serverOptions, remoteConnectionOptions) {
  var os = require('os');

  var ifaces = os.networkInterfaces() || {};
  var ifaceNames = Object.keys(ifaces);

  var addr = primus.server.address();
  var useIPv6;
  var ifaceName;

  serverOptions = serverOptions || {};
  remoteConnectionOptions = remoteConnectionOptions || {};

  useIPv6 = remoteConnectionOptions['useIPv6'];
  ifaceName = remoteConnectionOptions['interface'];

  function getIp(name, iface, external) {
    var ipList = iface.filter(function (info) {
      return (!useIPv6 || (info.family === 'IPv6')) && (!name || (ifaceName === name) || (!external && info.internal));
    });
    var ipInfo = ipList.length && ipList.shift();

    return ipInfo && {
      address: ipInfo.address,
      family: ipInfo.family
    };
  }

  remoteConnection = ifaceNames.reduce(function (found, name) {
    return found || getIp(name, ifaces[name], true);
  }, false) || ifaceNames.reduce(function (found, name) {
    return found || getIp(null, ifaces[name]);
  }, false) || { 
    host: 'localhost',
    family: 'IPv4'
  };

  remoteConnection.port = (serverOptions && serverOptions.port) || (addr && addr.port);
}


function * saveClientLibrary(beyo, clientLibraryPath) {
  var _fs = require('fs');
  var source = path.join(__dirname, '..', 'client', 'library.js');
  var serverUrl = getServerUrl();
  var stream;

  var primusLib = path.join(clientLibraryPath, 'primus.js');
  var servicesLib = path.join(clientLibraryPath, 'beyo-services.js');

  if (!(yield fs.exists(clientLibraryPath))) {
    yield function (done) {
      mkdirp(clientLibraryPath, done);
    };
  }

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

  beyo.logger.log('debug', '[Services]', 'Server listening on', serverUrl);

  stream = _fs.createWriteStream(servicesLib);
  stream.write('\n' +
  '+function (context) {\n' +
  '  var Primus = context["Primus"];\n' +
  '  Primus.serverConfig = {\n' +
  '    url: ' + JSON.stringify(serverUrl) + '\n' +
  '  };\n' +
  '}(window || global);\n');
  _fs.createReadStream(source).pipe(stream);
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
    var i;
    var ilen = loadedModules.length;
    var service;
    var loadedServices = [];

    if (emitter) {
      for (i = 0; i < ilen; ++i) {
        co(function * () {
          service = loadedModules[i];

          loadedServices.push(yield service(beyo, emitter, options));
        })(function (err) {
          if (err) {
            beyo.logger.log('error', '[Services]', err);
          }
        });
      }
    }

    if (loadedServices.length) {
      spark.on('end', function () {
        for (i = 0; i < ilen; ++i) {
          co(function * () {
            service = loadedServices.pop();

            if (service) {
              yield service();
            }
          })(function (err) {
            if (err) {
              beyo.logger.log('error', '[Services]', err);
            }
          });
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
