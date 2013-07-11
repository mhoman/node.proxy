var argv = require('./optimist').argv;

//console.error(argv.p);
//process.exit();

var REMOTE = 'YOU.REMOTE.HOST';
//'proxy.jjtag.jit.su';
var HOST = argv.l || '127.0.0.1';
var PORT = argv.p || '1080';

var net = require('net');
var http = require('http');
var https = require('https');
var qs = require('querystring');

var clients = [];
//var SOCKS_VERSION = 5;

var AUTH_METHODS = {
  NOAUTH: 0x00,
  GSSAPI: 0x01,
  USERPASS: 0x02,
  NONE: 0xff
};

var COMMAND_TYPE = {
  TCP_CONNECT: 0x01,
  TCP_BIND: 0x02,
  UDP_BIND: 0x03
};

var ADDRESS_TYPE = {
  IP_V4: 0x01,
  DNS: 0x03,
  IP_V6: 0x04
};

var Address = {
  read: function(buffer, offset) {
    if (buffer[offset] == ADDRESS_TYPE.IP_V4) {
      return buffer[offset+1] + '.' + buffer[offset+2] + '.' + buffer[offset+3] + '.' + buffer[offset+4];
    }
    if (buffer[offset] == ADDRESS_TYPE.DNS) {
      return buffer.toString('utf8', offset+2, offset+2+buffer[offset+1]);
    }
    if (buffer[offset] == ADDRESS_TYPE.IP_V6) {
      return buffer.slice(buffer[offset+1], buffer[offset+1+16]);
    }
  },
  sizeOf: function(buffer, offset) {
    if (buffer[offset] == ADDRESS_TYPE.IP_V4) {
      return 4;
    }
    if (buffer[offset] == ADDRESS_TYPE.DNS) {
      return buffer[offset+1];
    }
    if (buffer[offset] == ADDRESS_TYPE.IP_V6) {
      return 16;
    }
  }
};

function proxy(socket, chunk, host, port) {
  //console.log('host: ' + host + ' port: ' + port);
  var req = httpRequest(host, port);
  //req.setSocketKeepAlive(1024);
  req.write('\n');
  req.on('response', function(res) {
    var resp = new Buffer(chunk.length);
    chunk.copy(resp);
    //resp[0] = socket.SOCKS_VERSION;
    resp[1] = 0x00;
    resp[2] = 0x00;
    socket.write(resp);
    res.once('data', function(chunk) {
      if (chunk.toString() === '\n') {
        res.pipe(socket);
        console.log('Tunnel Success');
      } else {
        console.log('Tunnel Fail');
      }
    });
    res.on('close', function() {
      socket.end();
    });
  });
  //socket.setKeepAlive(1024);
  socket.pipe(req);
  socket.on('close', function() {
    req.abort();
  });
}

function httpRequest(host, port) {
  var opts = {
    host: REMOTE,
    port: 80,
    agent: false,
    path: '/' + qs.escape(toBase64(JSON.stringify({
      host: host,
      port: port
    }))),
    method: 'POST'
  };
  return http.request(opts);
}

function toBase64(str) {
  return new Buffer(str).toString('base64');
}

var server = net.createServer(function(socket) {
  clients.push(socket);
  socket.on('end', function() {
    var idx = clients.indexOf(socket);
    if (idx != -1) {
      clients.splice(idx, 1);
    }
  });
  var handshake = function(chunk) {
    //socket.removeListener('data', handshake);
    //var socks_version = chunk[0];
    if (chunk[0] != 5) {
      console.error('handshake: wrong socks version: %d', chunk[0]);
      socket.end();
      return;
    }
    var methods = chunk[1];
    socket.auth_methods = [];
    for (var i = 0; i < methods; i++) {
      socket.auth_methods.push(chunk[i + 2]);
    }
    console.log('Support auth methods: %j', socket.auth_methods);
    var resp = new Buffer(2);
    resp[0] = 5;
    if (socket.auth_methods.indexOf(AUTH_METHODS.NOAUTH) > -1) {
      console.log('Handing off to handleRequest');
      socket.once('data', handleRequest);
      resp[1] = AUTH_METHODS.NOAUTH;
      socket.write(resp);
    } else {
      console.error('Unsupported authentication method -- disconnecting');
      resp[1] = AUTH_METHODS.NONE;
      socket.end(resp);
    }
  };
  socket.once('data', handshake);
  var handleRequest = function(chunk) {
    //socket.removeListener('data', handleRequest);
    var resp = new Buffer(2);
    resp[0] = 0x05;
    resp[1] = 0x01;
    if (chunk[0] != 5) {
      socket.end(resp);
      console.error('handleRequest: wrong socks version: %d', chunk[0]);
      return;
    }
    //resp[0] = chunk[0];
    var cmd = chunk[1];
    if (cmd == COMMAND_TYPE.TCP_CONNECT) {
      var offset = 3;
      var address = Address.read(chunk, offset);
      offset += Address.sizeOf(chunk, offset) + 2;
      var port = chunk.readUInt16BE(offset);
      console.log('Command type: %d -- to: %s:%s', cmd, address, port);
      proxy(socket, chunk, address, port);
    } else {
      socket.end(resp);
    }
  };
});

server.on('listening', function() {
  var address = server.address();
  console.log('LISTENING %s:%s', address.address, address.port);
});

server.on('error', function(e) {
  console.error('SERVER ERROR: %j', e);
  if (e.code == 'EADDRINUSE') {
    console.log('Address in use, retrying in 10 seconds...');
    setTimeout(function() {
      console.log('Reconnecting to %s:%s', HOST, PORT);
      server.close();
      server.listen(PORT, HOST);
    }, 10000);
  }
});
server.listen(PORT, HOST);
