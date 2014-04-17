/**
Exceptions modules
*/

var errorFactory = require('error-factory');

/**
Service Exception (services.js)
*/
module.exports.ServicesException = errorFactory('beyo.services.ServicesException');


/**
Packet Exception (packet.js)
*/
module.exports.PacketException = errorFactory('beyo.services.PacketException', ['message', 'messageData']);
