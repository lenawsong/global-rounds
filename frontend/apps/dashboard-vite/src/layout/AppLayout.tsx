'use client';

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import type { ReactNode } from 'react';
import { Avatar, Badge, Button, Dropdown, Grid, Input, Space } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined, BulbOutlined, MoreOutlined } from '@ant-design/icons';
import { menuItems } from '../routes';
import { GlobalFilterBar } from '../components/filters/GlobalFilterBar';
import { useThemeStore } from '../store/theme';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeStore();

  const matchedRoute = useMemo(() => {
    const current = menuItems.find((item) => item.path === location.pathname);
    return current?.name ?? 'Overview';
  }, [location.pathname]);

  return (
    <ProLayout
      layout="mix"
      splitMenus
      logo={<BrandLogo />}
      title="Nexus Health"
      fixSiderbar
      fixedHeader
      locale="en-US"
      menu={{ locale: false }}
      location={{ pathname: location.pathname }}
      route={{ path: '/', routes: menuItems }}
      menuItemRender={(item, dom) => (
        <a
          onClick={(event) => {
            event.preventDefault();
            if (item.path) {
              navigate(item.path);
            }
          }}
        >
          {dom}
        </a>
      )}
      actionsRender={() => [
        <HeaderActions
          key="actions"
          mode={mode}
          onToggleTheme={toggleMode}
          onNavigate={navigate}
        />
      ]}
      token={{
        header: { colorBgHeader: '#ffffff' },
        sider: {
          colorMenuBackground: '#ffffff',
          colorTextMenu: '#1f2937',
          colorTextMenuSelected: '#2563eb',
          colorBgMenuItemHover: '#eff6ff'
        },
        pageContainer: {
          paddingInlinePageContainerContent: 24,
          paddingBlockPageContainerContent: 24,
          colorBgPageContainer: '#f4f7fb'
        }
      }}
    >
      <PageContainer
        header={{
          title: matchedRoute,
          ghost: true
        }}
      >
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <GlobalFilterBar />
          <div className="grid gap-6">{children}</div>
        </Space>
      </PageContainer>
    </ProLayout>
  );
}

import { NEXUS_LOGO_JPG } from '../assets/nexusLogoDataUri';

function BrandLogo() {
  return (
    <img
      src={NEXUS_LOGO_JPG}
      alt="Nexus Health"
      width={36}
      height={36}
      style={{ borderRadius: 8, objectFit: 'cover' }}
    />
  );
}

type HeaderActionsProps = {
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
};

function HeaderActions({ mode, onToggleTheme, onNavigate }: HeaderActionsProps) {
  const screens = Grid.useBreakpoint();
  const isCompact = !screens.lg;

  const navMenu: MenuProps = {
    onClick: ({ key }) => {
      if (key === 'ask') onNavigate('/ask');
      if (key === 'nav') onNavigate('/navigation-map');
    },
    items: [
      { key: 'ask', label: 'Ask the Dashboard' },
      { key: 'nav', label: 'Navigation Map' }
    ]
  };

  return (
    <Space
      size={isCompact ? 6 : 8}
      wrap
      align="center"
      style={{
        display: 'flex',
        width: '100%',
        justifyContent: isCompact ? 'space-between' : 'flex-end',
        rowGap: isCompact ? 6 : 8
      }}
    >
      {isCompact ? (
        <Dropdown menu={navMenu} trigger={['click']}>
          <Button icon={<MoreOutlined />} />
        </Dropdown>
      ) : (
        <>
          <Button type="link" onClick={() => onNavigate('/ask')}>
            Ask the Dashboard
          </Button>
          <Button type="link" onClick={() => onNavigate('/navigation-map')}>
            Navigation Map
          </Button>
        </>
      )}
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search metrics, orders, tasks..."
        style={{
          flex: isCompact ? '1 1 160px' : '0 0 260px',
          minWidth: 140,
          maxWidth: isCompact ? '100%' : 280
        }}
      />
      <Button
        type="text"
        icon={<BulbOutlined />}
        onClick={onToggleTheme}
      >
        {mode === 'dark' ? 'Dark' : 'Light'}
      </Button>
      <Badge count="Sandbox" color="#2563eb" />
      <Avatar shape="circle" size="small" style={{ background: '#1e3a8a' }}>
        NH
      </Avatar>
    </Space>
  );
}
