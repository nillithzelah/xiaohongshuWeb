import React, { useState } from 'react';
import { Table, Card, Button } from 'antd';
import { useBreakpoint } from 'antd/es/grid/hooks/useBreakpoint';

/**
 * 响应式表格组件
 * 移动端自动切换为卡片列表视图
 */
const ResponsiveTable = ({
  columns,
  dataSource,
  rowKey,
  loading,
  pagination,
  rowSelection,
  onChange,
  mobileCardRender,
  ...restProps
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // md 以下视为移动端

  // 移动端使用卡片列表渲染
  if (isMobile && mobileCardRender) {
    return (
      <div className="responsive-table-mobile">
        {dataSource.map((record, index) => (
          <Card
            key={record[rowKey] || index}
            className="mobile-table-card"
            bordered={false}
            style={{ marginBottom: 12 }}
          >
            {mobileCardRender(record, index)}
          </Card>
        ))}
        {/* 移动端分页 */}
        {pagination && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              disabled={pagination.current === 1}
              onClick={() => onChange && onChange({ ...pagination, current: pagination.current - 1 })}
            >
              上一页
            </Button>
            <span style={{ margin: '0 16px', color: '#666' }}>
              {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <Button
              disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => onChange && onChange({ ...pagination, current: pagination.current + 1 })}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    );
  }

  // PC端使用表格
  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey={rowKey}
      loading={loading}
      scroll={isMobile ? { x: 'max-content' } : undefined}
      pagination={isMobile ? {
        ...pagination,
        simple: true,
        showTotal: null
      } : pagination}
      rowSelection={rowSelection}
      onChange={onChange}
      size={isMobile ? 'small' : 'middle'}
      {...restProps}
    />
  );
};

export default ResponsiveTable;
