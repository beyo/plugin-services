

describe('Test Services', function () {

  var portNumber = 1234;

  var path = require('path');
  var co = require('co');
  var fs = require('fs');
  var beyo = require('beyo');
//  var Primus = require('primus');
  var services = require('../../lib/services');
//  var server;
  var serverEmitter;
//  var client;
  var client;

  function port() {
    return portNumber++;
  }

  function serverUrl(server) {
    var addr = services.primus.server.address();
    return 'http://' + addr.address + ':' + (addr.port || serverPort);
  }

  before(function () {
    global.window = {}; // needed in client/library.js
  });

  it('should load services', function (done) {
    var clientLibraryPath = path.join(__dirname, 'fixtures', 'library');

    this.timeout(2000);

    co(function * () {
      var serverPort = port();

      serverEmitter = yield services(beyo, {
        server: {
          iknowhttpsisbetter: true,  // LOL
          port: serverPort,
          transformer: 'websockets'
        },
        clientLibraryPath: clientLibraryPath,
        servicesPath: path.join(__dirname, 'fixtures', 'services'),
        testOk: function (emitter) {
          emitter.should.be.an.Object;
          serviceInitialized = true;
        }
      });

      global.window.Primus = services.primus.Socket;

      client = require(path.join(clientLibraryPath, 'beyo-services.js'));

      client.Services.on('foo', function (abc, num123, obj) {
        arguments.should.have.lengthOf(3);

        abc.should.be.equal('abc');
        num123.should.be.equal(123);

        assert.deepEqual(obj, { foo: 'bar' });

        setImmediate(function () {
          services.primus.end();
          services.primus.on('close', function () {
            setImmediate(done);
          });
        });
      });
      client.Services.primus.on('open', function () {
        client.Services.emit('foo', 'abc', 123, { foo: 'bar' });
      });
    })(function (err) {
      global.window.Primus = undefined;

      if (err) done(err);
    });
  });

});
