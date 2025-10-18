import { type XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  http: true,
  paths: {
    tools: "./src/tools",
    prompts: false, //"./src/prompts",
    resources: false, //"./src/resources",
  },
};

export default config;
