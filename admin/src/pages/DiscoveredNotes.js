import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  Select,
  Input,
  InputNumber,
  message,
  Statistic,
  Row,
  Col,
  Tooltip,
  Modal,
  Alert,
  Dropdown,
  Popconfirm
} from 'antd';
import {
  ReloadOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  EditOutlined,
  SaveOutlined,
  UploadOutlined,
  DownloadOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
  MoreOutlined,
  DownOutlined,
  MenuOutlined,
  EyeOutlined,
  RobotOutlined,
  ImportOutlined,
  PlusOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const DiscoveredNotes = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    recent: 0,
    onlineHarvestDevices: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 采集优先级配置（从数据库获取）
  const [priorityConfig, setPriorityConfig] = useState({
    intervals: { 10: 10, 5: 60, 2: 360, 1: 1440 },  // 分钟数
    labels: { 10: '10分钟', 5: '1小时', 2: '6小时', 1: '24小时' }
  });

  // 短链接编辑状态
  const [shortUrlModal, setShortUrlModal] = useState({
    visible: false,
    noteId: null,
    noteUrl: '',
    shortUrl: '',
    pasteText: ''  // 用于粘贴的文本
  });

  // 批量导入短链接状态
  const [batchImportModal, setBatchImportModal] = useState({
    visible: false,
    importText: '',
    extractedData: [],
    importing: false
  });

  // 手动导入笔记状态
  const [manualImportModal, setManualImportModal] = useState({
    visible: false,
    importing: false,
    noteId: '',
    noteUrl: '',
    title: '',
    author: '',
    keyword: ''
  });

  // 删除确认状态
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    noteId: null,
    noteTitle: ''
  });

  // 修改删除状态模态框
  const [noteStatusModal, setNoteStatusModal] = useState({
    visible: false,
    noteId: null,
    noteTitle: '',
    currentStatus: ''
  });

  // AI 分析理由模态框
  const [aiAnalysisModal, setAiAnalysisModal] = useState({
    visible: false,
    noteTitle: '',
    noteKeyword: '',
    aiAnalysis: null,                // 采集时分析
    deletionCheckAnalysis: null,      // 删除检测分析
    deletionRecheckAnalysis: null     // 删除复审分析
  });

  // 批量选择状态
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);

  // 优先级配置编辑状态
  const [priorityConfigModal, setPriorityConfigModal] = useState({
    visible: false,
    loading: false,
    intervals: { 10: 10, 5: 60, 2: 360, 1: 1440 }
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    status: '',  // 默认空字符串，显示全部
    keyword: '',
    dateRange: null,
    harvestPriority: '',  // 采集优先级筛选
    hasShortUrl: '',  // 短链接筛选: ''=全部, 'yes'=有短链接, 'no'=无短链接
    noteStatus: '',  // 删除状态筛选: ''=全部, 'active'=正常, 'deleted'=已删除
    canHarvest: ''  // 队列剩余时间筛选: ''=全部, 'yes'=可采集, 'no'=排队中
  });

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await axios.get('/client/discovery/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 获取笔记列表
  const fetchNotes = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = {
        skip: (page - 1) * pageSize,
        limit: pageSize
      };

      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.keyword) {
        params.keyword = filters.keyword;
      }
      if (filters.harvestPriority) {
        params.harvestPriority = filters.harvestPriority;
      }
      if (filters.hasShortUrl) {
        params.hasShortUrl = filters.hasShortUrl;
      }
      if (filters.noteStatus) {
        params.noteStatus = filters.noteStatus;
      }
      if (filters.canHarvest) {
        params.canHarvest = filters.canHarvest;
      }

      const response = await axios.get('/client/discovery/list', { params });
      if (response.data.success) {
        setNotes(response.data.data.notes);
        setPagination({
          current: page,
          pageSize,
          total: response.data.data.pagination.total
        });
      }
    } catch (error) {
      console.error('获取笔记列表失败:', error);
      message.error('获取笔记列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchNotes(1, pagination.pageSize);
  }, [filters]);

  // 获取采集优先级配置
  useEffect(() => {
    const fetchPriorityConfig = async () => {
      try {
        const response = await axios.get('/client/system/config?key=harvest_priority_intervals');
        if (response.data.success && response.data.data.value) {
          const intervals = response.data.data.value;
          // 从分钟数生成标签
          const labels = {};
          for (const [priority, minutes] of Object.entries(intervals)) {
            if (minutes < 60) {
              labels[priority] = `${minutes}分钟`;
            } else if (minutes < 1440) {
              labels[priority] = `${minutes / 60}小时`;
            } else {
              labels[priority] = `${minutes / 1440}天`;
            }
          }
          setPriorityConfig({ intervals, labels });
        }
      } catch (error) {
        console.error('获取优先级配置失败，使用默认值:', error);
      }
    };
    fetchPriorityConfig();
  }, []);

  // 获取笔记的采集优先级（直接使用数据库中的 harvestPriority 值）
  const getHarvestPriority = (record) => {
    // 直接返回数据库中的 harvestPriority，如果为空或0则返回 1
    if (record.harvestPriority !== undefined && record.harvestPriority !== null && record.harvestPriority !== 0) {
      return record.harvestPriority;
    }
    return 1; // 默认最低优先级
  };

  // 复制到剪贴板
  const handleCopyUrl = async (url, type = '链接') => {
    try {
      await navigator.clipboard.writeText(url);
      message.success(`${type}已复制到剪贴板`);
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success(`${type}已复制到剪贴板`);
    }
  };

  // 打开优先级配置编辑
  const handleOpenPriorityConfig = () => {
    setPriorityConfigModal({
      visible: true,
      loading: false,
      intervals: { ...priorityConfig.intervals }
    });
  };

  // 保存优先级配置
  const handleSavePriorityConfig = async () => {
    setPriorityConfigModal({ ...priorityConfigModal, loading: true });

    try {
      const response = await axios.put('/client/system/config', {
        key: 'harvest_priority_intervals',
        value: priorityConfigModal.intervals,
        description: '采集优先级间隔配置（单位：分钟）',
        category: 'harvest'
      });

      if (response.data.success) {
        message.success('优先级配置已保存');
        setPriorityConfigModal({ visible: false, loading: false, intervals: priorityConfigModal.intervals });

        // 刷新配置
        const intervals = priorityConfigModal.intervals;
        const labels = {};
        for (const [priority, minutes] of Object.entries(intervals)) {
          if (minutes < 60) {
            labels[priority] = `${minutes}分钟`;
          } else if (minutes < 1440) {
            labels[priority] = `${minutes / 60}小时`;
          } else {
            labels[priority] = `${minutes / 1440}天`;
          }
        }
        setPriorityConfig({ intervals, labels });
      } else {
        message.error('保存失败: ' + (response.data.message || '未知错误'));
        setPriorityConfigModal({ ...priorityConfigModal, loading: false });
      }
    } catch (error) {
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
      setPriorityConfigModal({ ...priorityConfigModal, loading: false });
    }
  };

  // 从文本中提取小红书短链接（与小程序逻辑一致）
  const extractShortUrl = (text) => {
    if (!text) return null;

    // 匹配链接的正则表达式 - 与小程序完全一致
    // 支持 xhslink.com 和 xiaohongshu.com
    const xiaohongshuUrlRegex = /(https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:xiaohongshu|xhslink)\.com\/(?:[a-zA-Z0-9]+\/)?[a-zA-Z0-9]+)/i;

    const match = text.match(xiaohongshuUrlRegex);
    if (match) {
      return match[0];  // match[0] 是完整匹配，match[1] 才是捕获组
    }

    // 如果没找到，尝试查找其他可能的链接格式
    const generalUrlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(generalUrlRegex);
    if (urls) {
      // 查找包含 xhslink 或 xiaohongshu 的链接
      for (const url of urls) {
        if (url.includes('xhslink') || url.includes('xiaohongshu')) {
          return url;
        }
      }
    }

    return null;
  };

  // 处理提取短链接
  const handleExtractShortUrl = () => {
    const extracted = extractShortUrl(shortUrlModal.pasteText);
    if (extracted) {
      setShortUrlModal({ ...shortUrlModal, shortUrl: extracted });
      message.success('短链接提取成功！');
    } else {
      message.warning('未在文本中找到小红书短链接，请检查粘贴内容');
    }
  };

  // 打开编辑短链接模态框
  const handleEditShortUrl = (record) => {
    setShortUrlModal({
      visible: true,
      noteId: record._id,
      noteUrl: record.noteUrl,
      shortUrl: record.shortUrl || ''
    });
  };

  // 保存短链接
  const handleSaveShortUrl = async () => {
    try {
      const response = await axios.put(`/client/discovery/${shortUrlModal.noteId}/short-url`, {
        shortUrl: shortUrlModal.shortUrl
      });
      if (response.data.success) {
        message.success('短链接保存成功');
        setShortUrlModal({ ...shortUrlModal, visible: false });
        fetchNotes(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      console.error('保存短链接失败:', error);
      message.error(error.response?.data?.message || '保存失败');
    }
  };

  // 解析批量导入文本
  const parseImportText = (text) => {
    if (!text) return [];

    const lines = text.split('\n').filter(line => line.trim());
    const data = [];

    lines.forEach(line => {
      const trimmed = line.trim();

      // 匹配格式：noteId shortUrl（空格或制表符分隔）
      const parts = trimmed.split(/\s+/);

      if (parts.length === 2) {
        // 格式1：笔记ID + 短链接
        const [noteId, shortUrl] = parts;
        if (shortUrl.includes('xhslink.com')) {
          data.push({ noteId, shortUrl, isValid: true });
        } else {
          data.push({ noteId, shortUrl, isValid: false, error: '格式错误' });
        }
      } else if (parts.length === 1 && parts[0].includes('xhslink.com')) {
        // 格式2：仅短链接（需要后续通过URL解析noteId，暂时标记为noteId为空）
        data.push({ noteId: null, shortUrl: parts[0], isValid: true });
      }
    });

    return data;
  };

  // 执行批量导入
  const handleBatchImport = async () => {
    const { extractedData } = batchImportModal;

    if (extractedData.length === 0) {
      message.warning('没有有效的数据可导入');
      return;
    }

    // 过滤出有效的数据
    const validData = extractedData.filter(d => d.isValid);

    if (validData.length === 0) {
      message.error('没有有效的短链接数据');
      return;
    }

    setBatchImportModal({ ...batchImportModal, importing: true });

    try {
      const response = await axios.post('/client/discovery/batch-update-short-urls', {
        updates: validData
      });

      if (response.data.success) {
        const { successCount, failedCount, results } = response.data.data;

        if (failedCount === 0) {
          message.success(`成功导入 ${successCount} 条短链接`);
        } else {
          message.warning(`导入完成：成功 ${successCount} 条，失败 ${failedCount} 条`);
          // 打印失败详情到控制台
          const failed = results.filter(r => !r.success);
          console.error('导入失败项：', failed);
        }

        // 关闭模态框并刷新
        setBatchImportModal({
          visible: false,
          importText: '',
          extractedData: [],
          importing: false
        });
        fetchNotes(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('导入失败：' + (error.response?.data?.message || error.message));
      setBatchImportModal({ ...batchImportModal, importing: false });
    }
  };

  // 监听批量导入文本变化，自动解析
  useEffect(() => {
    if (batchImportModal.importText && batchImportModal.visible) {
      const data = parseImportText(batchImportModal.importText);
      setBatchImportModal(prev => ({ ...prev, extractedData: data }));
    } else if (!batchImportModal.importText) {
      setBatchImportModal(prev => ({ ...prev, extractedData: [] }));
    }
  }, [batchImportModal.importText]);

  // 手动导入笔记
  const handleManualImport = async () => {
    const { noteId, noteUrl, title, author, keyword } = manualImportModal;

    if (!noteId.trim()) {
      message.warning('请输入笔记ID');
      return;
    }

    setManualImportModal({ ...manualImportModal, importing: true });

    try {
      const response = await axios.post('/admin/discovered-notes/import', {
        noteId: noteId.trim(),
        noteUrl: noteUrl.trim() || undefined,
        title: title.trim() || undefined,
        author: author.trim() || undefined,
        keyword: keyword.trim() || undefined
      });

      if (response.data.success) {
        message.success('笔记导入成功');
        setManualImportModal({
          visible: false,
          importing: false,
          noteId: '',
          noteUrl: '',
          title: '',
          author: '',
          keyword: ''
        });
        fetchNotes(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('手动导入笔记失败:', error);
      const errorMsg = error.response?.data?.message || '导入失败';
      if (error.response?.status === 409) {
        message.warning('笔记已存在，无需重复导入');
      } else {
        message.error(errorMsg);
      }
      setManualImportModal({ ...manualImportModal, importing: false });
    }
  };

  // 从URL解析笔记ID
  const parseNoteIdFromUrl = (url) => {
    if (!url) return '';
    // 匹配小红书URL中的笔记ID（24位十六进制字符串）
    const match = url.match(/\/([a-f0-9]{24,})/);
    return match ? match[1] : '';
  };

  // 处理URL输入变化，自动提取笔记ID
  const handleNoteUrlChange = (e) => {
    const url = e.target.value;
    setManualImportModal({ ...manualImportModal, noteUrl: url });

    // 如果noteId为空，尝试从URL提取
    if (!manualImportModal.noteId && url) {
      const extractedId = parseNoteIdFromUrl(url);
      if (extractedId) {
        setManualImportModal(prev => ({ ...prev, noteId: extractedId }));
      }
    }
  };

  // 导出无短链接笔记（给合作方）
  const exportNotesWithoutShortUrl = () => {
    // 筛选无短链接的笔记
    const notesWithoutShortUrl = notes.filter(note => !note.shortUrl || note.shortUrl.trim() === '');

    if (notesWithoutShortUrl.length === 0) {
      message.warning('当前列表中没有无短链接的笔记');
      return;
    }

    // 构建导出内容：noteId \t noteUrl
    const lines = notesWithoutShortUrl.map(note => {
      const noteId = note.noteId || '';
      // 构建完整长链接
      let longUrl = note.noteUrl;
      if (!longUrl) {
        longUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
      }
      if (longUrl && !longUrl.startsWith('http')) {
        longUrl = `https://www.xiaohongshu.com${longUrl}`;
      }
      return `${noteId}\t${longUrl}`;
    });

    const content = lines.join('\n');

    // 创建下载
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `无短链接笔记_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(`已导出 ${notesWithoutShortUrl.length} 条笔记`);
  };

  // 打开删除确认弹窗
  const handleDeleteClick = (record) => {
    setDeleteModal({
      visible: true,
      noteId: record._id,
      noteTitle: record.title || record.noteId || '未知'
    });
  };

  // 执行删除
  const handleDeleteConfirm = async () => {
    try {
      const response = await axios.delete(`/client/discovery/${deleteModal.noteId}`);

      if (response.data.success) {
        message.success('笔记已删除');
        setDeleteModal({ visible: false, noteId: null, noteTitle: '' });

        // 刷新列表
        fetchNotes(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('删除笔记失败:', error);
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 打开修改删除状态模态框
  const handleChangeNoteStatus = (record) => {
    setNoteStatusModal({
      visible: true,
      noteId: record._id,
      noteTitle: record.title || record.noteId || '未知',
      currentStatus: record.noteStatus || 'active'
    });
  };

  // 打开AI分析理由模态框
  const handleViewAiAnalysis = (record) => {
    setAiAnalysisModal({
      visible: true,
      noteTitle: record.title || record.noteId || '未知',
      noteKeyword: record.keyword || '',
      aiAnalysis: record.aiAnalysis || null,                // 采集时分析
      deletionCheckAnalysis: record.deletionCheckAnalysis || null,      // 删除检测分析
      deletionRecheckAnalysis: record.deletionRecheckAnalysis || null     // 删除复审分析
    });
  };

  // 保存删除状态
  const handleSaveNoteStatus = async (newStatus) => {
    try {
      const response = await axios.put(`/client/discovery/${noteStatusModal.noteId}/note-status`, {
        noteStatus: newStatus
      });

      if (response.data.success) {
        const statusTextMap = {
          'active': '正常',
          'deleted': '已删除',
          'ai_rejected': '文意不符'
        };
        const statusText = statusTextMap[newStatus] || newStatus;
        message.success(`删除状态已更新为：${statusText}`);
        setNoteStatusModal({ visible: false, noteId: null, noteTitle: '', currentStatus: '' });

        // 刷新列表
        fetchNotes(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('更新删除状态失败:', error);
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  // 批量操作处理函数
  const handleBatchAction = async (action) => {
    // 过滤掉 Table.SELECTION_ALL 添加的 "batch" 值
    const validKeys = selectedRowKeys.filter(key => key !== 'batch' && key !== 'undefined' && key !== 'null');

    if (validKeys.length === 0) {
      message.warning('请先选择要操作的笔记');
      return;
    }

    if (action === 'delete') {
      setDeleteModal({
        visible: true,
        noteId: null,
        noteTitle: `${validKeys.length} 条笔记`
      });
      return;
    }

    if (action === 'markActive' || action === 'markDeleted' || action === 'markRejected') {
      try {
        const statusMap = {
          markActive: 'active',
          markDeleted: 'deleted',
          markRejected: 'ai_rejected'
        };
        const statusTextMap = {
          markActive: '正常',
          markDeleted: '已删除',
          markRejected: '文意不符'
        };

        await axios.put('/client/discovery/batch-status', {
          noteIds: validKeys,
          noteStatus: statusMap[action]
        });

        message.success(`已将 ${selectedRowKeys.length} 条笔记标记为${statusTextMap[action]}`);

        // 清空选择
        setSelectedRowKeys([]);
        setSelectedRows([]);

        // 刷新
        fetchNotes(pagination.current, pagination.pageSize);
        fetchStats();
      } catch (error) {
        console.error('批量操作失败:', error);
        message.error(error.response?.data?.message || '批量操作失败');
      }
    }
  };

  // 批量删除确认
  const handleBatchDeleteConfirm = async () => {
    // 过滤掉 Table.SELECTION_ALL 添加的 "batch" 值
    const validKeys = selectedRowKeys.filter(key => key !== 'batch' && key !== 'undefined' && key !== 'null');

    if (validKeys.length === 0) {
      message.warning('没有有效的笔记ID');
      return;
    }

    try {
      const response = await axios.delete('/client/discovery/batch', {
        data: { noteIds: validKeys }
      });

      if (response.data.success) {
        message.success(`已删除 ${validKeys.length} 条笔记`);
        setDeleteModal({ visible: false, noteId: null, noteTitle: '' });

        // 清空选择
        setSelectedRowKeys([]);
        setSelectedRows([]);

        // 刷新
        fetchNotes(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error(error.response?.data?.message || '批量删除失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 80,
      render: (id) => <span style={{ fontSize: '12px', color: '#999' }}>{id?.slice(-6) || '--'}</span>
    },
    {
      title: '笔记标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (title, record) => {
        // 如果有标题直接显示
        if (title && title !== '未命名笔记') {
          return title;
        }
        // 否则使用 scam_category + " 未命名笔记"
        const category = record.aiAnalysis?.scam_category || record.deletionCheckAnalysis?.scam_category;
        if (category) {
          return `${category} 未命名笔记`;
        }
        return '未命名笔记';
      }
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 150,
      ellipsis: true,
      render: (author) => author || '未提取'
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 200,
      ellipsis: true,
      render: (keyword) => <Tag color="blue">{keyword || 'N/A'}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          discovered: { text: '待处理', color: 'orange' },
          verified: { text: '已验证', color: 'blue' },
          rejected: { text: '已拒绝', color: 'red' }
        };
        const config = statusMap[status] || { text: status || '未知', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '删除状态',
      dataIndex: 'noteStatus',
      key: 'noteStatus',
      width: 120,
      render: (noteStatus, record) => {
        if (noteStatus === 'deleted') {
          return (
            <Tooltip title={`删除时间: ${record.deletedAt ? new Date(record.deletedAt).toLocaleString('zh-CN') : '未知'}`}>
              <Tag color="red" icon="🗑️">已删除</Tag>
            </Tooltip>
          );
        }
        if (noteStatus === 'ai_rejected') {
          return (
            <Tooltip title={`文意不符合（AI拒绝）${record.deletedAt ? `\n时间: ${new Date(record.deletedAt).toLocaleString('zh-CN')}` : ''}`}>
              <Tag color="volcano">❌ 文意不符</Tag>
            </Tooltip>
          );
        }
        return <Tag color="green">正常</Tag>;
      }
    },
    {
      title: '采集优先级',
      key: 'harvestPriority',
      width: 140,
      render: (_, record) => {
        const priority = getHarvestPriority(record);

        // 优先级颜色映射
        const colorMap = { 10: 'red', 5: 'orange', 2: 'gold', 1: 'green' };
        const emojiMap = { 10: '🔴', 5: '🟠', 2: '🟡', 1: '🟢' };

        const color = colorMap[priority] || 'green';
        const emoji = emojiMap[priority] || '🟢';
        const label = `${emoji} ${priority}分`;
        const interval = priorityConfig.labels[priority] || '未知';

        return (
          <Tooltip title={`采集间隔: ${interval}`}>
            <Tag color={color}>{label}</Tag>
            <span style={{ fontSize: '11px', color: '#999', marginLeft: 4 }}>
              {interval}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: '发现时间',
      dataIndex: 'discoverTime',
      key: 'discoverTime',
      width: 150,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '--'
    },
    {
      title: '队列状态',
      key: 'queueStatus',
      width: 160,
      render: (_, record) => {
        const now = new Date();

        // 1. 先检查是否有活跃的 harvestLock（正在分发中）
        if (record.harvestLock && record.harvestLock.lockedUntil) {
          const lockedUntil = new Date(record.harvestLock.lockedUntil);
          if (lockedUntil > now) {
            const timeLeft = lockedUntil - now;
            const minutesLeft = Math.floor(timeLeft / (60 * 1000));
            if (minutesLeft >= 60) {
              const hoursLeft = Math.floor(minutesLeft / 60);
              return <Tag color="orange" icon={<ClockCircleOutlined />}>分发中 {hoursLeft}h{minutesLeft % 60}m</Tag>;
            } else {
              return <Tag color="red" icon={<ClockCircleOutlined />}>分发中 {minutesLeft}m</Tag>;
            }
          }
        }

        // 2. 计算采集间隔（根据优先级，从数据库配置获取）
        const priority = getHarvestPriority(record);
        const intervalMinutes = priorityConfig.intervals[priority] || 1440;

        // 3. 从未采集过，可以立即采集
        if (!record.commentsHarvestedAt) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>可加入队列</Tag>;
        }

        // 4. 计算下次可采集时间
        const lastHarvest = new Date(record.commentsHarvestedAt);
        const nextHarvestTime = new Date(lastHarvest.getTime() + intervalMinutes * 60 * 1000);

        if (nextHarvestTime <= now) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>可加入队列</Tag>;
        }

        // 5. 等待下次采集时间
        const waitTime = nextHarvestTime - now;
        const waitMinutes = Math.floor(waitTime / (60 * 1000));

        if (waitMinutes >= 60) {
          const waitHours = Math.floor(waitMinutes / 60);
          return <Tag color="blue" icon={<ClockCircleOutlined />}>等待 {waitHours}h{waitMinutes % 60}m</Tag>;
        } else {
          return <Tag color="blue" icon={<ClockCircleOutlined />}>等待 {waitMinutes}m</Tag>;
        }
      }
    },
    {
      title: '黑名单扫描',
      key: 'blacklistSearched',
      width: 120,
      render: (_, record) => {
        if (record.blacklistSearched) {
          return (
            <Tooltip title={`扫描时间: ${record.blacklistSearchedAt ? new Date(record.blacklistSearchedAt).toLocaleString('zh-CN') : '--'}`}>
              <Tag color="green">已扫描</Tag>
            </Tooltip>
          );
        }
        return <Tag color="default">未扫描</Tag>;
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        // 优先使用短链接，没有则使用长链接
        let displayUrl = record.shortUrl || record.noteUrl;
        if (!displayUrl) {
          const noteId = record.noteId || '';
          displayUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
        }
        if (displayUrl && !displayUrl.startsWith('http')) {
          displayUrl = `https://www.xiaohongshu.com${displayUrl}`;
        }

        // 构建长链接（用于复制长链接按钮）
        let longUrl = record.noteUrl;
        if (!longUrl) {
          const noteId = record.noteId || '';
          longUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
        }
        if (longUrl && !longUrl.startsWith('http')) {
          longUrl = `https://www.xiaohongshu.com${longUrl}`;
        }

        // 下拉菜单项
        const menuItems = [
          {
            key: 'open',
            icon: <LinkOutlined />,
            label: record.shortUrl ? '打开(短链)' : '打开(长链)',
            onClick: () => window.open(displayUrl, '_blank')
          },
          {
            key: 'copy',
            icon: <CopyOutlined />,
            label: '复制链接',
            onClick: () => handleCopyUrl(longUrl, '链接')
          },
          {
            key: 'copyShort',
            icon: <CopyOutlined />,
            label: '复制短链接',
            onClick: () => handleCopyUrl(record.shortUrl, '短链接'),
            disabled: !record.shortUrl
          },
          { type: 'divider' },
          {
            key: 'viewAiAnalysis',
            icon: <EyeOutlined />,
            label: '查看AI理由',
            onClick: () => handleViewAiAnalysis(record),
            disabled: !(record.deletionCheckAnalysis || record.aiAnalysis || record.deletionRecheckAnalysis)
          },
          { type: 'divider' },
          {
            key: 'editShort',
            icon: <EditOutlined />,
            label: record.shortUrl ? '编辑短链接' : '添加短链接',
            onClick: () => handleEditShortUrl(record)
          },
          {
            key: 'toggleStatus',
            icon: record.noteStatus === 'deleted' ? <CheckCircleOutlined /> : <StopOutlined />,
            label: record.noteStatus === 'deleted' ? '恢复正常' : '标记删除',
            onClick: () => handleChangeNoteStatus(record)
          },
          {
            key: 'divider',
            type: 'divider'
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => handleDeleteClick(record)
          }
        ];

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic title="总发现" value={stats.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="已验证" value={stats.verified} suffix="条" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="最近7天" value={stats.recent} suffix="条" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待采集队列"
              value={stats.pending}
              suffix="条"
              valueStyle={{ color: stats.pending > 0 ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="采集设备在线"
              value={stats.onlineHarvestDevices}
              suffix="台"
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: stats.onlineHarvestDevices > 0 ? '#52c41a' : '#999' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* 筛选栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: 120 }}
            >
              <Option value="">全部状态</Option>
              <Option value="discovered">待处理</Option>
              <Option value="verified">已验证</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>

            <Select
              value={filters.harvestPriority}
              onChange={(value) => setFilters({ ...filters, harvestPriority: value })}
              style={{ width: 140 }}
            >
              <Option value="">全部优先级</Option>
              <Option value="10">🔴 高优先 (10分)</Option>
              <Option value="5">🟠 中优先 (5分)</Option>
              <Option value="2">🟡 低优先 (2分)</Option>
              <Option value="1">🟢 最低 (1分)</Option>
            </Select>

            <Select
              value={filters.hasShortUrl}
              onChange={(value) => setFilters({ ...filters, hasShortUrl: value })}
              style={{ width: 120 }}
            >
              <Option value="">全部短链接</Option>
              <Option value="no">🔴 无短链接</Option>
              <Option value="yes">🟢 有短链接</Option>
            </Select>

            <Select
              value={filters.noteStatus}
              onChange={(value) => setFilters({ ...filters, noteStatus: value })}
              style={{ width: 140 }}
            >
              <Option value="">全部删除状态</Option>
              <Option value="active">🟢 正常</Option>
              <Option value="deleted">🗑️ 已删除</Option>
              <Option value="ai_rejected">❌ 文意不符</Option>
            </Select>

            <Select
              value={filters.canHarvest}
              onChange={(value) => setFilters({ ...filters, canHarvest: value })}
              style={{ width: 120 }}
            >
              <Option value="">全部队列</Option>
              <Option value="yes">🟢 可采集</Option>
              <Option value="no">⏳ 排队中</Option>
            </Select>

            <Input
              placeholder="搜索标题、作者、长链接、短链接"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              style={{ width: 240 }}
              allowClear
              onPressEnter={() => fetchNotes(pagination.current, pagination.pageSize)}
            />

            <Button icon={<ReloadOutlined />} onClick={() => fetchNotes(pagination.current, pagination.pageSize)}>
              刷新
            </Button>

            <Button
              icon={<DownloadOutlined />}
              onClick={exportNotesWithoutShortUrl}
            >
              导出无短链接笔记
            </Button>

            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setBatchImportModal({ ...batchImportModal, visible: true })}
            >
              批量导入短链接
            </Button>

            <Button
              icon={<PlusOutlined />}
              onClick={() => setManualImportModal({ ...manualImportModal, visible: true })}
            >
              手动导入笔记
            </Button>

            <Button
              icon={<RobotOutlined />}
              onClick={handleOpenPriorityConfig}
            >
              优先级配置
            </Button>
          </Space>

          {/* 批量操作栏 */}
          {selectedRowKeys.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <Space wrap>
                <span style={{ fontWeight: 'bold' }}>已选择 {selectedRowKeys.length} 条：</span>
                <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleBatchAction('markActive')}>
                  标记正常
                </Button>
                <Button size="small" icon={<StopOutlined />} onClick={() => handleBatchAction('markDeleted')} danger>
                  标记删除
                </Button>
                <Button size="small" onClick={() => handleBatchAction('markRejected')}>
                  标记文意不符
                </Button>
                <Popconfirm
                  title="确定要删除选中的笔记吗？"
                  description="此操作不可恢复"
                  onConfirm={() => handleBatchDeleteConfirm()}
                  okText="确认"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    批量删除
                  </Button>
                </Popconfirm>
                <Button size="small" onClick={() => { setSelectedRowKeys([]); setSelectedRows([]); }}>
                  取消选择
                </Button>
              </Space>
            </div>
          )}
        </div>

        <Table
          rowKey="_id"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys, rows) => {
              setSelectedRowKeys(keys);
              setSelectedRows(rows);
            },
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE
            ]
          }}
          columns={columns}
          dataSource={notes}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={(newPagination) => fetchNotes(newPagination.current, newPagination.pageSize)}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 编辑短链接模态框 */}
      <Modal
        title="编辑短链接"
        open={shortUrlModal.visible}
        onCancel={() => setShortUrlModal({ ...shortUrlModal, visible: false, pasteText: '' })}
        onOk={handleSaveShortUrl}
        okText="保存"
        cancelText="取消"
        width={550}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 长链接显示 */}
          <div>
            <div style={{ marginBottom: 8, color: '#999' }}>长链接：</div>
            <Input.TextArea
              value={shortUrlModal.noteUrl}
              readOnly
              rows={2}
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>

          {/* 从文本提取短链接 */}
          <div>
            <div style={{ marginBottom: 8, color: '#999', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                粘贴分享文本：
                <span style={{ marginLeft: 8, fontSize: '12px', color: '#1890ff' }}>
                  自动提取短链接
                </span>
              </span>
            </div>
            <Input.TextArea
              value={shortUrlModal.pasteText}
              onChange={(e) => setShortUrlModal({ ...shortUrlModal, pasteText: e.target.value })}
              placeholder='粘贴示例：姐妹们避雷网上的减肥产品 这几天发现还是很多姐妹都... http://xhslink.com/o/Al86aESFGd9 复制后打开【小红书】查看笔记！'
              rows={3}
              style={{ marginBottom: 8 }}
            />
            <Button
              type="primary"
              ghost
              icon={<CopyOutlined />}
              onClick={handleExtractShortUrl}
              block
            >
              提取短链接
            </Button>
          </div>

          {/* 短链接输入/显示 */}
          <div>
            <div style={{ marginBottom: 8, color: '#999' }}>短链接：</div>
            <Input
              value={shortUrlModal.shortUrl}
              onChange={(e) => setShortUrlModal({ ...shortUrlModal, shortUrl: e.target.value })}
              placeholder="或手动输入，如：https://xhslink.com/xxx"
              prefix="🔗"
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
              提取后会自动填入上方，也可手动修改
            </div>
          </div>
        </Space>
      </Modal>

      {/* 批量导入短链接模态框 */}
      <Modal
        title="批量导入短链接"
        open={batchImportModal.visible}
        onCancel={() => setBatchImportModal({
          visible: false,
          importText: '',
          extractedData: [],
          importing: false
        })}
        onOk={handleBatchImport}
        okText="确认导入"
        cancelText="取消"
        width={700}
        okButtonProps={{ loading: batchImportModal.importing }}
        cancelButtonProps={{ disabled: batchImportModal.importing }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 说明文字 */}
          <Alert
            message="输入格式说明"
            description={
              <div>
                <div>• 每行一条记录</div>
                <div>• 格式1：笔记ID 短链接（推荐，空格或制表符分隔）</div>
                <div>• 格式2：仅短链接（系统将尝试自动关联）</div>
                <div style={{ marginTop: 8, color: '#1890ff' }}>
                  示例：695b5cb00000000009038538 http://xhslink.com/o/Al86aESFGd9
                </div>
              </div>
            }
            type="info"
          />

          {/* 输入区域 */}
          <div>
            <div style={{ marginBottom: 8 }}>粘贴数据：</div>
            <Input.TextArea
              value={batchImportModal.importText}
              onChange={(e) => setBatchImportModal({ ...batchImportModal, importText: e.target.value })}
              placeholder={`695b5cb00000000009038538 http://xhslink.com/o/Al86aESFGd9\n696f1c3fcdb7e67569fed6a2 http://xhslink.com/o/3QKQCFzddFI`}
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>

          {/* 预览提取的数据 */}
          {batchImportModal.extractedData.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                已提取 {batchImportModal.extractedData.length} 条数据：
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                <Table
                  size="small"
                  dataSource={batchImportModal.extractedData}
                  pagination={false}
                  columns={[
                    {
                      title: '笔记ID',
                      dataIndex: 'noteId',
                      key: 'noteId',
                      width: 150,
                      render: (id) => (
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {id ? (id.length > 12 ? id.substring(0, 12) + '...' : id) : <span style={{ color: '#999' }}>自动解析</span>}
                        </span>
                      )
                    },
                    {
                      title: '短链接',
                      dataIndex: 'shortUrl',
                      key: 'shortUrl',
                      ellipsis: true,
                      render: (url) => (
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {url && url.length > 40 ? url.substring(0, 40) + '...' : url}
                        </span>
                      )
                    },
                    {
                      title: '状态',
                      key: 'status',
                      width: 80,
                      render: (_, record) => record.isValid ?
                        <Tag color="green">有效</Tag> :
                        <Tag color="red">无效</Tag>
                    }
                  ]}
                  scroll={{ y: 180 }}
                />
              </div>
            </div>
          )}
        </Space>
      </Modal>

      {/* 手动导入笔记模态框 */}
      <Modal
        title="手动导入笔记"
        open={manualImportModal.visible}
        onCancel={() => setManualImportModal({
          visible: false,
          importing: false,
          noteId: '',
          noteUrl: '',
          title: '',
          author: '',
          keyword: ''
        })}
        onOk={handleManualImport}
        okText="确认导入"
        cancelText="取消"
        okButtonProps={{ loading: manualImportModal.importing }}
        cancelButtonProps={{ disabled: manualImportModal.importing }}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="导入说明"
            description={
              <div>
                <div>• 粘贴小红书笔记链接，系统会自动提取笔记ID</div>
                <div>• 也可以直接输入笔记ID（24位字符）</div>
                <div>• 标题、作者、关键词为可选，不填写会使用默认值</div>
              </div>
            }
            type="info"
          />

          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#ff4d4f' }}>* </span>笔记链接
            </div>
            <Input
              placeholder="https://www.xiaohongshu.com/explore/..."
              value={manualImportModal.noteUrl}
              onChange={handleNoteUrlChange}
              allowClear
            />
          </div>

          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#ff4d4f' }}>* </span>笔记ID
            </div>
            <Input
              placeholder="695b5cb00000000009038538"
              value={manualImportModal.noteId}
              onChange={(e) => setManualImportModal({ ...manualImportModal, noteId: e.target.value })}
              allowClear
            />
          </div>

          <div>
            <div style={{ marginBottom: 4 }}>笔记标题（可选）</div>
            <Input
              placeholder="留空则使用默认值"
              value={manualImportModal.title}
              onChange={(e) => setManualImportModal({ ...manualImportModal, title: e.target.value })}
              allowClear
            />
          </div>

          <div>
            <div style={{ marginBottom: 4 }}>作者昵称（可选）</div>
            <Input
              placeholder="留空则使用默认值"
              value={manualImportModal.author}
              onChange={(e) => setManualImportModal({ ...manualImportModal, author: e.target.value })}
              allowClear
            />
          </div>

          <div>
            <div style={{ marginBottom: 4 }}>发现关键词（可选）</div>
            <Input
              placeholder="如：祛斑被骗"
              value={manualImportModal.keyword}
              onChange={(e) => setManualImportModal({ ...manualImportModal, keyword: e.target.value })}
              allowClear
            />
          </div>
        </Space>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        title="确认删除"
        open={deleteModal.visible}
        onOk={deleteModal.noteId ? handleDeleteConfirm : handleBatchDeleteConfirm}
        onCancel={() => setDeleteModal({ visible: false, noteId: null, noteTitle: '' })}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除以下笔记吗？</p>
        <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {deleteModal.noteTitle}
        </p>
        <p style={{ color: '#999', fontSize: '12px' }}>
          此操作不可恢复，删除后数据将无法找回。
        </p>
      </Modal>

      {/* 修改删除状态模态框 */}
      <Modal
        title="修改删除状态"
        open={noteStatusModal.visible}
        onCancel={() => setNoteStatusModal({ visible: false, noteId: null, noteTitle: '', currentStatus: '' })}
        footer={null}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ color: '#999', fontSize: '12px', marginBottom: 4 }}>笔记：</div>
            <div style={{ fontWeight: 'bold' }}>{noteStatusModal.noteTitle}</div>
          </div>

          <div>
            <div style={{ color: '#999', fontSize: '12px', marginBottom: 8 }}>选择状态：</div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                type={noteStatusModal.currentStatus === 'active' ? 'primary' : 'default'}
                icon={<CheckCircleOutlined />}
                onClick={() => handleSaveNoteStatus('active')}
                style={{ textAlign: 'left', height: '40px' }}
              >
                <div>
                  <div>🟢 正常</div>
                  <div style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>笔记正常存在，可以继续采集评论</div>
                </div>
              </Button>

              <Button
                block
                type={noteStatusModal.currentStatus === 'deleted' ? 'primary' : 'default'}
                danger={noteStatusModal.currentStatus !== 'deleted'}
                icon={<StopOutlined />}
                onClick={() => handleSaveNoteStatus('deleted')}
                style={{ textAlign: 'left', height: '40px' }}
              >
                <div>
                  <div>🗑️ 已删除</div>
                  <div style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>笔记已被删除，停止采集评论</div>
                </div>
              </Button>

              <Button
                block
                type={noteStatusModal.currentStatus === 'ai_rejected' ? 'primary' : 'default'}
                onClick={() => handleSaveNoteStatus('ai_rejected')}
                style={{ textAlign: 'left', height: '40px', borderColor: '#fa8c16', color: '#fa8c16' }}
              >
                <div>
                  <div>❌ 文意不符</div>
                  <div style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>AI审核不通过，文意不符合要求</div>
                </div>
              </Button>
            </Space>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Button onClick={() => setNoteStatusModal({ visible: false, noteId: null, noteTitle: '', currentStatus: '' })}>
              取消
            </Button>
          </div>
        </Space>
      </Modal>

      {/* AI分析理由模态框 */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ color: '#1890ff' }} />
            AI分析理由
          </span>
        }
        open={aiAnalysisModal.visible}
        onCancel={() => setAiAnalysisModal({ visible: false, noteTitle: '', noteKeyword: '', aiAnalysis: null, deletionCheckAnalysis: null, deletionRecheckAnalysis: null })}
        footer={[
          <Button key="close" onClick={() => setAiAnalysisModal({ visible: false, noteTitle: '', noteKeyword: '', aiAnalysis: null, deletionCheckAnalysis: null, deletionRecheckAnalysis: null })}>
            关闭
          </Button>
        ]}
        width={900}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 笔记基本信息 */}
          <div>
            <div style={{ color: '#999', fontSize: '12px', marginBottom: 4 }}>笔记标题</div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{aiAnalysisModal.noteTitle || '无标题'}</div>
            {aiAnalysisModal.noteKeyword && (
              <Tag color="blue" style={{ marginTop: 8 }}>{aiAnalysisModal.noteKeyword}</Tag>
            )}
          </div>

          {/* 三个分析结果对比 */}
          <div style={{ display: 'flex', gap: 12, flexDirection: 'row' }}>
            {/* 1. 采集时分析 */}
            <div style={{ flex: 1, background: aiAnalysisModal.aiAnalysis?.is_genuine_victim_post ? '#f6ffed' : '#fff7e6', padding: 14, borderRadius: 8, border: `1px solid ${aiAnalysisModal.aiAnalysis?.is_genuine_victim_post ? '#b7eb8f' : '#ffd591'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: 6 }}>📋 采集筛选</span>
                <Tag color={aiAnalysisModal.aiAnalysis?.is_genuine_victim_post ? 'success' : 'warning'} style={{ fontSize: '10px' }}>
                  {aiAnalysisModal.aiAnalysis?.is_genuine_victim_post ? '✅ 通过' : '❌ 拒绝'}
                </Tag>
              </div>

              {aiAnalysisModal.aiAnalysis ? (
                <div style={{ fontSize: '12px' }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: aiAnalysisModal.aiAnalysis.is_genuine_victim_post ? 'normal' : 'bold', color: aiAnalysisModal.aiAnalysis.is_genuine_victim_post ? '#52c41a' : '#fa541c' }}>
                      {aiAnalysisModal.aiAnalysis.is_genuine_victim_post ? '符合要求' : '不符合要求'}
                    </span>
                    {aiAnalysisModal.aiAnalysis.confidence_score && (
                      <span style={{ color: '#999', fontSize: '10px', marginLeft: 6 }}>
                        ({(aiAnalysisModal.aiAnalysis.confidence_score * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {aiAnalysisModal.aiAnalysis.reason && (
                    <div style={{ color: '#666', fontSize: '11px', lineHeight: '1.4', maxHeight: '100px', overflowY: 'auto' }}>
                      {aiAnalysisModal.aiAnalysis.reason}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#999', fontSize: '12px', textAlign: 'center', padding: 10 }}>暂无数据</div>
              )}
            </div>

            {/* 2. 删除检测分析 */}
            <div style={{ flex: 1, background: aiAnalysisModal.deletionCheckAnalysis?.is_genuine_victim_post ? '#f6ffed' : '#fff1f0', padding: 14, borderRadius: 8, border: `1px solid ${aiAnalysisModal.deletionCheckAnalysis?.is_genuine_victim_post ? '#b7eb8f' : '#ffccc7'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: 6 }}>🔍 删除检测</span>
                <Tag color={aiAnalysisModal.deletionCheckAnalysis?.is_genuine_victim_post ? 'success' : 'error'} style={{ fontSize: '10px' }}>
                  {aiAnalysisModal.deletionCheckAnalysis?.is_genuine_victim_post ? '✅ 通过' : '❌ 拒绝'}
                </Tag>
              </div>

              {aiAnalysisModal.deletionCheckAnalysis ? (
                <div style={{ fontSize: '12px' }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: aiAnalysisModal.deletionCheckAnalysis.is_genuine_victim_post ? 'normal' : 'bold', color: aiAnalysisModal.deletionCheckAnalysis.is_genuine_victim_post ? '#52c41a' : '#cf1322' }}>
                      {aiAnalysisModal.deletionCheckAnalysis.is_genuine_victim_post ? '符合要求' : '不符合要求'}
                    </span>
                    {aiAnalysisModal.deletionCheckAnalysis.confidence_score && (
                      <span style={{ color: '#999', fontSize: '10px', marginLeft: 6 }}>
                        ({(aiAnalysisModal.deletionCheckAnalysis.confidence_score * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {aiAnalysisModal.deletionCheckAnalysis.reason && (
                    <div style={{ color: '#666', fontSize: '11px', lineHeight: '1.4', maxHeight: '100px', overflowY: 'auto' }}>
                      {aiAnalysisModal.deletionCheckAnalysis.reason}
                    </div>
                  )}
                  {aiAnalysisModal.deletionCheckAnalysis.checkedAt && (
                    <div style={{ marginTop: 6, fontSize: '10px', color: '#999' }}>
                      {new Date(aiAnalysisModal.deletionCheckAnalysis.checkedAt).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#999', fontSize: '12px', textAlign: 'center', padding: 10 }}>暂无数据</div>
              )}
            </div>

            {/* 3. 删除复审分析 */}
            <div style={{ flex: 1, background: aiAnalysisModal.deletionRecheckAnalysis?.is_genuine_victim_post ? '#f6ffed' : '#f0f5ff', padding: 14, borderRadius: 8, border: `1px solid ${aiAnalysisModal.deletionRecheckAnalysis?.is_genuine_victim_post ? '#b7eb8f' : '#adc6ff'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: 6 }}>🔄 删除复审</span>
                <Tag color={aiAnalysisModal.deletionRecheckAnalysis?.is_genuine_victim_post ? 'success' : 'default'} style={{ fontSize: '10px' }}>
                  {aiAnalysisModal.deletionRecheckAnalysis?.is_genuine_victim_post ? '✅ 通过' : '❌ 拒绝'}
                </Tag>
              </div>

              {aiAnalysisModal.deletionRecheckAnalysis ? (
                <div style={{ fontSize: '12px' }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: aiAnalysisModal.deletionRecheckAnalysis.is_genuine_victim_post ? 'normal' : 'bold', color: aiAnalysisModal.deletionRecheckAnalysis.is_genuine_victim_post ? '#52c41a' : '#8c8c8c' }}>
                      {aiAnalysisModal.deletionRecheckAnalysis.is_genuine_victim_post ? '符合要求' : '不符合要求'}
                    </span>
                    {aiAnalysisModal.deletionRecheckAnalysis.confidence_score && (
                      <span style={{ color: '#999', fontSize: '10px', marginLeft: 6 }}>
                        ({(aiAnalysisModal.deletionRecheckAnalysis.confidence_score * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {aiAnalysisModal.deletionRecheckAnalysis.reason && (
                    <div style={{ color: '#666', fontSize: '11px', lineHeight: '1.4', maxHeight: '100px', overflowY: 'auto' }}>
                      {aiAnalysisModal.deletionRecheckAnalysis.reason}
                    </div>
                  )}
                  {aiAnalysisModal.deletionRecheckAnalysis.checkedAt && (
                    <div style={{ marginTop: 6, fontSize: '10px', color: '#999' }}>
                      {new Date(aiAnalysisModal.deletionRecheckAnalysis.checkedAt).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#999', fontSize: '12px', textAlign: 'center', padding: 10 }}>暂无数据</div>
              )}
            </div>
          </div>

          {/* 如果三个都没有 */}
          {!aiAnalysisModal.aiAnalysis && !aiAnalysisModal.deletionCheckAnalysis && !aiAnalysisModal.deletionRecheckAnalysis && (
            <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
              暂无AI分析数据
            </div>
          )}
        </Space>
      </Modal>

      {/* 优先级配置编辑模态框 */}
      <Modal
        title="采集优先级间隔配置"
        open={priorityConfigModal.visible}
        onOk={handleSavePriorityConfig}
        onCancel={() => setPriorityConfigModal({ visible: false, intervals: priorityConfig.intervals })}
        confirmLoading={priorityConfigModal.loading}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="配置说明"
            description="设置不同优先级的采集间隔（单位：分钟）。修改后会立即生效，采集客户端会在5分钟内获取最新配置。"
            type="info"
            showIcon
          />
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>🔴 高优先级 (10分)</span>
            <InputNumber
              value={priorityConfigModal.intervals[10]}
              onChange={(value) => setPriorityConfigModal({
                ...priorityConfigModal,
                intervals: { ...priorityConfigModal.intervals, 10: value || 10 }
              })}
              min={1}
              max={1440}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>🟠 中优先级 (5分)</span>
            <InputNumber
              value={priorityConfigModal.intervals[5]}
              onChange={(value) => setPriorityConfigModal({
                ...priorityConfigModal,
                intervals: { ...priorityConfigModal.intervals, 5: value || 60 }
              })}
              min={1}
              max={1440}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>🟡 低优先级 (2分)</span>
            <InputNumber
              value={priorityConfigModal.intervals[2]}
              onChange={(value) => setPriorityConfigModal({
                ...priorityConfigModal,
                intervals: { ...priorityConfigModal.intervals, 2: value || 360 }
              })}
              min={1}
              max={1440}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>🟢 最低优先级 (1分)</span>
            <InputNumber
              value={priorityConfigModal.intervals[1]}
              onChange={(value) => setPriorityConfigModal({
                ...priorityConfigModal,
                intervals: { ...priorityConfigModal.intervals, 1: value || 1440 }
              })}
              min={1}
              max={10080}
              style={{ width: 120 }}
              addonAfter="分钟"
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default DiscoveredNotes;
