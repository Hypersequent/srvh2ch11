import net from "node:net";
import http from "node:http";
import http2 from "node:http2";

const HTTP2_PREFACE = "PRI * HTTP/2.0";

function createServer(options, onRequestHandler) {
  if (typeof options === "function") {
    onRequestHandler = options;
    options = {};
  }

  options = options || {};
  const http1Options = options.http1 || {};
  const http2Options = options.http2 || {};

  const h1Server = http.createServer(http1Options, onRequestHandler);
  const h2Server = http2.createServer(http2Options, onRequestHandler);

  const rawConnListener = async (socket) => {
    socket.once("data", (chunk) => {
      socket.pause();
      socket.unshift(chunk);

      const prefix = chunk.toString(
        "ascii",
        0,
        Math.min(chunk.length, HTTP2_PREFACE.length),
      );

      if (prefix === HTTP2_PREFACE || prefix.startsWith(HTTP2_PREFACE)) {
        h2Server.emit("connection", socket);
      } else {
        socket.resume();
        h1Server.emit("connection", socket);
      }
    });
  };

  const rawServer = net.createServer(rawConnListener);

  const listen = rawServer.listen.bind(rawServer);
  const close = (callback) => {
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
