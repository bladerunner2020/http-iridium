/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
// Module: http_iridium
// Dependencies:
//        "js-ext": "git+https://github.com/bladerunner2020/js-ext.git"
//         "event-handler": "git+ssh://git@gitlab.com/general-modules/event-handler.git"

/* global EventHandler */

var CRLF = '\r\n';

var STATUS_CODES = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing', // RFC 2518, obsoleted by RFC 4918
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status', // RFC 4918
  208: 'Already Reported',
  226: 'IM Used',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect', // RFC 7238
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
  418: 'I\'m a teapot', // RFC 2324
  421: 'Misdirected Request',
  422: 'Un-processable Entity', // RFC 4918
  423: 'Locked', // RFC 4918
  424: 'Failed Dependency', // RFC 4918
  425: 'Unordered Collection', // RFC 4918
  426: 'Upgrade Required', // RFC 2817
  428: 'Precondition Required', // RFC 6585
  429: 'Too Many Requests', // RFC 6585
  431: 'Request Header Fields Too Large', // RFC 6585
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates', // RFC 2295
  507: 'Insufficient Storage', // RFC 4918
  508: 'Loop Detected',
  509: 'Bandwidth Limit Exceeded',
  510: 'Not Extended', // RFC 2774
  511: 'Network Authentication Required' // RFC 6585
};

var _globalHttpRequestCount = 0;
var _MAX_HTTP_REQUESTS = 65535;

var HTTP_DRIVER_REQUEST_NOT_READY = 0;
var HTTP_DRIVER_REQUEST_READY = 1;
var HTTP_DRIVER_REQUEST_EXECUTING = 0;

// Log levels
HttpDriver.LOG_LEVEL_EMERGENCY = 0;
HttpDriver.LOG_LEVEL_ALERT = 1;
HttpDriver.LOG_LEVEL_CRITICAL = 2;
HttpDriver.LOG_LEVEL_ERROR = 3;
HttpDriver.LOG_LEVEL_WARNING = 4;
HttpDriver.LOG_LEVEL_NOTICE = 5;
HttpDriver.LOG_LEVEL_INFO = 6;
HttpDriver.LOG_LEVEL_DEBUG = 7;
HttpDriver.LOG_LEVEL_NEVER = 8;

HttpDriver.setLogLevel = function(level) {
  HttpDriver.logLevel = level;
};

HttpDriver.logLevel = HttpDriver.LOG_LEVEL_WARNING;

function HttpDriver() {
  EventHandler.call(this);

  this.httpDevice = null;
  this.requests = [];
}

HttpDriver.prototype.setLogLevel = function(level) {
  if (this.httpDevice) {
    this.httpDevice.SetParameters({ LogLevel: level });
  }
  return this;
};

HttpDriver.prototype.request = function(options, callback) {
  var req = new HttpRequest(this, options, callback);
  this.addRequest(req);
  return req;
};

HttpDriver.prototype.createServer = function(requestListener) {
  return new HttpServer(this, requestListener);
};

HttpDriver.prototype.flushRequests = function() {
  this.requests = [];
};

HttpDriver.prototype.addRequest = function(req) {
  this.requests.push(req);
};

HttpDriver.prototype.removeRequest = function(req) {
  var index = this.requests.indexOf(req);
  if (index >= 0) {
    this.requests.splice(index, 1);
  }
  this.executeNext();
};

HttpDriver.prototype.executeNext = function() {
  var req = null;

  // Ищем request с флагом execStatus = ready to execute
  for (var i = 0; i < this.requests.length; i++) {
    if (this.requests[i].execStatus === HTTP_DRIVER_REQUEST_READY) {
      req = this.requests[i];
      // тут нельзя ставить break - в очереди может быть запрос, который исполняется
    } else if (this.requests[i].execStatus === HTTP_DRIVER_REQUEST_EXECUTING) {
      // Если есть запросы в обработке, то ждем их выполнения
      // _Debug('Another request is executing. Wait. (' + this.requests.length + ')', 'HttpDriver');
      return;
    }
  }
  if (!req) {
    // _Debug('No requests in the queue', 'HttpDriver');
    return;
  }

  // устанавливаем флаг executing
  req.execStatus = HTTP_DRIVER_REQUEST_EXECUTING;

  var httpDevice = this.getHttpDevice();

  httpDevice.SetParameters({ Host: req.host, Port: req.port });
  httpDevice.Connect(); // It's required if CreateDevice is called not at the start

  function onReceiveText(text, code, headers) {
    var response = new HttpIncomingMessage(code, headers);
    req.callEvent('response', response);
    response.callEvent('data', text);
    response.callEvent('end');
    req.finishRequest(); // По идее больше тут не нужен и его можно удалить. достаточно обработчика в onReceiveCode
  }

  // eslint-disable-next-line no-unused-vars
  function onReceiveCode(code) {
    req.finishRequest();
    // TODO: Добавить обработку различных кодов
  }

  function onTimeout() {
    req.callEvent('timeout', new Error('http request timeout'));
    req.finishRequest();
  }

  httpDevice.SendEx({
    Type: req.method,
    Url: req.path,
    Headers: req.headers,
    // Следующая строчка нужна, чтобы добавить "Connection: close" header
    // без нее неправильно обрабатываются GET-запросы, если в ответ приходит код 204 (нет контента)
    KeepAliveOut: 0,
    Data: req.data ? [req.data] : null,
    cbReceiveText: onReceiveText,
    cbReceiveCode: onReceiveCode,
    cbTimeOut: onTimeout
  });
};

HttpDriver.prototype.createDevice = function() {
  var that = this;

  // CreateDevice автоматически добавит в конце к имени счетчик, если такой драйвер уже есть
  this.httpDevice = IR.CreateDevice(IR.DEVICE_CUSTOM_HTTP_TCP, 'IridiumHttpDriver',
    {
      Host: '127.0.0.1',
      Port: 80,
      SSL: false,
      SendMode: IR.ALWAYS_CONNECTED,
      ScriptMode: IR.DIRECT_AND_SCRIPT,
      SendCommandAttempts: 0,
      ConnectWaitTimeMax: 3000,
      ReceiveWaitTimeMax: 3000,
      Login: '',
      Password: '',
      LogLevel: HttpDriver.logLevel
    });

  function onError(transportId, ip, port, hostIp, hostPort, errorCode) {
    that.httpDevice.Disconnect();

    for (var i = that.requests.length - 1; i >= 0; i--) {
      var req = that.requests[i];
      if (req.execStatus === HTTP_DRIVER_REQUEST_EXECUTING) {
        req.callEvent('error', new Error('http request error, code = ' + errorCode));
        req.finishRequest();
      }
    }
  }

  IR.AddListener(IR.EVENT_ERROR, this.httpDevice, onError, this);

  return this.httpDevice;
};

HttpDriver.prototype.getHttpDevice = function() {
  return this.httpDevice ? this.httpDevice : this.createDevice();
};

function HttpRequest(http, options, callback) {
  _globalHttpRequestCount = (_globalHttpRequestCount >= _MAX_HTTP_REQUESTS) ? 1 : _globalHttpRequestCount + 1;

  this.httpDriver = http;
  this.id = _globalHttpRequestCount;
  this.execStatus = HTTP_DRIVER_REQUEST_NOT_READY;

  this.host = options.host || options.hostname || '127.0.0.1';
  if (this.host === 'localhost') {
    this.host = '127.0.0.1';
  }

  this.port = +options.port || 80;
  this.headers = options.headers ? CopyHeaders(options.headers) : null;
  this.method = options.method || 'GET';
  this.path = options.path;
  this.data = '';

  this.callbacks = {};

  this.on('response', callback);

  function CopyHeaders(headers) {
    // TODO: not sure if it is necessary

    var newHeader = {};
    // eslint-disable-next-line no-restricted-syntax
    for (var key in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, key)) {
        newHeader[key] = headers[key];
      }
    }
    return newHeader;
  }
}

/**
 *
 * @param chunk <string> | <Buffer>
 */
HttpRequest.prototype.write = function(chunk) {
  this.data += chunk;
};

HttpRequest.prototype.setHeader = function(name, value) {
  if (!this.headers) {
    this.headers = {};
  }
  this.headers[name] = value;
};

HttpRequest.prototype.end = function(data) {
  if (data) {
    this.write(data);
  }

  // устанавливаем флаг ready to execute
  this.execStatus = HTTP_DRIVER_REQUEST_READY;
  this.httpDriver.executeNext();
};

HttpRequest.prototype.callEvent = function(/* event, arg1, arg2 ... */) {
  var args = Array.prototype.slice.call(arguments, 0);
  var event = args.shift();
  if (this.callbacks[event]) {
    this.callbacks[event].apply(this, args);
  }
};

HttpRequest.prototype.on = function(event, callback) {
  if (this.callbacks[event]) {
    throw new Error('Callback for this event is already set: ' + event);
  }

  this.callbacks[event] = callback;
  return this;
};

HttpRequest.prototype.abort = function() {
  this.finishRequest();
};

HttpRequest.prototype.setTimeout = function(timeout, callback) {
  return this.on('timeout', callback);
};

HttpRequest.prototype.finishRequest = function() {
  this.execStatus = HTTP_DRIVER_REQUEST_NOT_READY;
  this.data = '';
  this.httpDriver.removeRequest(this);
};

function HttpIncomingMessage(code, headers) {
  EventHandler.call(this);

  this.statusCode = code;
  this.headers = headers;
}

var SERVER_MAX_CLIENT = 10;

function HttpServer(http, requestListener) {
  this.httpDriver = http;
  this.requestListener = requestListener;
  this.server = null;
}

HttpServer.prototype.listen = function(port) {
  var that = this;

  // CreateDevice автоматически добавит в конце к имени счетчик, если такой драйвер уже есть
  this.server = IR.CreateDevice(IR.DEVICE_CUSTOM_SERVER_TCP, 'IridiumHttpServer',
    {
      Port: +port, MaxClients: SERVER_MAX_CLIENT, SSL: false, LogLevel: HttpDriver.logLevel
    });

  _Debug('Create custom server tcp: ' + this.server.Name + '. listen at ' + port, 'HttpDriver');

  /**
     *
     * @param {*} data
     * @param {*} id
     * @this
     */
  function onReceiveText(data, id) {
    _Debug(that.server.Name + ' - received (' + id + '): ' + data, 'HttpDriver');

    var res = new HttpServerResponse(this);

    var req = parseRequest(data);

    req.client_id = id;
    res.client_id = id;

    if (that.requestListener) {
      that.requestListener(req, res);
    }

    if (req.body) {
      req.callEvent('data', req.body);
    }

    req.callEvent('end');
  }

  IR.AddListener(IR.EVENT_RECEIVE_TEXT, this.server, onReceiveText, this);
};

function HttpServerResponse(httpServer) {
  this.httpServer = httpServer;

  this.statusCode = null;
  this.statusMessage = null;
  this._headers = null;
  this.data = null;
}

HttpServerResponse.prototype.end = function(chunk) {
  if (typeof chunk !== 'undefined') {
    this.write(chunk);
  }

  var data = this.prepareHeader();
  if (this.data && this.data.length) {
    data += this.data;
  }

  var server = this.httpServer.server;
  server.Send([data], this.client_id);
};

HttpServerResponse.prototype.write = function(chunk) {
  this.data = this.data ? this.data + chunk : chunk;
};

HttpServerResponse.prototype.writeHead = function(statusCode, reason, obj) {
  if (typeof reason === 'string') {
    // writeHead(statusCode, reasonPhrase[, headers])
    this.statusMessage = reason;
  } else {
    // writeHead(statusCode[, headers])
    this.statusMessage = this.statusMessage || STATUS_CODES[statusCode] || 'unknown';
    obj = reason;
  }
  this.statusCode = statusCode;

  if (obj) {
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k) {
        this.setHeader(k, obj[k]);
      }
    }
  }

  // eslint-disable-next-line no-bitwise
  statusCode |= 0;
  if (statusCode < 100 || statusCode > 999) {
    throw new Error('Invalid status code: ' + statusCode);
  }

  if (checkInvalidHeaderChar(this.statusMessage)) {
    throw new Error('Invalid character in statusMessage.');
  }
};

HttpServerResponse.prototype.setHeader = function(name, value) {
  if (value === undefined) {
    throw new Error('"value" required in setHeader("' + name + '", value)');
  }
  if (this._header) {
    throw new Error('Can\'t set headers after they are sent.');
  }

  if (this._headers === null) {
    this._headers = {};
  }

  var key = name.toLowerCase();
  this._headers[key] = value;
};

HttpServerResponse.prototype.prepareHeader = function() {
  function byteLength(str) {
    if (!str) {
      return 0;
    }
    var s = str.length;
    for (var i = str.length - 1; i >= 0; i--) {
      var code = str.charCodeAt(i);
      if (code > 0x7f && code <= 0x7ff) {
        s += 1;
      } else if (code > 0x7ff && code <= 0xffff) {
        s += 2;
      }
      if (code >= 0xDC00 && code <= 0xDFFF) {
        i -= 1; // trail surrogate
      }
    }
    return s;
  }

  // firstLine in the case of request is: 'GET /index.html HTTP/1.1\r\n'
  // in the case of response it is: 'HTTP/1.1 200 OK\r\n'
  if (!this._headers) {
    this.writeHead(200, 'OK', { 'Content-Type': 'text/plain' });
  }

  var statusLine = 'HTTP/1.1 ' + this.statusCode.toString() + ' ' + this.statusMessage + CRLF;

  var contentLength = byteLength(this.data);
  this.setHeader('Content-Length', contentLength);

  var headerStr = statusLine;
  var headers = this._headers;
  if (headers) {
    var keys = Object.keys(headers);
    var isArray = Array.isArray(headers);
    var field; var
      value;

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
          headerStr += field + ': ' + escapeHeaderValue(value[j]) + CRLF;
        }
      } else {
        headerStr += field + ': ' + escapeHeaderValue(value) + CRLF;
      }
    }
  }

  var date = new Date();

  headerStr += 'Date: ' + date.toString() + CRLF;
  headerStr += CRLF;

  return headerStr;
};

function checkInvalidHeaderChar(val) {
  val += '';
  if (val.length < 1) {
    return false;
  }
  var c = val.charCodeAt(0);
  if ((c <= 31 && c !== 9) || c > 255 || c === 127) {
    return true;
  }
  if (val.length < 2) {
    return false;
  }
  c = val.charCodeAt(1);
  if ((c <= 31 && c !== 9) || c > 255 || c === 127) {
    return true;
  }
  if (val.length < 3) {
    return false;
  }
  c = val.charCodeAt(2);
  if ((c <= 31 && c !== 9) || c > 255 || c === 127) {
    return true;
  }
  for (var i = 3; i < val.length; ++i) {
    c = val.charCodeAt(i);
    if ((c <= 31 && c !== 9) || c > 255 || c === 127) {
      return true;
    }
  }
  return false;
}

function escapeHeaderValue(value) {
  // Protect against response splitting. The regex test is there to
  // minimize the performance impact in the common case.
  return /[\r\n]/.test(value) ? value.replace(/[\r\n]+[ \t]*/g, '') : value;
}

function parseRequest(requestString) {
  var request = new HttpIncomingMessage(); // TODO: Нужно изменить на HttpMessage?

  var lines = requestString.split(/\r?\n/);

  var parsedRequestLine = parseRequestLine(lines.shift());
  request.method = parsedRequestLine.method;
  request.url = parsedRequestLine.uri;
  request.protocol = parsedRequestLine.protocol;

  var headerLines = [];
  while (lines.length > 0) {
    var line = lines.shift();
    if (line === '') {
      break;
    }
    headerLines.push(line);
  }

  request.headers = parseHeaders(headerLines);
  request.body = lines.join('\r\n');

  return request;
}

function parseHeaders(headerLines) {
  var headers = {};
  for (var i = 0; i < headerLines.length; i++) {
    var line = headerLines[i];
    var parts = line.split(':');
    var key = parts.shift();
    headers[key] = parts.join(':').trim();
  }

  return headers;
}

// eslint-disable-next-line no-unused-vars
function parseStatusLine(statusLine) {
  var parts = statusLine.match(/^(.+) ([0-9]{3}) (.*)$/);
  var parsed = {};

  if (!parts) {
    parsed.protocol = parts[1];
    parsed.statusCode = parts[2];
    parsed.statusMessage = parts[3];
  }

  return parsed;
}

function parseRequestLine(requestLineString) {
  var parts = requestLineString.split(' ');
  var parsed = {};

  parsed.method = parts[0];
  parsed.uri = parts[1];
  parsed.protocol = parts[2];

  return parsed;
}

if ((typeof IR === 'object') && (typeof module === 'object')) {
  module.http = new HttpDriver();
}
