import { describe, it, expect, beforeAll, afterAll } from "vitest";
import srvh2ch11 from "./index.js";
import http from "node:http";
import http2 from "node:http2";

describe("srvh2ch11", () => {
  let server;
  let port;

  beforeAll(() => {
    return new Promise((resolve) => {
      server = srvh2ch11.createServer((req, res) => {
        res.writeHead(200, { 
          "Content-Type": "application/json",
          "X-Protocol": req.httpVersion 
        });
        res.end(JSON.stringify({
          version: req.httpVersion,
          method: req.method,
          url: req.url,
          headers: req.headers
        }));
      });

      server.listen(0, () => {
        port = server.address().port;
        console.log(`Test server listening on port ${port}`);
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise((resolve) => {
      server.close(() => {
        console.log("Test server closed");
        resolve();
      });
    });
  });

  describe("HTTP/1.1", () => {
    it("should handle HTTP/1.1 GET request", async () => {
      const response = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port,
            path: "/test",
            method: "GET",
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: JSON.parse(data),
              });
            });
          }
        );
        req.on("error", reject);
        req.end();
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-protocol"]).toBe("1.1");
      expect(response.body.version).toBe("1.1");
      expect(response.body.method).toBe("GET");
      expect(response.body.url).toBe("/test");
    });

    it("should handle HTTP/1.1 POST request with body", async () => {
      const postData = JSON.stringify({ test: "data" });
      
      const response = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port,
            path: "/api/data",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: JSON.parse(data),
              });
            });
          }
        );
        req.on("error", reject);
        req.write(postData);
        req.end();
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.version).toBe("1.1");
      expect(response.body.method).toBe("POST");
      expect(response.body.url).toBe("/api/data");
      expect(response.body.headers["content-type"]).toBe("application/json");
    });

    it("should handle multiple concurrent HTTP/1.1 requests", async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: "localhost",
              port,
              path: `/concurrent/${i}`,
              method: "GET",
            },
            (res) => {
              let data = "";
              res.on("data", (chunk) => (data += chunk));
              res.on("end", () => {
                resolve(JSON.parse(data));
              });
            }
          );
          req.on("error", reject);
          req.end();
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach((response, i) => {
        expect(response.version).toBe("1.1");
        expect(response.url).toBe(`/concurrent/${i}`);
      });
    });
  });

  describe("HTTP/2", () => {
    it("should handle HTTP/2 GET request with prior knowledge", async () => {
      const response = await new Promise((resolve, reject) => {
        const client = http2.connect(`http://localhost:${port}`);
        
        const req = client.request({
          ":path": "/test-h2",
          ":method": "GET",
        });

        let data = "";
        req.on("response", (headers) => {
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => {
            client.close();
            resolve({
              headers,
              body: JSON.parse(data),
            });
          });
        });

        req.on("error", reject);
        req.end();
      });

      expect(response.headers[":status"]).toBe(200);
      expect(response.headers["x-protocol"]).toBe("2.0");
      expect(response.body.version).toBe("2.0");
      expect(response.body.method).toBe("GET");
      expect(response.body.url).toBe("/test-h2");
    });

    it("should handle HTTP/2 POST request", async () => {
      const postData = JSON.stringify({ h2: "test" });
      
      const response = await new Promise((resolve, reject) => {
        const client = http2.connect(`http://localhost:${port}`);
        
        const req = client.request({
          ":path": "/api/h2-data",
          ":method": "POST",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(postData),
        });

        let data = "";
        req.on("response", (headers) => {
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => {
            client.close();
            resolve({
              headers,
              body: JSON.parse(data),
            });
          });
        });

        req.on("error", reject);
        req.write(postData);
        req.end();
      });

      expect(response.headers[":status"]).toBe(200);
      expect(response.body.version).toBe("2.0");
      expect(response.body.method).toBe("POST");
      expect(response.body.url).toBe("/api/h2-data");
    });

    it("should handle multiple concurrent HTTP/2 streams", async () => {
      const client = http2.connect(`http://localhost:${port}`);
      
      const requests = Array.from({ length: 10 }, (_, i) => 
        new Promise((resolve, reject) => {
          const req = client.request({
            ":path": `/h2-stream/${i}`,
            ":method": "GET",
          });

          let data = "";
          req.on("response", (headers) => {
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              resolve(JSON.parse(data));
            });
          });

          req.on("error", reject);
          req.end();
        })
      );

      const responses = await Promise.all(requests);
      client.close();
      
      responses.forEach((response, i) => {
        expect(response.version).toBe("2.0");
        expect(response.url).toBe(`/h2-stream/${i}`);
      });
    });
  });

  describe("Mixed protocols", () => {
    it("should handle HTTP/1.1 and HTTP/2 requests concurrently", async () => {
      const h1Request = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port,
            path: "/mixed-h1",
            method: "GET",
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve(JSON.parse(data));
            });
          }
        );
        req.on("error", reject);
        req.end();
      });

      const h2Request = new Promise((resolve, reject) => {
        const client = http2.connect(`http://localhost:${port}`);
        const req = client.request({
          ":path": "/mixed-h2",
          ":method": "GET",
        });

        let data = "";
        req.on("response", () => {
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => {
            client.close();
            resolve(JSON.parse(data));
          });
        });

        req.on("error", reject);
        req.end();
      });

      const [h1Response, h2Response] = await Promise.all([h1Request, h2Request]);

      expect(h1Response.version).toBe("1.1");
      expect(h1Response.url).toBe("/mixed-h1");
      
      expect(h2Response.version).toBe("2.0");
      expect(h2Response.url).toBe("/mixed-h2");
    });
  });

  describe("Server with options", () => {
    it("should accept separate options for http1 and http2", async () => {
      const testServer = await new Promise((resolve) => {
        const srv = srvh2ch11.createServer(
          {
            http1: { 
              keepAliveTimeout: 1000 
            },
            http2: { 
              maxConcurrentStreams: 50 
            }
          },
          (req, res) => {
            res.writeHead(200);
            res.end("OK");
          }
        );

        srv.listen(0, () => {
          resolve(srv);
        });
      });

      const testPort = testServer.address().port;

      const response = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port: testPort,
            path: "/",
            method: "GET",
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                body: data,
              });
            });
          }
        );
        req.on("error", reject);
        req.end();
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("OK");

      await new Promise((resolve) => testServer.close(resolve));
    });
  });
});