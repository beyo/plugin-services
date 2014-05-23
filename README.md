# Beyo Plugin Services

Service plugin for [beyo](https://github.com/beyo/beyo) applications using
[Primus](https://github.com/primus/primus).


## Install

```
npm install beyo-plugin-services --save
```


## Usage

### Configuration

Configure the plugin from your beyo application configuration

```json
{
  "plugins": {
    "services": {
      "module": "beyo-plugin-services",
      "options": {
        "servicesPath": "path/to/services",
        "options": {
          "emitter": 'events:EventEmitter',
          "emitterOptions": ...
          "server": {
            ...
          },
          "remoteConnection": {
            "interface": "eth0",
            "useIPv6": false
          },
          "clientLibraryPath": "path/to/public/js/lib/"
        }
      }
    }
  }
}
```

**NOTE:** the `emitter` should be the module and/or class to instanciate when
emitting or listening to events. The format is `module:Class`, and will be
processed as `new require(module)[Class](options.emitterOptions)`.
An actual function may be passed, which will be invoked as a constructor
function (i.e. `new options.emitter(options.emitterOptions)`).

**NOTE:** the `server` option should declare the configuration passed to the
instance of Primus.

**NOTE:** the `remoteConnection` option specifies what networking interface
should be used by the remote connection. Enable `useIPv6` if the IPv6 address should
be used instead of IPv4. (IPv4 will be used by default). The `interface` value is
the actual interface listed by `require('os').networkInterfaces()`. If the inteface
cannot be found, `localhost` is used.

**NOTE:** the `clientLibraryPath` value is the path where the client libraries
needs to be copied when generated. Normally, this path will point at a static
directory mapping (i.e. `./pub/js/lib/`).


### Services (server side)

Services are almost like controllers, but may be called many times during the
application lifetime; everytime a new Primus spark connects, the registered
services will be invoked with the given spark.

```javascript
// path/to/services/foo.js

/**
@param {Beyo} beyo        the application's Beyo object
@param {Spark} spark      the connected Primus spark object
@param {Object} options   the actual options passed on the plugin config
*/
module.exports = function * fooServices(beyo, emitter, options) {

  emitter.on('foo.bar', function () {
    /* do something */

    emitter.emit('foo.bar.complete');
  });

};
```


### Client side

The plugin requires the application to serve a static file, generated at application
start, and saved as `clientLibrary'. Just include the script in your HTML.

```html
<script type="text/javascript" src="/js/services.js"></script>
```

Then, the static file simply exposes Primus, along with a ready-to-use instance
called `Services`. And it can be used as :

```javascript
Services.emit('foo.bar');

Services.on('foo.bar', function () {
  console.log('foo.bar!');
});

Services.on('foo.bar.complete', function () {
  console.log('foo.bar.complete');
});
```

The above example would print `foo.bar!`, then `foo.bar.complete` to the console;
the `foo.bar` event being triggered both on the server and the client side.

The client (`services`) is an hybrid between `primus` and an `EventEmitter`. This
means that the server can pull the `Primus` instance and directly use it without
interfering with the services.


## Internals

The services plugin automatically manages event bindings between the client and
the server. All events sent from the client is actually processed by the server's
`EventEmitter`.


## Contribution

All contributions welcome! Every PR **must** be accompanied by their associated
unit tests!


## License

The MIT License (MIT)

Copyright (c) 2014 Mind2Soft <yanick.rochon@mind2soft.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
