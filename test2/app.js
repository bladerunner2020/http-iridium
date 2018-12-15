// Этот тестовый файл должен работать как в Node JS, так и в Iridium'е

/* global _DEBUGGER, SimpleDebugConsole */

if (typeof IR == 'undefined') {
    var IR = {};
    // eslint-disable-next-line no-console
    IR.Log = console.log;
}
if (typeof _DEBUGGER == 'object') {
    _DEBUGGER
        .addConsole(new SimpleDebugConsole())
        .enable('HttpDriver');
} else {
    var _Debug = IR.Log;
}

var http = require('http');

http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html '});
    res.write('<meta content="text/html; charset=UTF-8" http-equiv="Content-Type">');
    res.write('Привет Мир 8080!', 'utf8');
    res.end();
}).listen(8080);

http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html '});
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
    _Debug('Request now');
    var request = http.request(options, function(res) {
        res.on('data', function (chunk) {
            _Debug('data received: ' + chunk);
        });
    });
    //request.write(post_data);
    request.end();
}, 3000);

setInterval(function() {
    _Debug('Request now');
    options.port = 8080;
    var request = http.request(options, function(res) {
        res.on('data', function (chunk) {
            _Debug('data received: ' + chunk);
        });
    });
    //request.write(post_data);
    request.end();
}, 3000);


// var test =  "GET /favicon.ico HTTP/1.1\r\n" +
//     "Host: localhost:8080\r\n" +
//     "Connection: keep-alive\r\n"+
//     "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36\r\n" +
//     "Accept: image/webp,image/apng,image/*,*/*;q=0.8\r\n" +
//     "Referer: http://localhost:8080/test\r\n" +
//     "Accept-Encoding: gzip, deflate, br\r\n" +
//     "Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7\r\n" +
//     "Cookie: ir-session-id=2Wk6o8jq1Rin\r\n";
//
// var req = parseRequest(test);