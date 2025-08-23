# srvh2ch11

A simple Node.js module that creates a server supporting both HTTP/1.1 and HTTP/2 cleartext (h2c) with prior knowledge on the same port.

## Why?

HTTP/1.1 has security limitations when used for connections from reverse proxies to upstream servers ([http1mustdie.com](https://http1mustdie.com/)). HTTP/2 offers significant improvements, but within secure networks and internal infrastructure, managing TLS certificates adds unnecessary complexity.

HTTP/2 Cleartext (h2c) provides some security benefits of HTTP/2 without requiring TLS (clear separation of request body and headers). However, migrating infrastructure from HTTP/1.1 to h2c requires a transition period where both protocols must be supported.

While Node.js's `http2.createServer` has an `allowHTTP1` option, it only works with TLS connections. There are no plans to fix this limitation ([nodejs/node#44887](https://github.com/nodejs/node/issues/44887)).

Hence this package.


## How it works

srvh2ch11 solves this by:
1. Creating a raw TCP server that listens for incoming connections
2. Sniffing the initial bytes to detect the HTTP/2 connection preface (`PRI * HTTP/2.0`)
3. Routing the connection to either an HTTP/1.1 or HTTP/2 server based on the detected protocol

**Important**: This module only supports HTTP/2 with prior knowledge. The client must know in advance that the server supports HTTP/2 cleartext and send the connection preface immediately. There is no HTTP/1.1 to HTTP/2 upgrade negotiation.

## Installation

```bash
npm install srvh2ch11
```

## Usage

### Basic usage

```javascript
import srvh2ch11 from "srvh2ch11";

const server = srvh2ch11.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello from HTTP/" + req.httpVersion);
});

server.listen(8080, () => {
    console.log("Server listening on port 8080");
});
```

### With separate options for HTTP/1.1 and HTTP/2

```javascript
import srvh2ch11 from "srvh2ch11";

const options = {
    http1: {
        // HTTP/1.1 specific options
    },
    http2: {
        // HTTP/2 specific options
        maxConcurrentStreams: 100
    }
};

const server = srvh2ch11.createServer(options, (req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello from HTTP/" + req.httpVersion);
});

server.listen(8080);
```

## API

### `srvh2ch11.createServer([options], onRequestHandler)`

Creates a server that can handle both HTTP/1.1 and HTTP/2 cleartext connections.

- `options` (optional): Configuration object with the following structure:
  - `http1`: Options passed to `http.createServer()`
  - `http2`: Options passed to `http2.createServer()`
  - **Note**: Currently only `http1` and `http2` keys are used from the options object. Any other keys will be ignored.
- `onRequestHandler`: The request handler function with signature `(req, res) => {}`

Returns an object with:
- `listen(port, [callback])`: Start listening on the specified port
- `close([callback])`: Close all servers (raw, HTTP/1.1, and HTTP/2)
- `on(event, handler)`: Add event listeners
- `address()`: Get the server address
- `h1Server`: The underlying HTTP/1.1 server instance
- `h2Server`: The underlying HTTP/2 server instance
- `rawServer`: The underlying raw TCP server instance

## Testing

Test with HTTP/1.1:
```bash
curl http://localhost:8080/
```

Test with HTTP/2:
```bash
curl --http2-prior-knowledge http://localhost:8080/
```

## Example

Run the included example:
```bash
npm run example
```

## Testing

The module includes comprehensive test suites:

### JavaScript tests (Vitest)

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Bash tests (curl-based)

```bash
# Run basic curl tests
npm run test:bash
# or directly
./test-bash-curl.sh
```

The tests cover:
- HTTP/1.1 GET, POST, and concurrent requests
- HTTP/2 with prior knowledge (GET, POST, concurrent streams)
- Mixed protocol handling (HTTP/1.1 and HTTP/2 simultaneously)
- Server configuration with separate options
- Basic curl-based integration tests

## Acknowledgments

Thanks to GitHub users [@fkoemep](https://github.com/fkoemep) and [@stT-e5gna2z5MBS](https://github.com/stT-e5gna2z5MBS) who shared example implementations in the [Node.js issue #44887](https://github.com/nodejs/node/issues/44887).

This package was made possible by [Hypersequent](https://hypersequent.com), creators of [QA Sphere](https://qasphere.com) - a fast, pleasant to use Test Management System.

## License

MIT
