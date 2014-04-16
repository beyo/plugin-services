
const MODULE_FILE_PATTERN = /^[^.].*?\.js$/;

var Primus = require('primus');
var fs = require('co-fs');
var path = require('path');
var events = require('events');

var ServicesException = require('./exceptions').ServicesException;

var primus;
var emitter;

/**
Expose plugin callback
*/
module.exports = function * services(beyo, options) {
  options = options || {};

  if (!emitter) {
    if (options.emitter) {
      emitter = loadEmitter(options.emitter, options.emitterOptions);
    } else {
      throw ServicesException('Emiter has not been configured!');
    }
  } else if (options.emitter) {
    throw ServicesException('Emitter has already been configured!');
  }

  if (!primus) {
    if (options.server) {
      primus = loadServer(options.server);
    } else {
      throw ServicesException('Server has not been configured!');
    }
  } else if (options.server) {
    throw ServicesException('Server has already been configured!');
  }

  if (options.servicesPath) {
    yield loadServices(beyo, options.servicesPath, options);
  }
};


function loadServer(serverOptions) {
  return Primus.createServer(serverOptions);
}


function loadEmitter(emitter, emitterOptions) {
  var module;

  if (typeof emitter === 'string');
    emitter = emitter.split(':');

    module = require(emitter[0]);

    if (emitter[1]) {
      emitter = new module[emitter[1]](emitterOptions);
    } else {
      emitter = new module(emitterOptions);
    }
  } else {
    emitter = new emitter(emitterOptions);
  }

  if (!(emitter instanceof events.EventEmitter) {
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
      beyo.logger.log('debug', 'Loading service :', path.relative(process.cwd(), file));

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

      for (; i < ilen; ++i) {
        service = loadedModules[i];

        yield service(beyo, emitter, options);
      }

      bindSpark(spark);
    }
  });
}
