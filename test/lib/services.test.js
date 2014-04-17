

describe('Test Services', function () {

  var portNumber = 1234;

  var path = require('path');
  var co = require('co');
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


  before(function () {
    global.window = undefined;   // just ... because
  });

  beforeEach(function beforeEach() {
    //server = http.createServer();
    //primus = new Primus(server);

    //server.listen(port(), done);

  });

  it('should load services', function (done) {
    this.timeout(3000);

    co(function * () {
      serverEmitter = yield services(beyo, {
        server: {
          iknowhttpsisbetter: true,  // LOL
          port: port(),
          transformer: 'websockets'
        },
        servicesPath: path.join(__dirname, 'fixtures'),
        testOk: function (emitter) {
          emitter.should.be.an.Object;
        }
      });

      global.Primus = services.primus.Socket;

      client = require('../../client/library');

      //console.log(client.Services.primus);

      client.Services.on('foo', function () {
        console.log('Received foo event');
      });

      yield function (done) {
        setTimeout(function () {

          services.primus.end();

          done();
        }, 1000);
      };
    })(function (err) {
      global.Primus = undefined;

      done(err);
    });
  });



});
