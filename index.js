(function (definition) {
    "use strict";
    if (typeof module !== 'undefined') module.http = definition();
})(function () {
    "use strict";
    if (!this.http) this.http = new HttpDriver();

    return this.http;
});


var CRLF  = '\r\n';

var STATUS_CODES = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing',                 // RFC 2518, obsoleted by RFC 4918
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status',               // RFC 4918
    208: 'Already Reported',
    226: 'IM Used',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',         // RFC 7238
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: 'I\'m a teapot',              // RFC 2324
    421: 'Misdirected Request',
    422: 'Unprocessable Entity',       // RFC 4918
    423: 'Locked',                     // RFC 4918
    424: 'Failed Dependency',          // RFC 4918
    425: 'Unordered Collection',       // RFC 4918
    426: 'Upgrade Required',           // RFC 2817
    428: 'Precondition Required',      // RFC 6585
    429: 'Too Many Requests',          // RFC 6585
    431: 'Request Header Fields Too Large', // RFC 6585
    451: 'Unavailable For Legal Reasons',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',    // RFC 2295
    507: 'Insufficient Storage',       // RFC 4918
    508: 'Loop Detected',
    509: 'Bandwidth Limit Exceeded',
    510: 'Not Extended',               // RFC 2774
    511: 'Network Authentication Required' // RFC 6585
};


var GlobalHttpDriverCount = 0;

function HttpDriver() {
    var that = this;
    this.is_connected = false;
    this.httpServer = null;
    this.httpDevice = null;


    this.getHttpDevice = function() {
        return that.httpDevice ? that.httpDevice : that.createDevice();
    };

    this.createDevice = function() {
        GlobalHttpDriverCount++;

        that.httpDevice = IR.CreateDevice(IR.DEVICE_CUSTOM_HTTP_TCP, "IridiumHttpDriver" + GlobalHttpDriverCount,
            {Host: '127.0.0.1',
                Port: 80,
                SSL: false,
                SendMode: IR.ALWAYS_CONNECTED,
                DebugLevel: 0,
                ScriptMode: IR.DIRECT_AND_SCRIPT,
                SendCommandAttempts: 0,
                ConnectWaitTimeMax: 3000,
                ReceiveWaitTimeMax: 3000,
                Login: "",
                Password: ""
            });

        IR.AddListener(IR.EVENT_ONLINE, that.httpDevice, function(){
            that.is_connected = true;
        });

        return that.httpDevice;
    };

    this.createServer =  function(requestListener) {
        return that.httpServer ? that.httpServer : that.httpServer = new HttpServer(http, requestListener);
    };


    this.request = function (options, callback) {
        return new HttpRequest(that, options, callback);
    };


}

function HttpRequest(http, options, callback) {
    var that = this;

    this.HttpDriver = http;

    this.Host = options.host || options.hostname || 'localhost';
    this.Port = +options.port || 80;
    this.Headers = options.headers ? CopyHeaders(options.headers) : null;
    this.Method = options.method || 'GET';
    this.Path = options.path;

    this.RequestTimeout = null;
    this.requestCallback = null;
    this.callback = callback;
    this.Data = '';


    /**
     *
     * @param chunk <string> | <Buffer>
     */
    this.write = function (chunk) {
        that.Data = that.Data + chunk;

    };

    this.setHeader =  function(name, value){
        if (!that.Headers) that.Headers = {};
        that.Headers[name] = value;
    };


    this.end = function () {
        var device = that.HttpDriver.getHttpDevice();
        device.SetParameters({Host: that.Host, Port: that.Port});


        device.SendEx({
            Type: that.Method,
            Url: that.Path,
            Headers: that.Headers,
            Data: [that.Data],
            cbReceiveText: that.OnReceiveText,
            cbReceiveStartBody: that.OnReceiveStart,
            cbReceivePartBody: that.OnReceivePartBody,
            cbReceiveEndBody : that.OnEnd,
            cbTimeOut: that.OnTimeout
        });
        that.Data = '';
    };

    this.setTimeout = function (timeout, callback) {
        that.RequestTimeout = timeout;  //TODO: It's not used now.
        that.requestCallback = callback;
    };


    this.abort = function () {
        IR.Log('Abort');
        that.Data = '';
    };

    this.OnReceiveText =  function(text, code, headers) {
        var response = new HttpIncomingMessage(code, headers);
        if (that.callback) that.callback(response);

        var callbacks = response.callbacks;
        if (callbacks.data) callbacks.data(text);
        if (callbacks.end) callbacks.end();
    };

    this.OnReceiveStart = function(stream) {

    };

    this.OnReceivePartBody = function(stream) {

    };

    this.on = function (event, callback) {

    };

    this.OnEnd = function(size) {
    };

    this.OnTimeout = function () {
        if (that.requestCallback) that.requestCallback();
    };

    function CopyHeaders(headers) {
        var new_headers = {};
        for (key in headers) {
            if (headers.hasOwnProperty(key))
                new_headers[key]  = headers[key];
        }
        return new_headers;
    }

}

function HttpIncomingMessage(code, headers) {
    var that = this;
    this.statusCode = code;
    this.headers = headers;
    this.callbacks = {};


    this.on = function(event, callback) {
        that.callbacks[event] = callback;
    };
}

var SERVER_MAX_CLIENT = 10;

function HttpServer(http, requestListener) {
    var that = this;

    this.httpDriver = http;
    this.requestListener = requestListener;
    this.server = null;

    this.listen = function(port) {
        that.server = IR.CreateDevice(IR.DEVICE_CUSTOM_SERVER_TCP, 'IridiumHttpServer',
            {Port: +port, MaxClients: SERVER_MAX_CLIENT, SSL: false});

        IR.AddListener(IR.EVENT_RECEIVE_TEXT, that.server, function(data, id){

            var res = new HttpServerResponse(that);

            var req = parseRequest(data);
            req.client_id = id;
            res.client_id = id;

            if (that.requestListener) {
                that.requestListener(req, res);
            }

        });

    };

}

function HttpServerResponse(httpServer) {
    var that = this;

    this.httpServer = httpServer;

    this.statusCode = null;
    this.statusMessage = null;
    this._headers = null;
    this.data = null;


    // this.writeHead = function(statusCode, statusMessage, headers) {
    //     that.headIsSet = true;
    //     that.statusCode = statusCode;
    //     that.statusMessage = statusMessage;
    //     that.headers = headers;
    // };

}

HttpServerResponse.prototype.end = function () {
    var data = this.prepareHeader();
    if (this.data && this.data.length) data += this.data;

    var server = this.httpServer.server;


    server.Send([data], this.client_id);
};


HttpServerResponse.prototype.write = function (chunk) {
    this.data = this.data ? this.data + chunk : chunk;
};

HttpServerResponse.prototype.writeHead = function(statusCode, reason, obj) {
    if (typeof reason === 'string') {
        // writeHead(statusCode, reasonPhrase[, headers])
        this.statusMessage = reason;
    } else {
        // writeHead(statusCode[, headers])
        this.statusMessage =
            this.statusMessage || STATUS_CODES[statusCode] || 'unknown';
        obj = reason;
    }
    this.statusCode = statusCode;

    if (obj) {
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k) this.setHeader(k, obj[k]);
        }
    }

    statusCode |= 0;
    if (statusCode < 100 || statusCode > 999)
        throw new Error('Invalid status code: ' + statusCode);

    if (checkInvalidHeaderChar(this.statusMessage))
        throw new Error('Invalid character in statusMessage.');

};


HttpServerResponse.prototype.setHeader = function(name, value) {
    if (value === undefined)
        throw new Error('"value" required in setHeader("' + name + '", value)');
    if (this._header)
        throw new Error('Can\'t set headers after they are sent.');

    if (this._headers === null) this._headers = {};

    var key = name.toLowerCase();
    this._headers[key] = value;
};

HttpServerResponse.prototype.prepareHeader = function() {

    function byteLength(str) {
        if (!str) return 0;
        var s = str.length;
        for (var i=str.length-1; i>=0; i--) {
            var code = str.charCodeAt(i);
            if (code > 0x7f && code <= 0x7ff) s++;
            else if (code > 0x7ff && code <= 0xffff) s+=2;
            if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
        }
        return s;
    }

    // firstLine in the case of request is: 'GET /index.html HTTP/1.1\r\n'
    // in the case of response it is: 'HTTP/1.1 200 OK\r\n'
    if (!this._headers) this.writeHead(200, 'OK', {'Content-Type' : 'text/plain'});

    var statusLine = 'HTTP/1.1 ' + this.statusCode.toString() + ' ' +  this.statusMessage + CRLF;

    var contentLength = byteLength(this.data);
    this.setHeader('Content-Length', contentLength);

    var header_str = statusLine;
    var headers = this._headers;
    if (headers) {
        var keys = Object.keys(headers);
        var isArray = Array.isArray(headers);
        var field, value;

        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            if (isArray) {
                field = headers[key][0];
                value = headers[key][1];
            } else {
                field = key;
                value = headers[key];
            }

            if (Array.isArray(value)) {
                for (var j = 0; j < value.length; j++) {
                    header_str += field + ': ' + escapeHeaderValue(value[j]) + CRLF;
                }
            } else {
                header_str += field + ': ' + escapeHeaderValue(value) + CRLF;
            }
        }
    }

    var date = new Date();

    header_str += 'Date: ' + date.toString() + CRLF;
    header_str +=  CRLF;

    return header_str;
};



function checkInvalidHeaderChar(val) {
    val += '';
    if (val.length < 1)
        return false;
    var c = val.charCodeAt(0);
    if ((c <= 31 && c !== 9) || c > 255 || c === 127)
        return true;
    if (val.length < 2)
        return false;
    c = val.charCodeAt(1);
    if ((c <= 31 && c !== 9) || c > 255 || c === 127)
        return true;
    if (val.length < 3)
        return false;
    c = val.charCodeAt(2);
    if ((c <= 31 && c !== 9) || c > 255 || c === 127)
        return true;
    for (var i = 3; i < val.length; ++i) {
        c = val.charCodeAt(i);
        if ((c <= 31 && c !== 9) || c > 255 || c === 127)
            return true;
    }
    return false;
}

function escapeHeaderValue(value) {
    // Protect against response splitting. The regex test is there to
    // minimize the performance impact in the common case.
    return /[\r\n]/.test(value) ? value.replace(/[\r\n]+[ \t]*/g, '') : value;
}

function parseRequest(requestString) {
    var request = {};
    var lines = requestString.split(/\r?\n/);

    var parsedRequestLine = parseRequestLine(lines.shift());
    request['method'] = parsedRequestLine['method'];
    request['url'] = parsedRequestLine['uri'];
    request['protocol'] = parsedRequestLine['protocol'];

    var headerLines = [];
    while (lines.length > 0) {
        var line = lines.shift();
        if (line == '') break;
        headerLines.push(line);
    }

    request['headers'] = parseHeaders(headerLines);
    request['body'] = lines.join('\r\n');

    return request;
}

function parseHeaders (headerLines) {
    var headers = {};
    for (var i= 0; i < headerLines.length; i++){
        var line = headerLines[i];
        var parts = line.split(":");
        var key = parts.shift();
        headers[key] = parts.join(":").trim();
    }

    return headers;
}

function parseStatusLine(statusLine) {
    var parts = statusLine.match(/^(.+) ([0-9]{3}) (.*)$/);
    var parsed = {};

    if (!parts) {
        parsed['protocol'] = parts[1];
        parsed['statusCode'] = parts[2];
        parsed['statusMessage'] = parts[3];
    }

    return parsed;
}
    

function parseRequestLine(requestLineString) {
    var parts = requestLineString.split(' ');
    var parsed = {};

    parsed['method'] = parts[0];
    parsed['uri'] = parts[1];
    parsed['protocol'] = parts[2];

    return parsed;
}






