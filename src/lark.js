import axios from "axios";
import dayjs from "dayjs";
import qs from "qs";
import generate from "./generate.js";
import utc from "dayjs/plugin/utc.js";
import _ from "lodash";

dayjs.extend(utc);

class LarkClient {
  constructor(name, config) {
    this.name = name;
    this.config = {
      listChats: true,
      verifyChats: true,
      ...config,
    };
    this.token = null;
    this.expireTime = 0;

    if (this.config.listChats) {
      this.listChats();
    }
  }

  onError(error) {
    if (error.response) {
      console.error(error.response.data);
      console.error(error.response.status);
      console.error(error.response.headers);
    } else if (error.request) {
      console.error(error.request);
    } else {
      console.error(error.message);
    }
  }

  async listChats() {
    try {
      console.log(`[lark/${this.name}] fetching chat list...`);
      const items = await this.getChats();
      console.log(`[lark/${this.name}] found ${items.length} chats:`);
      for (const { name, chat_id } of items) {
        console.log(`- ${name} (${chat_id})`);
      }
      if (this.config.verifyChats) {
        for (const chatID of this.config.chats) {
          if (items.findIndex(({ chat_id }) => chat_id === chatID) === -1) {
            console.warn(
              `[lark/${this.name}] chat id ${chatID} is not accessible by bot`
            );
          }
        }
      }
    } catch (error) {
      console.error(`[lark/${this.name}] failed to get chat list:`);
      this.onError(error);
    }
  }

  async refreshToken() {
    try {
      console.log(`[lark/${this.name}] refreshing token...`);
      const {
        data: { code, msg, tenant_access_token, expire },
      } = await axios.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          app_id: this.config.appID,
          app_secret: this.config.appSecret,
        }
      );
      if (code !== 0) {
        throw new Error(msg);
      }
      this.token = tenant_access_token;
      // minus 10 min
      this.expireTime = new Date().getTime() + (expire - 10 * 60) * 1000;
      console.log(`[lark/${this.name}] token refreshed: ${this.token}`);
    } catch (error) {
      console.error(`[lark/${this.name}] failed to refresh token:`);
      this.onError(error);
    }
  }

  async waitForToken() {
    if (!this.token || new Date().getTime() > this.expireTime) {
      await this.refreshToken();
    }
  }

  async sendMessage({ receiverType, receiverId, contentType, content }) {
    await this.waitForToken();
    const {
      data: { code, msg },
    } = await axios({
      url: `https://open.feishu.cn/open-apis/im/v1/messages?${qs.stringify({
        receive_id_type: receiverType,
      })}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      data: {
        receive_id: receiverId,
        content: JSON.stringify(content),
        msg_type: contentType,
      },
    });
    if (code !== 0) {
      throw new Error(msg);
    }
  }

  async onAlert(alert) {
    try {
      const card = generate(alert, {
        withActions: true,
      });
      for (const chatID of this.config.chats) {
        await this.sendMessage(
          {
            receiverType: "chat_id",
            receiverId: chatID,
            contentType: "interactive",
            content: card,
          },
          {
            withActions: true,
          }
        );
      }
    } catch (error) {
      console.error(`[lark/${this.name}] failed to send lark message`);
      this.onError(error);
      throw new Error("failed to send lark message");
    }
  }

  async getChats() {
    await this.waitForToken();
    const {
      data: {
        code,
        msg,
        data: { items },
      },
    } = await axios({
      url: `https://open.feishu.cn/open-apis/im/v1/chats?${qs.stringify({
        page_size: 100,
      })}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (code !== 0) {
      throw new Error(msg);
    }
    return items;
  }

  async onCallback(body) {
    if (body.challenge) {
      console.log(`[lark/${this.name}] challenge received`);
      return {
        challenge: body.challenge,
      };
    }
    try {
      const {
        open_id,
        action: {
          value: { alert: alertString },
          option,
        },
      } = body;
      const alert = JSON.parse(alertString);
      await this.waitForToken();
      const {
        data: {
          code,
          msg,
          data: {
            user: { name },
          },
        },
      } = await axios({
        url: `https://open.feishu.cn/open-apis/contact/v3/users/${open_id}?${qs.stringify(
          {
            user_id_type: "open_id",
          }
        )}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (code !== 0) {
        throw new Error(msg);
      }
      const start = dayjs().utc();
      const end = start.add(
        {
          time_30m: 30,
          time_1h: 1 * 60,
          time_4h: 4 * 60,
          time_24h: 24 * 60,
        }[option],
        "minute"
      );
      await axios({
        url: `${this.config.alertManagerEndpoint}/api/v2/silences`,
        method: "POST",
        data: {
          matchers: _.toPairs(alert.labels).map(([key, value]) => ({
            name: key,
            value,
            isRegex: false,
            isEqual: true,
          })),
          startsAt: start.format(),
          endsAt: end.format(),
          createdBy: name,
          comment: "Silenced via lark card",
        },
      });
      console.error(
        `[lark/${this.name}] silenced ${option.replace("time_", "")} for alert:`
      );
      _.toPairs(alert.labels).forEach(([key, value]) =>
        console.log(`  ${key}: ${value}`)
      );
      return {};
    } catch (error) {
      console.error(`[lark/${this.name}] failed to create silence`);
      this.onError(error);
      throw new Error("failed to create silence");
    }
  }
}

export default LarkClient;
