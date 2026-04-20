/**
 * 查询优化工具
 *
 * 提供数据库查询优化相关的工具函数
 */

/**
 * 优化查询链 - 自动添加 lean() 和选择字段
 *
 * @param {Query} query - Mongoose 查询对象
 * @param {Object} options - 选项
 * @param {string} options.select - 要选择的字段
 * @param {string|Object} options.populate - 要填充的字段
 * @param {boolean} options.lean - 是否使用 lean() (默认 true)
 * @returns {Query} 优化后的查询对象
 */
function optimizeQuery(query, options = {}) {
  const { select, populate, lean = true } = options;

  // 使用 lean() 提高性能（返回纯 JS 对象，不包含 Mongoose 文档方法）
  if (lean) {
    query.lean();
  }

  // 选择字段
  if (select) {
    query.select(select);
  }

  // 填充关联字段
  if (populate) {
    if (typeof populate === 'string') {
      query.populate(populate);
    } else if (Array.isArray(populate)) {
      populate.forEach(p => query.populate(p));
    } else {
      query.populate(populate);
    }
  }

  return query;
}

/**
 * 常用的 populate 配置
 */
const POPULATE_CONFIGS = {
  // 审核记录基础信息
  reviewBasic: {
    path: 'userId',
    select: 'username nickname role'
  },

  // 审核记录详细信息
  reviewDetail: {
    path: 'userId',
    select: 'username nickname role phone mentor_id hr_id'
  },

  // 设备关联用户
  deviceUser: {
    path: 'assignedUser',
    select: 'username nickname'
  },

  // 交易关联用户
  transactionUser: {
    path: 'userId',
    select: 'username nickname alipay_account'
  }
};

/**
 * 分页查询包装器
 *
 * @param {Model} model - Mongoose 模型
 * @param {Object} filter - 查询条件
 * @param {Object} options - 选项
 * @param {number} options.page - 页码 (默认 1)
 * @param {number} options.limit - 每页数量 (默认 20)
 * @param {Object} options.sort - 排序条件
 * @param {string} options.select - 要选择的字段
 * @param {string|Object|Array} options.populate - 要填充的字段
 * @param {boolean} options.lean - 是否使用 lean() (默认 true)
 * @returns {Promise<Object>} { items, pagination }
 */
async function paginatedQuery(model, filter, options = {}) {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    select,
    populate,
    lean = true
  } = options;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  // 并行执行查询和计数
  const [items, total] = await Promise.all([
    model.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select(select || '')
      .populate(populate || [])
      .lean(lean),
    model.countDocuments(filter)
  ]);

  return {
    items,
    pagination: {
      page: parseInt(page),
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 批量查询优化 - 避免 N+1 问题
 *
 * @param {Model} model - Mongoose 模型
 * @param {Array} ids - ID 数组
 * @param {Object} options - 选项
 * @returns {Promise<Map>} ID -> 文档的映射
 */
async function batchQuery(model, ids, options = {}) {
  const { select, populate, lean = true } = options;

  const docs = await model.find({ _id: { $in: ids } })
    .select(select || '')
    .populate(populate || [])
    .lean(lean);

  // 创建 ID -> 文档的映射
  const map = new Map();
  docs.forEach(doc => {
    map.set(doc._id.toString(), doc);
  });

  return map;
}

/**
 * 聚合分页查询
 *
 * @param {Model} model - Mongoose 模型
 * @param {Array} pipeline - 聚合管道
 * @param {Object} options - 选项
 * @returns {Promise<Object>} { items, pagination }
 */
async function paginatedAggregate(model, pipeline, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  // 添加分页阶段
  const facetPipeline = [
    ...pipeline,
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limitNum }],
        total: [{ $count: 'count' }]
      }
    }
  ];

  const [result] = await model.aggregate(facetPipeline);
  const items = result.items || [];
  const total = result.total?.[0]?.count || 0;

  return {
    items,
    pagination: {
      page: parseInt(page),
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 索引提示 - 强制使用指定索引
 *
 * @param {Query} query - Mongoose 查询对象
 * @param {string} indexName - 索引名称
 * @returns {Query} 查询对象
 */
function useIndex(query, indexName) {
  return query.hint({ [indexName]: 1 });
}

module.exports = {
  optimizeQuery,
  POPULATE_CONFIGS,
  paginatedQuery,
  batchQuery,
  paginatedAggregate,
  useIndex
};
