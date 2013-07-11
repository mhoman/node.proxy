var http = require('http');
var net = require('net');
var qs = require('querystring');

function fromBase64(str) {
  return new Buffer(str, 'base64').toString();
}

http.createServer(function(req, res) {
  var url = req.url;
//  console.log('URL: ' + url);
  var params = JSON.parse(fromBase64(qs.unescape(url.slice(1))));
//  console.log('PARAMS: %j', params);
  var host = params.host;
  var port = params.port;
  console.log('CONNECT: ' + host + ':' + port);
  var buffer = [];
  function addChunk(chunk) {
    buffer.push(chunk);
  }
  req.once('data', function(chunk) {
    if (chunk.toString() === '\n') {
      req.on('data', addChunk);
    }
  });
  var socket = net.connect(port, host, function() {
    req.removeListener('data', addChunk);
    res.writeHead(200);
    res.write('\n');
    for (var i = 0, l = buffer.length; i < l; i++) {
      socket.write(buffer[i]);
    }
    req.pipe(socket);
    socket.pipe(res);
    console.log('CONNECTED: ' + host + ':' + port);
  });
}).listen(80);