import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import srvh2ch11 from "./dist/index.js";
import http from "node:http";
import http2 from "node:http2";

describe("srvh2ch11", () => {
  let server;
  let port;

  before(async () => {
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

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        console.log(`Test server listening on port ${port}`);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
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

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.headers["x-protocol"], "1.1");
      assert.strictEqual(response.body.version, "1.1");
      assert.strictEqual(response.body.method, "GET");
      assert.strictEqual(response.body.url, "/test");
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

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.version, "1.1");
      assert.strictEqual(response.body.method, "POST");
      assert.strictEqual(response.body.url, "/api/data");
      assert.strictEqual(response.body.headers["content-type"], "application/json");
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
        assert.strictEqual(response.version, "1.1");
        assert.strictEqual(response.url, `/concurrent/${i}`);
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

      assert.strictEqual(response.headers[":status"], 200);
      assert.strictEqual(response.headers["x-protocol"], "2.0");
      assert.strictEqual(response.body.version, "2.0");
      assert.strictEqual(response.body.method, "GET");
      assert.strictEqual(response.body.url, "/test-h2");
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

      assert.strictEqual(response.headers[":status"], 200);
      assert.strictEqual(response.body.version, "2.0");
      assert.strictEqual(response.body.method, "POST");
      assert.strictEqual(response.body.url, "/api/h2-data");
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
        assert.strictEqual(response.version, "2.0");
        assert.strictEqual(response.url, `/h2-stream/${i}`);
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

      assert.strictEqual(h1Response.version, "1.1");
      assert.strictEqual(h1Response.url, "/mixed-h1");
      
      assert.strictEqual(h2Response.version, "2.0");
      assert.strictEqual(h2Response.url, "/mixed-h2");
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

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body, "OK");

      await new Promise((resolve) => testServer.close(resolve));
    });
  });
});