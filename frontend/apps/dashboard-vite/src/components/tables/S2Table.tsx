import type { SheetComponentOptions } from '@antv/s2-react';
import { SheetComponent } from '@antv/s2-react';
import '@antv/s2-react/dist/s2-react.min.css';
import type { ReactNode } from 'react';
import { Card } from 'antd';

export type S2Column = {
  field: string;
  title: string;
  width?: number;
};

type S2TableProps<T extends Record<string, any>> = {
  data: T[];
  columns: S2Column[];
  height?: number;
  toolbar?: ReactNode;
  frozenFirstColumn?: boolean;
};

export function S2Table<T extends Record<string, any>>({
  data,
  columns,
  height = 380,
  toolbar,
  frozenFirstColumn = true
}: S2TableProps<T>) {
  const dataCfg = {
    fields: {
      columns: columns.map((column) => column.field)
    },
    meta: columns.map((column) => ({
      field: column.field,
      name: column.title
    })),
    data
  };

  const options: SheetComponentOptions = {
    height,
    style: {
      layoutWidthType: 'compact',
      colCfg: {
        widthByFieldValue: columns.reduce<Record<string, number>>((acc, column) => {
          if (column.width) {
            acc[column.field] = column.width;
          }
          return acc;
        }, {})
      },
      cellCfg: {
        width: 160,
        height: 36
      }
    },
    interaction: {
      hoverHighlight: true,
      selectedCellsSpotlight: true
    },
    frozenRowHeader: frozenFirstColumn ? true : false
  };

  return (
    <Card
      bordered={false}
      bodyStyle={{ padding: 0 }}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 18px 50px -28px rgba(15,23,42,0.35)'
      }}
    >
      {toolbar ? <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>{toolbar}</div> : null}
      <SheetComponent dataCfg={dataCfg} options={options} sheetType="table" />
    </Card>
  );
}
