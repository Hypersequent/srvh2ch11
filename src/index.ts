import http, { IncomingMessage, ServerResponse } from "node:http";
import http2, { Http2Server, Http2ServerRequest, Http2ServerResponse } from "node:http2";
import net from "node:net";

const HTTP2_PREFACE = "PRI * HTTP/2.0";

export interface ServerOptions {
  http1?: any;
  http2?: any;
  ForceH2C?: boolean;
}

export type RequestHandler = ((req: IncomingMessage, res: ServerResponse) => void) &
  ((req: Http2ServerRequest, res: Http2ServerResponse) => void);

export interface H2CH11Server {
  listen: net.Server["listen"];
  close: (callback?: () => void) => void;
  on: net.Server["on"];
  address: net.Server["address"];
  h1Server: http.Server;
  h2Server: Http2Server;
  rawServer: net.Server;
}

const http1Headers = [
  "connection",
  "proxy-connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

export function createServer(onRequestHandler: RequestHandler): H2CH11Server;
export function createServer(options: ServerOptions, onRequestHandler: RequestHandler): H2CH11Server;
export function createServer(
  options?: ServerOptions | RequestHandler,
  onRequestHandler?: RequestHandler
): H2CH11Server {
  if (typeof options === "function") {
    onRequestHandler = options;
    options = {};
  }

  options = options || ({} as ServerOptions);
  const forceH2c = options.ForceH2C ?? process.env.SRV_FORCE_H2C === "true";
  const http1Options = options.http1 || {};
  const http2Options = options.http2 || {};

  const h1Server = http.createServer(http1Options, onRequestHandler!);
  const h2Server = http2.createServer(http2Options, (req, res) => {
    req.headers[process.env.HOST_HEADER ?? "host"] ??= req.headers[":authority"];
    res.setHeader = function (name, value) {
      if (http1Headers.includes(name.toLowerCase())) {
        return;
      }
      Http2ServerResponse.prototype.setHeader.call(this, name, value);
    };
    onRequestHandler!(req, res);
  });

  const rawConnListener = (socket: net.Socket) => {
    socket.once(
      "data",
      forceH2c
        ? (chunk: Buffer) => {
            socket.pause();
            socket.unshift(chunk);
            h2Server.emit("connection", socket);
          }
        : (chunk: Buffer) => {
            socket.pause();
            socket.unshift(chunk);

            const prefix = chunk.toString("ascii", 0, Math.min(chunk.length, HTTP2_PREFACE.length));

            if (prefix.startsWith(HTTP2_PREFACE)) {
              h2Server.emit("connection", socket);
            } else {
              socket.resume();
              h1Server.emit("connection", socket);
            }
          }
    );
  };

  const rawServer = net.createServer(rawConnListener);

  const listen = rawServer.listen.bind(rawServer);
  const close = (callback?: () => void) => {
    let closed = 0;
    const checkClose = () => {
      closed++;
      if (closed === 3 && callback) callback();
    };

    rawServer.close(checkClose);
    h1Server.close(checkClose);
    h2Server.close(checkClose);
  };

  return {
    listen,
    close,
    on: rawServer.on.bind(rawServer),
    address: rawServer.address.bind(rawServer),
    h1Server,
    h2Server,
    rawServer,
  };
}

export default { createServer };
