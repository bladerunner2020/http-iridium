var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html '});
    res.write('<meta content="text/html; charset=UTF-8" http-equiv="Content-Type">');
    res.write('Привет Мир!', 'utf8');
    res.end();
}).listen(8080);



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



