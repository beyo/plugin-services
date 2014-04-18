
var packet = require('../../lib/packet');


describe('Test Packet', function () {

  it('should fail to create Packet', function () {
    (function () { new packet.Packet('test', 'uid'); }).should.throw();
    (function () { packet.Packet('test', 'uid'); }).should.throw();
  });

  it('should create AddListenerPacket', function () {
    var p;

    p = new packet.AddListenerPacket('uid', 'test');
    p.should.have.ownProperty('type').and.equal('addListener');
    p.should.have.ownProperty('uid').and.equal('uid');
    p.should.have.ownProperty('event').and.equal('test');
    p.should.have.ownProperty('counter').and.equal(0);
    Object.keys(p).should.have.lengthOf(5);
    p.should.eql({ _: 'SERVICES', type: 'addListener', event: 'test', uid: 'uid', counter: 0 });

    p = new packet.AddListenerPacket('uidFoo', 'fooTest', 123);
    p.should.have.ownProperty('type').and.equal('addListener');
    p.should.have.ownProperty('uid').and.equal('uidFoo');
    p.should.have.ownProperty('event').and.equal('fooTest');
    p.should.have.ownProperty('counter').and.equal(123);
    Object.keys(p).should.have.lengthOf(5);
    p.should.eql({ _: 'SERVICES', type: 'addListener', uid: 'uidFoo', event: 'fooTest', counter: 123 });

    packet.AddListenerPacket('uid', 'test').should.eql(new packet.AddListenerPacket('uid', 'test'));
  });

  it('should create RemoveListenerPacket', function () {
    var p;

    p = new packet.RemoveListenerPacket('uid');
    p.should.have.ownProperty('type').and.equal('removeListener');
    p.should.have.ownProperty('uid').and.equal('uid');
    Object.keys(p).should.have.lengthOf(3);
    p.should.eql({ _: 'SERVICES', type: 'removeListener', uid: 'uid' });

    p = new packet.RemoveListenerPacket('uidFoo', 123);
    p.should.have.ownProperty('type').and.equal('removeListener');
    p.should.have.ownProperty('uid').and.equal('uidFoo');
    Object.keys(p).should.have.lengthOf(3);
    p.should.eql({ _: 'SERVICES', type: 'removeListener', uid: 'uidFoo' });

    packet.RemoveListenerPacket('uid').should.eql(new packet.RemoveListenerPacket('uid'));
  });

  it('should create EmitPacket', function () {
    var p;

    p = new packet.EmitPacket(null, 'test');
    p.should.have.ownProperty('type').and.equal('emit');
    p.should.have.ownProperty('event').and.equal('test');
    p.should.have.ownProperty('args').and.eql([]);
    Object.keys(p).should.have.lengthOf(5);
    p.should.eql({ _: 'SERVICES', type: 'emit', uid: null, event: 'test', args: [] });

    p = new packet.EmitPacket('foo', 'test', ['foo', 'bar']);
    p.should.have.ownProperty('type').and.equal('emit');
    p.should.have.ownProperty('event').and.equal('test');
    p.should.have.ownProperty('args').and.be.an.Array.and.eql(['foo', 'bar']);
    Object.keys(p).should.have.lengthOf(5);
    p.should.eql({ _: 'SERVICES', type: 'emit', uid: 'foo', event: 'test', args: ['foo', 'bar'] });

    packet.EmitPacket(null, 'test').should.eql(new packet.EmitPacket(null, 'test'));
  });

  it('should parse `addListener` packet', function () {
    var p;

    p = packet.parse({ _: 'SERVICES', type: 'addListener', event: 'test', uid: 'foo' });
    p.should.be.instanceof(packet.AddListenerPacket);
    p.should.eql({ _: 'SERVICES', type: 'addListener', event: 'test', uid: 'foo', counter: 0 });

    p = packet.parse({ _: 'SERVICES', type: 'addListener', event: 'test', uid: 'bar', counter: 123 });
    p.should.be.instanceof(packet.AddListenerPacket);
    p.should.eql({ _: 'SERVICES', type: 'addListener', event: 'test', uid: 'bar', counter: 123 });
  });

  it('should parse `removeListener` packet', function () {
    var p;

    p = packet.parse({ _: 'SERVICES', type: 'removeListener', event: 'test', uid: 'foo' });
    p.should.be.instanceof(packet.RemoveListenerPacket);
    p.should.eql({ _: 'SERVICES', type: 'removeListener', uid: 'foo' });
  });

  it('should parse `emit` packet', function () {
    var p;

    p = packet.parse({ _: 'SERVICES', type: 'emit', event: 'test', args: ['foo', 'bar'] });
    p.should.be.instanceof(packet.EmitPacket);
    p.should.eql({ _: 'SERVICES', type: 'emit', uid: undefined, event: 'test', args: ['foo', 'bar'] });

    p = packet.parse({ _: 'SERVICES', type: 'emit', event: 'test', });
    p.should.be.instanceof(packet.EmitPacket);
    p.should.eql({ _: 'SERVICES', type: 'emit', uid: undefined, event: 'test', args: [] });
  });

  it('should fail to parse', function () {
    [
      undefined, null, false, true, 0, '', [], function () {}
    ].forEach(function (data) {
      (function () { packet.parse(data); }).should.throw();
    });

    (function () { packet.parse({}); }).should.throw();

    [
      undefined, null, false, true, 0, '', {}, [], function () {},
      'services', 'sERVICES', 'service', 'SERVICE'
    ].forEach(function (type) {
      (function () { packet.parse({ _: type, type: 'addListener', event: 'test' }); }).should.throw();
    });

    [
      undefined, null, false, true, 0, '', {}, [], function () {}
    ].forEach(function (type) {
      (function () { packet.parse({ _: 'SERVICES', type: type, event: 'test' }); }).should.throw();
    });
  });

  it('should fail to create `addListener` packet', function () {
    [
      undefined, null, false, true, 0, '', {}, [], function () {}
    ].forEach(function (event) {
      (function () { packet.parse({ _: 'SERVICES', type: 'addListener', event: event }); }).should.throw();
      (function () { new packet.AddListenerPacket('foo', event); }).should.throw();
      (function () { new packet.AddListenerPacket(event, 'test'); }).should.throw();
    });

    [
      null, false, true, 'foo', {}, [], function () {}
    ].forEach(function (counter) {
      (function () { new packet.AddListenerPacket('uid', 'test', counter); }).should.throw();
    });
  });

  it('should fail to parse `removeListener` packet', function () {
    [
      undefined, null, false, true, 0, '', {}, [], function () {}
    ].forEach(function (event) {
      (function () { packet.parse({ _: 'SERVICES', type: 'removeListener', event: event }); }).should.throw();
      (function () { new packet.RemoveListenerPacket(event); }).should.throw();
    });

  });

  it('should fail to parse `emit` packet', function () {
    [
      undefined, null, false, true, 0, '', {}, [], function () {}
    ].forEach(function (event) {
      (function () { packet.parse({ _: 'SERVICES', type: 'emit', event: event }); }).should.throw();
      (function () { new packet.EmitPacket(event); }).should.throw();
    });

    [
      null, false, true, 0, '', {}, function () {}
    ].forEach(function (args) {
      (function () { packet.parse({ _: 'SERVICES', type: 'emit', event: 'foo', args: args }); }).should.throw();
    });
  });

});
