'use client';

import { useMemo } from 'react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams, type ValueFormatterParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { LedgerEntry } from './board';

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  fontFamily: 'inherit',
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 500,
  headerTextColor: 'var(--muted)',
  headerBackgroundColor: '#ffffff',
  backgroundColor: '#ffffff',
  foregroundColor: 'var(--ink)',
  borderColor: 'var(--line)',
  rowHoverColor: 'var(--wash)',
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowHeight: 34,
  headerHeight: 32,
  spacing: 6,
});

const money = ({ value }: ValueFormatterParams) => (value === null || value === undefined ? '' : `$${Number(value).toFixed(2)}`);

const STATUS_LOOK: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-800',
  SENDING: 'bg-sky-100 text-sky-800',
  PENDING: 'bg-sky-100 text-sky-800',
  PROCESSING: 'bg-sky-100 text-sky-800',
  UNCLAIMED: 'bg-amber-100 text-amber-800',
  ONHOLD: 'bg-amber-100 text-amber-800',
};

function StatusPill({ value }: ICellRendererParams<LedgerEntry, string>) {
  const status = value ?? '';
  return <span className={`status-pill inline-block rounded-full px-2 text-xs font-semibold leading-5 ${STATUS_LOOK[status] ?? 'bg-red-100 text-red-800'}`}>{status}</span>;
}

const COLUMNS: ColDef<LedgerEntry>[] = [
  {
    field: 'sentAt',
    headerName: 'Sent',
    width: 120,
    sort: 'desc',
    valueFormatter: ({ value }) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
  },
  { field: 'workerName', headerName: 'Person', width: 140 },
  { field: 'job', headerName: 'Job', flex: 1, minWidth: 180 },
  { field: 'hours', headerName: 'Hours', width: 80, type: 'rightAligned' },
  { field: 'amount', headerName: 'Paid', width: 100, type: 'rightAligned', valueFormatter: money },
  { field: 'fee', headerName: 'PayPal fee', width: 100, type: 'rightAligned', valueFormatter: money },
  { field: 'status', headerName: 'Status', width: 120, cellRenderer: StatusPill },
  { field: 'batchId', headerName: 'Payout batch', width: 170 },
  { field: 'transactionId', headerName: 'Transaction', width: 190 },
];

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const rowData = useMemo(() => entries, [entries]);
  if (entries.length === 0) {
    return <p className="grid h-full place-items-center text-sm text-[var(--muted)]">No payments yet. Approve a finished shift, and PayPal&apos;s answer shows up here.</p>;
  }
  return (
    <AgGridReact<LedgerEntry>
      theme={theme}
      rowData={rowData}
      columnDefs={COLUMNS}
      getRowId={({ data }) => `${data.run}-${data.shiftId}-${data.sentAt}`}
      suppressCellFocus
      suppressMovableColumns
      domLayout="normal"
    />
  );
}
