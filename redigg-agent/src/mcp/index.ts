import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Skill } from "../skills";

export class MCPManager {
  private clients: Map<string, Client> = new Map();

  async connect(name: string, command: string, args: string[]) {
    const transport = new StdioClientTransport({
      command,
      args,
    });
    const client = new Client({
      name: "redigg-agent",
      version: "1.0.0",
    }, {
      capabilities: {},
    });

    await client.connect(transport);
    this.clients.set(name, client);
    return client;
  }

  async getSkillsFrom(name: string): Promise<Skill[]> {
    const client = this.clients.get(name);
    if (!client) return [];

    const tools = await client.listTools();
    return tools.tools.map(tool => ({
      name: tool.name,
      description: tool.description || "",
      execute: async (ctx, params) => {
        const result = await client.callTool({
          name: tool.name,
          arguments: params,
        });
        return result;
      }
    }));
  }
}
