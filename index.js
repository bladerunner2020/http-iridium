function HttpDriver() {
    var that = this;

    this.is_connected = false;

    this.Driver = IR.CreateDevice(IR.DEVICE_CUSTOM_HTTP_TCP, "IridiumHttpDriver",
        {Host: "127.0.0.1",
            Port: 80,
            SSL: false,
            SendMode: IR.ALWAYS_CONNECTED,
            DebugLevel: 0,
            ScriptMode: IR.DIRECT_AND_SCRIPT,
            SendCommandAttempts: 0,
            ConnectWaitTimeMax: 3000,
            ReceiveWaitTimeMax: 5000,
            Login: "",
            Password: ""
        });

    this.request = function (options, callback) {
        return new HttpRequest(that, options, callback);
    };

    IR.AddListener(IR.EVENT_ONLINE, that.Driver, function(){
        that.is_connected = true;
    });

    IR.AddListener(IR.EVENT_OFFLINE, that.Driver, function () {
        that.is_connected = false;
    });

}

function HttpRequest(http, options, callback) {
    var that = this;

    this.HttpDriver = http;

    this.Host = options.host || 'localhost';
    this.Port = options.port || 80;
    this.Headers = options.headers ? CopyHeaders(options.headers) : null;
    this.Method = options.method || 'GET';
    this.Path = options.path;
    
    this.callbacks = {};
    this.Data = '';
    
    this.callbacks.request = callback;

    this.Response = null;


    /**
     *
     * @param chunk <string> | <Buffer>
     */
    this.write = function (chunk) {
        that.Data = that.data + chunk;

    };

    this.setHeader =  function(name, value){
        if (!that.Headers) that.Headers = {};
        that.Headers[name] = value;
    };

    this.write = function (chunk) {
        that.data = that.data.concat(chunk);

    };


    this.end = function () {
        if (!that.HttpDriver.is_connected) {
            var err = new Error('Not connected');
            if (that.callbacks.error) return that.callbacks.error(err);
            throw err;
        }

        var driver = that.HttpDriver.Driver;
        driver.SetParameters({Host: that.Host, Port: that.Port});
        driver.SendEx({
            Type: that.Method,
            Url: that.Path,
            Headers: that.Headers,
            Data: that.Data,
            cbReceiveText: that.OnReceiveText,
//            cbReceiveStartBody: that.OnReceiveStart,
//            cbReceivePartBody: that.OnReceivePartBody,
//            cbReceiveEndBody : that.OnEnd,
//            cbReceiveStream : that.OnReceiveStream,
            cbTimeOut: that.OnTimeout
        });
        that.Data = '';
    };

    this.setTimeout = function (timeout, callback) {
        // that.RequestTimeout = timeout;  //TODO: It's not used now.
        that.callbacks.timeout = callback;
    };


    this.abort = function () {
        that.Data = '';
    };

    this.OnReceiveText =  function(text, code, headers) {
        var response = new HttpResponse(code, headers);
        if (that.callbacks.request) that.callbacks.request(response);

        var callbacks = response.callbacks;
        if (callbacks.data) callbacks.data(text);
        if (callbacks.end) callbacks.end();
    };

    this.OnReceiveStart = function(stream) {
        throw new Error('Nom yet implemented');
    };

    this.OnReceivePartBody = function(stream) {
        throw new Error('Nom yet implemented');
    };

    this.OnReceiveStream = function (stream, code, headers) {
        var size = stream.getLength();
        var data = stream.getArray(size);

        var response = new HttpResponse(code, headers);
        if (that.callbacks.request) that.callbacks.request(response);

        var callbacks = response.callbacks;
        if (callbacks.data) callbacks.data(data);
        if (callbacks.end) callbacks.end();
    };

    this.on = function(event, callback) {
        that.callbacks[event] = callback;
    };

    this.OnEnd = function(size) {
        throw new Error('Nom yet implemented');
    };

    this.OnTimeout = function () {
        if (that.callbacks.timeout) that.callbacks.timeout();
    };

    function CopyHeaders(headers) {
        var new_headers = {};
        for (key in headers) {
            if (headers.hasOwnProperty(key))
                new_headers[key]  = headers[key];
        }
    }

}

function HttpResponse(code, headers) {
    var that = this;
    this.statusCode = code;
    this.headers = headers;
    this.callbacks = {};


    this.on = function(event, callback) {
        that.callbacks[event] = callback;
    };

}
