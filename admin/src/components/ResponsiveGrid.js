import React from 'react';
import { Row, Col } from 'antd';

/**
 * 响应式统计卡片容器
 * 自动适配移动端和PC端布局
 */
const ResponsiveCardContainer = ({ children, gutter }) => {
  return (
    <Row gutter={gutter || [8, 8]}>
      {React.Children.map(children, (child, index) => {
        // 计算响应式span
        const childCount = React.Children.count(children);
        let xs, sm, md, lg;

        if (childCount === 1) {
          xs = sm = md = lg = 24;
        } else if (childCount === 2) {
          xs = 24; sm = 12; md = 12; lg = 12;
        } else if (childCount === 3) {
          xs = 24; sm = 12; md = 8; lg = 8;
        } else if (childCount === 4) {
          xs = 12; sm = 12; md = 6; lg = 6;
        } else if (childCount <= 6) {
          xs = 12; sm = 12; md = 8; lg = 4;
        } else {
          xs = 12; sm = 8; md = 6; lg = 3;
        }

        return (
          <Col key={index} xs={xs} sm={sm} md={md} lg={lg}>
            {child}
          </Col>
        );
      })}
    </Row>
  );
};

/**
 * 响应式表单布局
 */
export const ResponsiveFormLayout = ({ children }) => {
  return (
    <div className="responsive-form">
      {children}
    </div>
  );
};

/**
 * 响应式操作按钮组
 */
export const ResponsiveActionGroup = ({ children }) => {
  return (
    <div className="responsive-action-group">
      {children}
    </div>
  );
};

export default ResponsiveCardContainer;
