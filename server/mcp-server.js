// server/mcp-server.js
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { z } = require("zod");

// 1. 加载环境变量并连接数据库
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/xiaohongshu_audit";

mongoose.connect(MONGODB_URI)
  .then(() => console.error("✅ [MCP] MongoDB Connected")) // 用 console.error 输出日志，以免干扰 stdio 通信
  .catch(err => console.error("❌ [MCP] DB Error:", err));

// 2. 创建 MCP 服务器实例
const server = new Server(
  { name: "xiaohongshu-db-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 3. 定义工具 (Tools) - 这就是 AI 能使用的"技能"
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_collections",
        description: "列出数据库中所有的集合名称",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "run_query",
        description: "在指定集合中执行 MongoDB 查询 (find)",
        inputSchema: {
          type: "object",
          properties: {
            collection: { type: "string", description: "集合名称 (如 users, imagereviews)" },
            filter: { type: "object", description: "MongoDB 查询条件 (JSON)" },
            limit: { type: "number", description: "限制返回条数" }
          },
          required: ["collection"]
        }
      },
      {
        name: "run_update",
        description: "更新数据 (updateMany)",
        inputSchema: {
          type: "object",
          properties: {
            collection: { type: "string" },
            filter: { type: "object" },
            update: { type: "object" }
          },
          required: ["collection", "filter", "update"]
        }
      }
    ]
  };
});

// 4. 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_collections") {
      const collections = await mongoose.connection.db.listCollections().toArray();
      return { content: [{ type: "text", text: JSON.stringify(collections.map(c => c.name)) }] };
    }

    if (name === "run_query") {
      const col = mongoose.connection.db.collection(args.collection);
      const data = await col.find(args.filter || {}).limit(args.limit || 5).toArray();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    if (name === "run_update") {
      const col = mongoose.connection.db.collection(args.collection);
      const result = await col.updateMany(args.filter, args.update);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error) {
    return { content: [{ type: "text", text: `错误: ${error.message}` }], isError: true };
  }
});

// 5. 启动服务器 (使用 Stdio 通信)
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);