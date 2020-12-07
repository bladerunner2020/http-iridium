/* eslint-disable block-scoped-var */
/* eslint-disable no-underscore-dangle */
// Этот тестовый файл должен работать как в Node JS, так и в Iridium

/* globals HttpIridium */

var http = new HttpIridium();

http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html ' });
  res.write('<meta content="text/html; charset=UTF-8" http-equiv="Content-Type">');
  res.write('Привет Мир 8080!', 'utf8');
  res.end();
}).listen(8080);

http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html ' });
  res.write('<meta content="text/html; charset=UTF-8" http-equiv="Content-Type">');
  res.write('Привет Мир 8181!', 'utf8');
  res.end();
}).listen(8181);

var options = {
  host: 'localhost',
  port: 8181,
  path: '/',
  method: 'GET'
};

// Set up the request
setInterval(function() {
  var request = http.request(options, function(res) {
    res.on('data', function(chunk) {
      IR.Log('data received: ' + chunk);
    });
  });
    // request.write(post_data);
  request.end();
}, 3000);

setInterval(function() {
  IR.Log('Request now');
  options.port = 8080;
  var request = http.request(options, function(res) {
    res.on('data', function(chunk) {
      IR.Log('data received: ' + chunk);
    });
  });
    // request.write(post_data);
  request.end();
}, 3000);
