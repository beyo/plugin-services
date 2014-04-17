
const PACKET_TYPE = 'SERVICES';

var util = require('util');
var PacketException = require('./exceptions').PacketException;

var packetMap = {
  'addListener': AddListenerPacket,
  'removeListener': RemoveListenerPacket,
  'emit': EmitPacket
};


module.exports.Packet = Packet;
module.exports.AddListenerPacket = AddListenerPacket;
module.exports.RemoveListenerPacket = RemoveListenerPacket;
module.exports.EmitPacket = EmitPacket;

module.exports.parse = packetParser;



function Packet(type) {
  if (this.constructor === Packet) {
    throw PacketException('Cannot instanciate Packet directly');
  } else if (!(this instanceof Packet)) {
    throw PacketException('Cannot call Packet directly');
  }

  this._ = PACKET_TYPE,
  this.type = type;
}


function AddListenerPacket(uid, event, counter) {
  if (!(this instanceof AddListenerPacket)) {
    return new AddListenerPacket(uid, event, counter);
  }

  if (!event || typeof event !== 'string') {
    throw PacketException('Invalid event `{{event}}`', { event: event });
  } else if (!uid || typeof uid !== 'string') {
    throw PacketException('Unique id must be a string', { uid: uid });
  } else if (counter !== undefined) {
    if (typeof counter === 'string') {
      counter = Number(counter);
    }

    if (counter < 0 || isNaN(counter) || !isFinite(counter) || typeof counter !== 'number') {
      throw PacketException('Invalid counter `{{counter}}`', { counter: counter });
    }
  }

  Packet.call(this, 'addListener');

  this.uid = uid;
  this.event = event;
  this.counter = counter || 0;
}
util.inherits(AddListenerPacket, Packet);



function RemoveListenerPacket(uid) {
  if (!(this instanceof RemoveListenerPacket)) {
    return new RemoveListenerPacket(uid);
  } else if (!uid || typeof uid !== 'string') {
    throw PacketException('Unique id must be a string', { uid: uid });
  }

  Packet.call(this, 'removeListener');

  this.uid = uid;
}
util.inherits(RemoveListenerPacket, Packet);



function EmitPacket(event, args) {
  if (!(this instanceof EmitPacket)) {
    return new EmitPacket(event, args);
  }

  if (!event || typeof event !== 'string') {
    throw PacketException('Invalid event `{{event}}`', { event: event });
  } else if (args !== undefined) {
    if (!(args instanceof Array)) {
      throw PacketException('Arguments should an array', { args: args });
    }
  }

  Packet.call(this, 'emit');

  this.event = event;
  this.args = args || [];
}
util.inherits(EmitPacket, Packet);



function packetParser(data) {
  var Type;

  if (data === null || typeof data !== 'object') {
    throw PacketException('Data must be an object');
  } else if (data._ !== PACKET_TYPE || !packetMap[data.type]) {
    throw PacketException('Unknown packet type `{{type}}`', { type: data.type });
  }

  Type = packetMap[data.type];

  if (Type === AddListenerPacket) {
    return new Type(data.uid, data.event, data.counter);
  } else if (Type === RemoveListenerPacket) {
    return new Type(data.uid, data.event);
  } else if (Type === EmitPacket) {
    return new Type(data.event, data.args);
  } else {
    throw PacketException('Unknown packet type `{{type}}`', { type: data.type });
  }
}
