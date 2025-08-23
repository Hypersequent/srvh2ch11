import srvh2ch11 from "srvh2ch11";

const server = srvh2ch11.createServer((req, res) => {
  const protocol = req.httpVersion === "2.0" ? "HTTP/2" : "HTTP/1.1";

  res.writeHead(200, {
    "Content-Type": "text/plain",
    "X-Protocol": protocol,
  });

  res.end(
    `Hello from ${protocol}!\n` +
      `Method: ${req.method}\n` +
      `URL: ${req.url}\n` +
      `HTTP Version: ${req.httpVersion}`,
  );
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Supports both HTTP/1.1 and HTTP/2 cleartext (h2c)`);
  console.log("");
  console.log("Test with:");
  console.log(`  HTTP/1.1: curl http://localhost:${PORT}/`);
  console.log(
    `  HTTP/2:   curl --http2-prior-knowledge http://localhost:${PORT}/`,
  );
});

process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
