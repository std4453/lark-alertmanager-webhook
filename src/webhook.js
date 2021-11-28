import generate from "./generate.js";

class WebhookClient {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  async onAlert(alert) {
    const card = generate(alert);
    const { data } = await axios.post(this.config.url, {
      msg_type: "interactive",
      card,
    });
    const { StatusCode } = data;
    if (StatusCode != 0) {
      console.error("Send lark card failed:");
      console.error(data);
      throw new Error("Send lark card failed");
    }
  }
}

export default WebhookClient;
