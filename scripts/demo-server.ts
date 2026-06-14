import express from "express";
import { resolve } from "node:path";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const publicPath = resolve(process.cwd(), "public");

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "factorymind-demo" });
});

app.use(
  express.static(publicPath, {
    etag: true,
    maxAge: 0,
    setHeaders(response) {
      response.setHeader("cache-control", "no-store");
    }
  })
);

app.get("*", (_request, response) => {
  response.sendFile(resolve(publicPath, "index.html"));
});

app.listen(port, () => {
  console.log(`FactoryMind demo is running on http://localhost:${port}`);
});
