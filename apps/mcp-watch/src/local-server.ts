import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const port = Number(process.env.PORT ?? 8787);
const config = loadConfig();
const app = createApp(config, { local: true });

app.listen(port, () => {
  console.log(
    JSON.stringify({
      msg: "mcp_watch_local_listen",
      port,
      issuer: config.mcpIssuer,
      mcp: `http://127.0.0.1:${port}/mcp`,
      oauth: `http://127.0.0.1:${port}/.well-known/oauth-authorization-server`,
    }),
  );
});
