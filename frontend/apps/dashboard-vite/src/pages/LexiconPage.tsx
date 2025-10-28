import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Form, Input, InputNumber, Row, Space, Typography, message, Card } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { ChartCard } from '../components/ChartCard';
import { LexiconGraphView } from '../components/graphs/LexiconGraphView';
import { buildLexiconGraph, expandLexicon } from '../lib/lexicon';
import offlineLexicon from '../sample/kpi_lexicon.json';

type LexiconEntry = { term: string; definition: string };

const sampleClosure: Record<string, string> =
  (offlineLexicon as { terms?: Record<string, string> }).terms ?? {};

export function LexiconPage() {
  const [form] = Form.useForm();
  const [closure, setClosure] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [graphInstance, setGraphInstance] = useState<any>(null);

  useEffect(() => {
    if (!Object.keys(sampleClosure).length) return;
    setClosure(sampleClosure);
    setSelectedTerm(Object.keys(sampleClosure)[0] ?? null);
  }, []);

  const entries: LexiconEntry[] = useMemo(
    () =>
      Object.entries(closure)
        .map(([term, definition]) => ({ term, definition }))
        .sort((a, b) => a.term.localeCompare(b.term)),
    [closure]
  );

  const graphData = useMemo(() => buildLexiconGraph(closure), [closure]);

  const handleExpand = async (values: { roots: string; depth: number }) => {
    const rootList = values.roots
      .split(',')
      .map((term) => term.trim())
      .filter(Boolean);
    if (!rootList.length) {
      message.warning('Provide at least one root term.');
      return;
    }
    setLoading(true);
    try {
      const result = await expandLexicon(rootList, values.depth);
      setClosure(result.closure || {});
      setSelectedTerm(rootList[0] ?? null);
      message.success('Lexicon expanded');
    } catch (error: any) {
      message.error(error?.message || 'Expansion failed. Check API and try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDefinition =
    selectedTerm && closure[selectedTerm] ? closure[selectedTerm] : 'Select a term to view its definition.';

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <ChartCard
        title="Expand terms"
        subTitle="Enter comma-separated roots and a depth. We will recursively expand from definitions."
        extra={
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => graphInstance?.downloadFullImage?.('lexicon-graph')}
              disabled={!graphInstance}
            >
              Export PNG
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => graphInstance?.downloadImage?.('lexicon-graph.svg', 'image/svg+xml')}
              disabled={!graphInstance}
            >
              Export SVG
            </Button>
          </Space>
        }
      >
        <Form
          layout="inline"
          form={form}
          initialValues={{ roots: 'dso, denial_rate, sla', depth: 2 }}
          onFinish={handleExpand}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
        >
          <Form.Item
            label="Root terms"
            name="roots"
            style={{ flexGrow: 1, minWidth: 280 }}
            rules={[{ required: true }]}
          >
            <Input placeholder="dso, denial_rate, sla" />
          </Form.Item>
          <Form.Item label="Depth" name="depth" initialValue={2}>
            <InputNumber min={0} max={6} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Expand
            </Button>
          </Form.Item>
        </Form>
      </ChartCard>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard title="Closure" subTitle="Expanded definitions for requested terms." loading={loading}>
            <Card
              bordered={false}
              style={{ maxHeight: 420, overflow: 'auto', borderRadius: 12 }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {entries.map((entry) => (
                  <div
                    key={entry.term}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: entry.term === selectedTerm ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: entry.term === selectedTerm ? '#eff6ff' : '#fff',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedTerm(entry.term)}
                  >
                    <Typography.Text strong>{entry.term}</Typography.Text>
                    <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
                      {entry.definition}
                    </Typography.Paragraph>
                  </div>
                ))}
                {!entries.length && <Typography.Text type="secondary">No terms expanded yet.</Typography.Text>}
              </Space>
            </Card>
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Lexicon graph"
            subTitle="Relationship map showing how KPI terms reference each other."
            loading={loading}
          >
            <LexiconGraphView
              data={graphData}
              loading={loading}
              onNodeFocus={setSelectedTerm}
              onGraphReady={setGraphInstance}
            />
          </ChartCard>
        </Col>
      </Row>

      <Card
        title={selectedTerm ? `Definition • ${selectedTerm}` : 'Definition'}
        style={{ borderRadius: 16, boxShadow: '0 16px 44px -28px rgba(15,23,42,0.3)' }}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>{selectedDefinition}</Typography.Paragraph>
      </Card>
    </Space>
  );
}
