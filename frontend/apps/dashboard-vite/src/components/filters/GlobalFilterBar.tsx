import { DatePicker, Input, Space, Button } from 'antd';
import dayjs from 'dayjs';
import { useFilterStore } from '../../store/filters';

export function GlobalFilterBar() {
  const { filters, setFilters, reset } = useFilterStore();

  return (
    <Space
      style={{
        width: '100%',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.9)'
      }}
      wrap
    >
      <Space size={12} wrap>
        <DatePicker.RangePicker
          value={
            filters.dateRange
              ? [filters.dateRange[0] ? dayjs(filters.dateRange[0]) : null, filters.dateRange[1] ? dayjs(filters.dateRange[1]) : null]
              : null
          }
          onChange={(dates) =>
            setFilters((prev) => ({
              ...prev,
              dateRange: dates
                ? [dates[0]?.toISOString() ?? '', dates[1]?.toISOString() ?? '']
                : undefined
            }))
          }
        />
        <Input
          allowClear
          placeholder="Filter by payer"
          value={filters.payer ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              payer: event.target.value || null
            }))
          }
        />
        <Input
          allowClear
          placeholder="Filter by device category"
          value={filters.deviceCategory ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              deviceCategory: event.target.value || null
            }))
          }
        />
      </Space>
      <Button onClick={() => reset()} type="link">
        Reset filters
      </Button>
    </Space>
  );
}
