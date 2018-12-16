// app.js
/* global _DEBUGGER, DebugConsole, _Log, _Debug, _Error */

var appVersion = '{{ VERSION }}';

var debugConsole = new DebugConsole({
    lineCount: 25,
    maxBufferSize: 1024,
    noConsoleLog: false,
    //  defaultPage: 'Main',
    debugPage: 'Debug'});

debugConsole.setColumnsCount(80);

_DEBUGGER.addConsole(debugConsole);
_DEBUGGER.enable('HttpDriver', 'DEBUG');

_Log('Starting http-test v.' + appVersion, 'app');

var http = require('http');

// eslint-disable-next-line no-unused-vars
function testHttpRequest() {
    doRequest('Auvix', 'www.auvix.ru');
}

function testHttpRequest2() {
    doRequest('Google', 'www.google.com');
}


function testHttpRequest3() {
    doRequest('Abracadabra', 'www.abra-cada-braxsezzz.com');
}

// eslint-disable-next-line no-unused-vars
function testMultipleRequests() {
    testHttpRequest2();
    testHttpRequest2();
    testHttpRequest3();
    testHttpRequest2();
}



function doRequest(name, url) {
    _Debug('Request: ' + name + '. Url: ' + url, 'app');

    var options = {
        host: url,
        port: 80,
        path: '/',
        method: 'GET'
    };

    var request = http.request(options, function(res) {
        res.on('data', function (chunk) {
            _Debug('Data received for: ' + name + '. Length: ' + chunk.length, 'app');
        });
    });

    request.on('error', function(err) {
        _Error('Request error: ' + name + '. Error code: ' + err, 'app');
    });

    request.end();
}




