import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { message } from 'antd';

/**
 * 审核列表公共Hook
 * 提取所有类型审核页面的共享逻辑
 */
const useReviewList = (imageType) => {
  // 状态管理
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 搜索和筛选状态
  const [filters, setFilters] = useState({
    status: undefined,
    userId: undefined,
    imageType: imageType || 'note',
    keyword: '',
    reviewer: undefined,
    deviceName: ''
  });

  // Modal状态
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [batchRejectModalVisible, setBatchRejectModalVisible] = useState(false);
  const [batchManagerRejectModalVisible, setBatchManagerRejectModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [currentReview, setCurrentReview] = useState(null);
  const [csUsers, setCsUsers] = useState([]);

  // 获取token
  const getToken = () => localStorage.getItem('token');

  // 获取审核列表
  const fetchReviews = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const token = getToken();
      const params = {
        page,
        limit: pageSize,
        status: filters.status,
        userId: filters.userId,
        imageType: filters.imageType,
        keyword: filters.keyword,
        reviewer: filters.reviewer,
        deviceName: filters.deviceName
      };

      // 移除undefined值
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });

      const response = await axios.get('reviews', {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setReviews(response.data.reviews || response.data.data?.reviews || []);
        setPagination({
          current: page,
          pageSize,
          total: response.data.pagination?.total || response.data.data?.pagination?.total || 0
        });
      } else {
        message.error('获取审核列表失败');
      }
    } catch (error) {
      console.error('获取审核列表失败:', error);
      message.error('获取审核列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 处理表格变化
  const handleTableChange = (pagination) => {
    fetchReviews(pagination.current, pagination.pageSize);
  };

  // 搜索
  const handleSearch = (searchValues) => {
    const newFilters = {
      ...filters,
      ...searchValues
    };
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 })); // 重置到第一页
  };

  // 重置搜索
  const handleResetSearch = () => {
    const resetFilters = {
      status: undefined,
      userId: undefined,
      imageType: imageType || 'note',
      keyword: '',
      reviewer: undefined,
      deviceName: ''
    };
    setFilters(resetFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 打开审核Modal
  const openReviewModal = (review) => {
    setCurrentReview(review);
    setReviewModalVisible(true);
  };

  // 打开拒绝Modal
  const openRejectModal = (review) => {
    setCurrentReview(review);
    setRejectModalVisible(true);
  };

  // 打开历史Modal
  const openHistoryModal = (review) => {
    setCurrentReview(review);
    setHistoryModalVisible(true);
  };

  // 关闭所有Modal
  const closeModals = () => {
    setReviewModalVisible(false);
    setRejectModalVisible(false);
    setHistoryModalVisible(false);
    setBatchRejectModalVisible(false);
    setBatchManagerRejectModalVisible(false);
    setCurrentReview(null);
  };

  // 批量选择
  const handleRowSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  // 批量通过
  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的记录');
      return;
    }

    try {
      const token = getToken();
      await axios.post('reviews/batch-approve',
        { reviewIds: selectedRowKeys },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(`批量通过成功 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      fetchReviews(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('批量通过失败:', error);
      message.error('批量通过失败');
    }
  };

  // 批量拒绝
  const openBatchRejectModal = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的记录');
      return;
    }
    setBatchRejectModalVisible(true);
  };

  // 批量经理拒绝
  const openBatchManagerRejectModal = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的记录');
      return;
    }
    setBatchManagerRejectModalVisible(true);
  };

  // 获取客服用户列表
  const fetchCsUsers = async () => {
    try {
      const token = getToken();
      const response = await axios.get('users', {
        params: { role: 'cs' },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCsUsers(response.data.data);
      }
    } catch (error) {
      console.error('获取客服用户失败:', error);
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchReviews();
    if (imageType === 'customer_resource') {
      fetchCsUsers();
    }
  }, [fetchReviews, imageType]);

  // 当imageType改变时重新获取数据
  useEffect(() => {
    if (imageType) {
      setFilters(prev => ({ ...prev, imageType }));
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [imageType]);

  return {
    // 数据
    reviews,
    loading,
    pagination,
    filters,
    selectedRowKeys,
    currentReview,
    csUsers,

    // Modal状态
    reviewModalVisible,
    rejectModalVisible,
    historyModalVisible,
    batchRejectModalVisible,
    batchManagerRejectModalVisible,

    // 方法
    fetchReviews,
    handleTableChange,
    handleSearch,
    handleResetSearch,
    openReviewModal,
    openRejectModal,
    openHistoryModal,
    closeModals,
    handleRowSelectChange,
    handleBatchApprove,
    openBatchRejectModal,
    openBatchManagerRejectModal,
    setSelectedRowKeys
  };
};

export default useReviewList;
