import Koa from "koa";
import logger from "koa-logger";
import bodyParser from "koa-bodyparser";
import Router from "koa-router";
import fs from "fs/promises";
import YAML from "yaml";
import mapAlerts from "./mapAlerts.js";
import WebhookClient from "./webhook.js";
import LarkClient from "./lark.js";

const app = new Koa();
app.use(bodyParser());
app.use(logger());

const config = await (async () => {
  try {
    const configString = await fs.readFile("config.yaml", {
      encoding: "utf8",
    });
    return YAML.parse(configString);
  } catch (e) {
    console.error("Invalid config!");
    throw e;
  }
})();

const router = new Router();

const clients = {};

config.providers.forEach(({ name, hash, type, config }) => {
  const ClientClass = {
    webhook: WebhookClient,
    bot: LarkClient,
  }[type];
  if (!ClientClass) {
    throw new Error(`Unknown type ${type}`);
  }
  const client = new ClientClass(name, config);
  clients[hash] = client;
})

router.post("/webhook/alert/:hash", async (ctx) => {
  const client = clients[ctx.params.hash];
  if (!client) {
    ctx.status = 404;
    ctx.body = "Not Found";
  }
  try {
    for await (const alert of mapAlerts(ctx.request.body)) {
      client.onAlert(alert);
    }
    ctx.body = "Message(s) sent";
  } catch (e) {
    ctx.status = 500;
    ctx.body = "Unable to send message";
    console.error(e);
  }
});

router.post("/webhook/callback/:hash", async (ctx) => {
  const client = clients[ctx.params.hash];
  if (!client || !client.onCallback) {
    ctx.status = 404;
    ctx.body = "Not Found";
  }
  try {
    ctx.body = await client.onCallback(ctx.request.body);
  } catch (e) {
    ctx.status = 500;
    ctx.body = "Callback failed";
    console.error(e);
  }
});

router.get("/healthz", (ctx) => {
  ctx.body = "OK";
});

app.use(router.routes()).use(router.allowedMethods());

const port = parseInt(process.env.PORT || "3000");
app.listen(port);
console.log(`Server started at port ${port}`);
