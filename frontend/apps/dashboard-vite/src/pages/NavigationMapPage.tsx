import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Space, Typography, Tag, Button, List } from 'antd';
import { ChartCard } from '../components/ChartCard';
import { LexiconGraphView } from '../components/graphs/LexiconGraphView';
import { siteNodes, siteEdges } from '../lib/siteMap';

const siteNodeMap = siteNodes.reduce<Record<string, typeof siteNodes[number]>>((acc, node) => {
  acc[node.id] = node;
  return acc;
}, {});

export function NavigationMapPage() {
  const navigate = useNavigate();
  const [selectedNodeId, setSelectedNodeId] = useState<string>('dashboard-shell');

  const graphData = useMemo(
    () => ({
      nodes: siteNodes.map((node) => ({
        id: node.id,
        label: node.label,
        definition: node.description
      })),
      edges: siteEdges.length
        ? siteEdges
        : siteNodes
            .filter((node) => node.id !== 'dashboard-shell')
            .map((node) => ({ source: 'dashboard-shell', target: node.id }))
    }),
    []
  );

  const selected = siteNodeMap[selectedNodeId] ?? siteNodeMap['dashboard-shell'];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <ChartCard
        title="Navigation map"
        subTitle="Click nodes to inspect a section. Use the action buttons below to jump into that part of the dashboard."
      >
        <LexiconGraphView
          data={graphData}
          onNodeFocus={setSelectedNodeId}
          height={520}
        />
      </ChartCard>

      <ChartCard
        title={selected.label}
        subTitle={selected.path ? `Route: ${selected.path}` : 'High-level shell'}
        footer={
          selected.path ? (
            <Button type="primary" onClick={() => navigate(selected.path)}>
              Open {selected.label}
            </Button>
          ) : (
            <Typography.Text type="secondary">
              Select a destination node to deep-link into the dashboard.
            </Typography.Text>
          )
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>{selected.description}</Typography.Paragraph>
          {selected.tags?.length ? (
            <Space size={[8, 8]} wrap>
              {selected.tags.map((tag) => (
                <Tag key={tag} color="blue">
                  {tag}
                </Tag>
              ))}
            </Space>
          ) : null}
        </Space>
      </ChartCard>

      <ChartCard
        title="Pages"
        subTitle="List of dashboard sections with their paths and quick descriptions."
      >
        <List
          dataSource={siteNodes.filter((node) => node.path)}
          renderItem={(node) => (
            <List.Item
              key={node.id}
              actions={[
                <Button key="view" type="link" onClick={() => navigate(node.path!)}>
                  View
                </Button>
              ]}
              onClick={() => setSelectedNodeId(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                title={
                  <Space size={8}>
                    <Typography.Text strong>{node.label}</Typography.Text>
                    <Typography.Text type="secondary">{node.path}</Typography.Text>
                  </Space>
                }
                description={node.description}
              />
            </List.Item>
          )}
        />
      </ChartCard>
    </Space>
  );
}
