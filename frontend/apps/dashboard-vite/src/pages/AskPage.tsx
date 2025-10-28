import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Card,
  Dropdown,
  Input,
  List,
  MenuProps,
  Space,
  Typography,
  message
} from 'antd';
import { CopyOutlined, RedoOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useDashboardSnapshot } from '../hooks/useDashboardData';
import { createApiClient } from '../lib/api';
import { useChatStore } from '../store/chat';

const api = createApiClient();

export function AskPage() {
  const { data: snapshot } = useDashboardSnapshot();
  const { messages, addMessage, updateMessage, reset } = useChatStore();
  const [input, setInput] = useState('Which claims need documentation?');
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const container = listRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  };

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await api.askDashboard({
        messages: [{ role: 'user', content: question }],
        context: { data: snapshot },
        model: null
      });
      return response.message.content;
    },
    onError: () => {
      message.error('Ask failed. Please retry.');
    }
  });

  useEffect(() => {
    if (!askMutation.isSuccess || !pendingAssistantId.current) return;
    updateMessage(pendingAssistantId.current, { content: askMutation.data, status: 'success' });
    scrollToBottom();
  }, [askMutation.isSuccess, askMutation.data, updateMessage]);

  useEffect(() => {
    if (!askMutation.isError || !pendingAssistantId.current) return;
    updateMessage(pendingAssistantId.current, { status: 'error' });
  }, [askMutation.isError, updateMessage]);

  const pendingAssistantId = useRef<string | null>(null);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question) return;

    addMessage({ role: 'user', content: question, status: 'success' });
    const assistantId = addMessage({ role: 'assistant', content: '...', status: 'pending' });
    pendingAssistantId.current = assistantId;
    setInput('');
    scrollToBottom();
    askMutation.mutate(question);
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((msg) => msg.role === 'user');
    if (!lastUser) {
      message.info('No previous question to retry.');
      return;
    }
    const assistantId = addMessage({ role: 'assistant', content: '...', status: 'pending' });
    pendingAssistantId.current = assistantId;
    scrollToBottom();
    askMutation.mutate(lastUser.content);
  };

  const copyLastAnswer = async () => {
    const lastAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant');
    if (!lastAssistant) {
      message.info('No answer to copy yet.');
      return;
    }
    await navigator.clipboard.writeText(lastAssistant.content);
    message.success('Answer copied to clipboard');
  };

  const actions: MenuProps['items'] = [
    {
      key: 'retry',
      icon: <RedoOutlined />,
      label: 'Retry last question',
      onClick: retryLast
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: 'Copy last answer',
      onClick: copyLastAnswer
    },
    {
      key: 'reset',
      icon: <DeleteOutlined />,
      label: 'Clear conversation',
      onClick: () => {
        reset();
        message.success('Conversation cleared');
      }
    }
  ];

  const conversation = useMemo(() => messages, [messages]);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        title="Ask the Dashboard"
        extra={
          <Dropdown menu={{ items: actions }} trigger={['click']}>
            <Button icon={<ReloadOutlined />}>Actions</Button>
          </Dropdown>
        }
        style={{ borderRadius: 16, boxShadow: '0 24px 60px -30px rgba(15,23,42,0.32)' }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div
            ref={listRef}
            style={{
              height: 420,
              overflowY: 'auto',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 16,
              background: 'rgba(255,255,255,0.9)'
            }}
          >
            <List
              dataSource={conversation}
              locale={{ emptyText: 'Try asking: “Which claims need documentation?”' }}
              renderItem={(item) => (
                <List.Item style={{ border: 'none', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Bubble role={item.role} status={item.status}>
                    {item.content}
                  </Bubble>
                </List.Item>
              )}
            />
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12 }}>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question about ops, finance, or inventory…"
              disabled={askMutation.isLoading}
            />
            <Button type="primary" htmlType="submit" loading={askMutation.isLoading}>
              Send
            </Button>
          </form>
        </Space>
      </Card>
    </Space>
  );
}

function Bubble({
  role,
  status,
  children
}: {
  role: 'user' | 'assistant';
  status?: 'pending' | 'error' | 'success';
  children: string;
}) {
  const align = role === 'user' ? 'flex-end' : 'flex-start';
  const background = role === 'user' ? '#2563eb' : '#f1f5f9';
  const color = role === 'user' ? '#fff' : '#0f172a';
  const borderColor =
    status === 'error' ? '#dc2626' : status === 'pending' ? '#2563eb' : 'transparent';

  return (
    <div style={{ display: 'flex', justifyContent: align, width: '100%' }}>
      <div
        style={{
          maxWidth: '70%',
          background,
          color,
          padding: '12px 16px',
          borderRadius: role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          border: `1px solid ${borderColor}`,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap'
        }}
      >
        {children}
      </div>
    </div>
  );
}
