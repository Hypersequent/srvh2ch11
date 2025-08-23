import { IncomingMessage, ServerResponse, Server as HttpServer } from 'node:http';
import { Http2Server, Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import { Server as NetServer, Socket } from 'node:net';

export interface ServerOptions {
  http1?: any;
  http2?: any;
}

export type RequestHandler = (
  req: IncomingMessage | Http2ServerRequest,
  res: ServerResponse | Http2ServerResponse
) => void;

export interface H2CH11Server {
  listen: NetServer['listen'];
  close: (callback?: () => void) => void;
  on: NetServer['on'];
  address: NetServer['address'];
  h1Server: HttpServer;
  h2Server: Http2Server;
  rawServer: NetServer;
}

export function createServer(onRequestHandler: RequestHandler): H2CH11Server;
export function createServer(options: ServerOptions, onRequestHandler: RequestHandler): H2CH11Server;

declare const _default: {
  createServer: typeof createServer;
};

export default _default;