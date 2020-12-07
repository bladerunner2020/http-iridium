# HttpIridium for iRidium mobile 

HttpIridium allows to create an http server in Iridium projects

HttpIridium requires the following modules:
- [EventEmitter](https://github.com/bladerunner2020/event-emitter)
- [js-ext](https://github.com/bladerunner2020/js-ext)

## Usage

Add the following scripts to your project:
- **s-ext.js** from [js-ext](https://github.com/bladerunner2020/js-ext) to your project 
- **event-emitter.js** from [EventEmitter](https://github.com/bladerunner2020/event-emitter)
- **http_iridium.js** from this project 

Then you can create an http server:

```js
var http = new HttpIridium();

http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html ' });
  res.write('<meta content="text/html; charset=UTF-8" http-equiv="Content-Type">');
  res.write('Привет Мир 8080!', 'utf8');
  res.end();
}).listen(8080);
```

## Authors

* Alexander Pivovarov aka Bladerunner2020 ([pivovarov@gmail.com](mailto:pivovarov@gmail.com))
