// app.js
/* global _DEBUGGER, DebugConsole, _Log, _Debug, _Error */

var appVersion = '{{ VERSION }}';

var debugConsole = new DebugConsole({
    lineCount: 25,
    maxBufferSize: 1024,
    noConsoleLog: false,
    //  defaultPage: 'Main',
    debugPage: 'Debug'});
_DEBUGGER.addConsole(debugConsole);

_Log('Starting http-test v.' + appVersion, 'app');

var http = require('http');

// eslint-disable-next-line no-unused-vars
function testHttpRequest() {
    _Debug('Request now');

    var options = {
        host: 'www.auvix.ru',
        port: 80,
        path: '/',
        method: 'GET'
    };

    var request = http.request(options, function(res) {
        res.on('data', function (chunk) {
            _Debug('data received. Length: ' + chunk.length);
        });
    });

    request.on('error', function(err) {
        _Error('request error: ' + err, 'app');
    });

    request.end();
}

