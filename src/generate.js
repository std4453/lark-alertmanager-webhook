import _ from "lodash";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import updateLocale from "dayjs/plugin/updateLocale.js";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(utc);
dayjs.extend(updateLocale);
dayjs.extend(relativeTime);

const formatTime = (time) => {
  const day = dayjs(time).utcOffset(8);
  return day.format("YYYY-MM-DD HH:mm:ss CST");
};

export default (alert, { withActions = false } = {}) => {
  const {
    status,
    labels: { alertname, severity, prometheus, ...labels },
    annotations: { description, runbook_url },
    startsAt,
    endsAt,
    generatorURL,
    externalURL,
  } = alert;
  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template:
        status === "resolved"
          ? "green"
          : {
              critical: "red",
              warning: "yellow",
              info: "blue",
            }[severity] ?? "",
      title: {
        content: `${
          status === "resolved"
            ? "✅ 报警解除"
            : {
                critical: "🚨 集群报警",
                warning: "⚠️ 集群风险",
                info: "ℹ️ 集群提示",
              }[severity]
        }: ${alertname}`,
        tag: "plain_text",
      },
    },
    elements: [
      {
        fields: [
          {
            is_short: true,
            text: {
              content:
                status === "resolved"
                  ? `**🕐 结束时间：**\n${formatTime(endsAt)}`
                  : `**🕐 开始时间：**\n${formatTime(startsAt)}`,
              tag: "lark_md",
            },
          },
          {
            is_short: true,
            text: {
              content: `**🏷️ 事件类型：**\n${alertname}`,
              tag: "lark_md",
            },
          },
          {
            is_short: false,
            text: {
              content: "",
              tag: "lark_md",
            },
          },
          {
            is_short: false,
            text: {
              content: `**📝 事件描述：**\n${description}`,
              tag: "lark_md",
            },
          },
        ],
        tag: "div",
      },
      _.toPairs(labels).length > 0 && {
        tag: "hr",
      },
      _.toPairs(labels).length > 0 && {
        tag: "markdown",
        content: _.toPairs(labels)
          .map(([key, value]) => `**${key}:** ${value}`)
          .join("\n"),
      },
      {
        tag: "markdown",
        content: [
          `🚨 [alertmanager](${externalURL})`,
          generatorURL && `🔗 [prometheus](${generatorURL})`,
          runbook_url && `📒 [runbook](${runbook_url})`,
        ]
          .filter(Boolean)
          .join(" | "),
      },
      withActions &&
        status !== "resolved" && {
          actions: [
            {
              options: [
                {
                  text: {
                    content: "屏蔽30分钟",
                    tag: "plain_text",
                  },
                  value: "time_30m",
                },
                {
                  text: {
                    content: "屏蔽1小时",
                    tag: "plain_text",
                  },
                  value: "time_1h",
                },
                {
                  text: {
                    content: "屏蔽4小时",
                    tag: "plain_text",
                  },
                  value: "time_4h",
                },
                {
                  text: {
                    content: "屏蔽24小时",
                    tag: "plain_text",
                  },
                  value: "time_24h",
                },
              ],
              placeholder: {
                content: "暂时屏蔽报警",
                tag: "plain_text",
              },
              tag: "select_static",
              value: {
                alert: JSON.stringify(alert),
              },
            },
          ],
          tag: "action",
        },
    ].filter(Boolean),
  };
};
