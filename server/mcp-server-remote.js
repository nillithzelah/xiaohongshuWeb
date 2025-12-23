// server/mcp-server-remote.js - 连接远程服务器数据库的 MCP 服务器
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const mongoose = require("mongoose");
const { z } = require("zod");

// 1. 连接远程服务器数据库 (服务器 MongoDB 未启用认证)
const REMOTE_MONGODB_URI = "mongodb://112.74.163.102:27017/xiaohongshu_audit";

console.error("🔗 [MCP Remote] 正在连接远程数据库:", REMOTE_MONGODB_URI);

mongoose.connect(REMOTE_MONGODB_URI)
  .then(() => console.error("✅ [MCP Remote] 远程 MongoDB 连接成功"))
  .catch(err => console.error("❌ [MCP Remote] 远程数据库连接失败:", err.message));

// 2. 创建 MCP 服务器实例
const server = new Server(
  { name: "xiaohongshu-remote-db-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 3. 定义工具 (Tools)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_collections",
        description: "列出远程数据库中所有的集合名称",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "run_query",
        description: "在远程数据库的指定集合中执行 MongoDB 查询 (find)",
        inputSchema: {
          type: "object",
          properties: {
            collection: { type: "string", description: "集合名称 (如 users, devices, imagereviews)" },
            filter: { type: "object", description: "MongoDB 查询条件 (JSON)" },
            limit: { type: "number", description: "限制返回条数", default: 10 }
          },
          required: ["collection"]
        }
      },
      {
        name: "run_update",
        description: "在远程数据库中更新数据 (updateMany)",
        inputSchema: {
          type: "object",
          properties: {
            collection: { type: "string", description: "集合名称" },
            filter: { type: "object", description: "查询条件" },
            update: { type: "object", description: "更新操作" }
          },
          required: ["collection", "filter", "update"]
        }
      },
      {
        name: "run_insert",
        description: "在远程数据库中插入新数据",
        inputSchema: {
          type: "object",
          properties: {
            collection: { type: "string", description: "集合名称" },
            document: { type: "object", description: "要插入的文档" }
          },
          required: ["collection", "document"]
        }
      },
      {
        name: "run_delete",
        description: "在远程数据库中删除数据 (deleteMany)",
        inputSchema: {
          type: "object",
          properties: {
            collection: { type: "string", description: "集合名称" },
            filter: { type: "object", description: "删除条件" }
          },
          required: ["collection", "filter"]
        }
      },
      {
        name: "get_stats",
        description: "获取远程数据库统计信息",
        inputSchema: { type: "object", properties: {} }
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
      const collectionNames = collections.map(c => c.name);
      return {
        content: [{
          type: "text",
          text: `📋 远程数据库集合列表:\n${collectionNames.map(name => `  - ${name}`).join('\n')}`
        }]
      };
    }

    if (name === "run_query") {
      const col = mongoose.connection.db.collection(args.collection);
      const data = await col.find(args.filter || {}).limit(args.limit || 10).toArray();
      return {
        content: [{
          type: "text",
          text: `🔍 查询结果 (${data.length} 条):\n${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    if (name === "run_update") {
      const col = mongoose.connection.db.collection(args.collection);
      const result = await col.updateMany(args.filter, args.update);
      return {
        content: [{
          type: "text",
          text: `✅ 更新结果:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    }

    if (name === "run_insert") {
      const col = mongoose.connection.db.collection(args.collection);
      const result = await col.insertOne(args.document);
      return {
        content: [{
          type: "text",
          text: `✅ 插入结果:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    }

    if (name === "run_delete") {
      const col = mongoose.connection.db.collection(args.collection);
      const result = await col.deleteMany(args.filter);
      return {
        content: [{
          type: "text",
          text: `🗑️ 删除结果:\n${JSON.stringify(result, null, 2)}`
        }]
      };
    }

    if (name === "get_stats") {
      const stats = await mongoose.connection.db.stats();
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionStats = {};

      for (const collection of collections) {
        try {
          const count = await mongoose.connection.db.collection(collection.name).countDocuments();
          collectionStats[collection.name] = count;
        } catch (error) {
          collectionStats[collection.name] = `错误: ${error.message}`;
        }
      }

      return {
        content: [{
          type: "text",
          text: `📊 远程数据库统计:\n` +
                `数据库: ${stats.db}\n` +
                `数据大小: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB\n` +
                `存储大小: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB\n` +
                `集合数量: ${stats.collections}\n\n` +
                `各集合文档数:\n${Object.entries(collectionStats).map(([name, count]) => `  ${name}: ${count}`).join('\n')}`
        }]
      };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ 错误: ${error.message}` }],
      isError: true
    };
  }
});

// 5. 启动服务器
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
