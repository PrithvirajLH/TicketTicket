import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Columns3 } from 'lucide-react';
import type { TicketRecord } from '../api/client';
import type {
  TableColumnId,
  TableSettings,
} from '../hooks/useTableSettings';
import { TABLE_COLUMN_IDS } from '../hooks/useTableSettings';
import { RelativeTime } from './RelativeTime';
import { formatStatus, formatTicketId, getSlaTone, statusBadgeClass } from '../utils/format';
import type { SortField, SortOrder } from '../types';

const COLUMN_LABELS: Record<TableColumnId, string> = {
  checkbox: '',
  id: 'ID',
  subject: 'Subject',
  status: 'Status',
  priority: 'Priority',
  team: 'Team',
  assignee: 'Assignee',
  requester: 'Requester',
  createdAt: 'Created',
  slaStatus: 'SLA',
};

const SORTABLE_COLUMNS: SortField[] = ['createdAt', 'updatedAt', 'completedAt'];

const SORT_FIELD_LABELS: Record<SortField, string> = {
  createdAt: 'Created',
  updatedAt: 'Updated',
  completedAt: 'Completed',
};

function sortStatusLabel(field: SortField, order: SortOrder): string {
  const name = SORT_FIELD_LABELS[field];
  const direction = order === 'desc' ? 'newest first' : 'oldest first';
  return `Sorted by: ${name} (${direction})`;
}

type TicketTableViewProps = {
  tickets: TicketRecord[];
  role: string;
  selection: {
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
    toggleAll: () => void;
    isAllSelected: boolean;
  };
  columnWidths: TableSettings['columnWidths'];
  columnVisibility: TableSettings['columnVisibility'];
  setColumnWidth: (id: TableColumnId, width: number) => void;
  setColumnVisible: (id: TableColumnId, visible: boolean) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  onRowClick: (ticket: TicketRecord) => void;
};

export function TicketTableView({
  tickets,
  role,
  selection,
  columnWidths,
  columnVisibility,
  setColumnWidth,
  setColumnVisible,
  sortField,
  sortOrder,
  onSortChange,
  onRowClick,
}: TicketTableViewProps) {
  const [resizing, setResizing] = useState<{ columnId: TableColumnId; startX: number; startWidth: number } | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const visibleColumns = TABLE_COLUMN_IDS.filter((id) => columnVisibility[id]);

  const handleResizeStart = useCallback(
    (columnId: TableColumnId, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing({ columnId, startX: e.clientX, startWidth: columnWidths[columnId] });
    },
    [columnWidths]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizing) return;
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(60, Math.min(400, resizing.startWidth + delta));
      setColumnWidth(resizing.columnId, newWidth);
    },
    [resizing, setColumnWidth]
  );

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, handleMouseMove, handleMouseUp]);

  const handleSortClick = useCallback(
    (field: SortField) => {
      if (!SORTABLE_COLUMNS.includes(field)) return;
      const nextOrder =
        sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
      onSortChange(field, nextOrder);
    },
    [sortField, sortOrder, onSortChange]
  );

  const showCheckbox = role !== 'EMPLOYEE';

  return (
    <div className="mt-4 w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <span className="text-sm text-slate-500" aria-live="polite">
          {sortStatusLabel(sortField, sortOrder)}
        </span>
        <div className="relative" ref={popoverRef}>
          <button
            ref={columnsButtonRef}
            type="button"
            onClick={() => setColumnsOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Columns3 className="h-4 w-4" />
            Columns
            <ChevronDown className={`h-4 w-4 transition ${columnsOpen ? 'rotate-180' : ''}`} />
          </button>
          {columnsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setColumnsOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                {TABLE_COLUMN_IDS.filter((id) => id !== 'checkbox').map((id) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={columnVisibility[id]}
                      onChange={(e) => setColumnVisible(id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    {COLUMN_LABELS[id]}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead className="sticky top-0 z-[1]">
          <tr className="border-b border-slate-200 bg-slate-50">
            {showCheckbox && visibleColumns.includes('checkbox') && (
              <th
                className="sticky left-0 z-[2] border-b border-r border-slate-200 bg-slate-50 p-0 text-left"
                style={{ width: columnWidths.checkbox, minWidth: columnWidths.checkbox }}
              >
                <div className="flex h-10 items-center justify-center px-2">
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected}
                    onChange={selection.toggleAll}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
                    aria-label="Select all"
                  />
                </div>
              </th>
            )}
            {visibleColumns.map((colId) => {
              if (colId === 'checkbox') return null;
              const width = columnWidths[colId];
              const isSortable = SORTABLE_COLUMNS.includes(colId as SortField);
              const isActiveSort = sortField === colId;
              return (
                <th
                  key={colId}
                  className="relative border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-700"
                  style={{ width, minWidth: width }}
                >
                  <button
                    type="button"
                    onClick={() => isSortable && handleSortClick(colId as SortField)}
                    className={`flex w-full items-center gap-1 text-left ${isSortable ? 'cursor-pointer hover:text-slate-900' : 'cursor-default'}`}
                  >
                    {COLUMN_LABELS[colId]}
                    {isSortable && isActiveSort && (
                      sortOrder === 'desc' ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                      )
                    )}
                  </button>
                  <div
                    role="separator"
                    onMouseDown={(e) => handleResizeStart(colId, e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-slate-300/50"
                    aria-label={`Resize ${COLUMN_LABELS[colId]} column`}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const sla = getSlaTone({
              dueAt: ticket.dueAt,
              completedAt: ticket.completedAt,
              status: ticket.status,
              slaPausedAt: ticket.slaPausedAt,
            });
            return (
              <tr
                key={ticket.id}
                onClick={() => onRowClick(ticket)}
                className="border-b border-slate-100 transition hover:bg-slate-50/80 cursor-pointer"
              >
                {showCheckbox && visibleColumns.includes('checkbox') && (
                  <td
                    className="sticky left-0 z-[2] border-b border-r border-slate-100 bg-white p-0"
                    style={{ width: columnWidths.checkbox, minWidth: columnWidths.checkbox }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex h-12 items-center justify-center px-2">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(ticket.id)}
                        onChange={() => selection.toggle(ticket.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
                        aria-label={`Select ${ticket.subject}`}
                      />
                    </div>
                  </td>
                )}
                {visibleColumns.includes('id') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 font-mono text-xs text-slate-600"
                    style={{ width: columnWidths.id, minWidth: columnWidths.id }}
                  >
                    {formatTicketId(ticket)}
                  </td>
                )}
                {visibleColumns.includes('subject') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 text-slate-900"
                    style={{ width: columnWidths.subject, minWidth: columnWidths.subject }}
                    title={ticket.subject}
                  >
                    <span className="block truncate">{ticket.subject}</span>
                  </td>
                )}
                {visibleColumns.includes('status') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2"
                    style={{ width: columnWidths.status, minWidth: columnWidths.status }}
                  >
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(ticket.status)}`}
                    >
                      {formatStatus(ticket.status)}
                    </span>
                  </td>
                )}
                {visibleColumns.includes('priority') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 text-slate-600"
                    style={{ width: columnWidths.priority, minWidth: columnWidths.priority }}
                  >
                    {ticket.priority}
                  </td>
                )}
                {visibleColumns.includes('team') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 text-slate-600 truncate"
                    style={{ width: columnWidths.team, minWidth: columnWidths.team }}
                    title={ticket.assignedTeam?.name ?? '—'}
                  >
                    {ticket.assignedTeam?.name ?? '—'}
                  </td>
                )}
                {visibleColumns.includes('assignee') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 text-slate-600 truncate"
                    style={{ width: columnWidths.assignee, minWidth: columnWidths.assignee }}
                    title={ticket.assignee?.displayName ?? ticket.assignee?.email ?? '—'}
                  >
                    {ticket.assignee?.displayName ?? ticket.assignee?.email ?? '—'}
                  </td>
                )}
                {visibleColumns.includes('requester') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 text-slate-600 truncate"
                    style={{ width: columnWidths.requester, minWidth: columnWidths.requester }}
                    title={ticket.requester?.displayName ?? ticket.requester?.email ?? '—'}
                  >
                    {ticket.requester?.displayName ?? ticket.requester?.email ?? '—'}
                  </td>
                )}
                {visibleColumns.includes('createdAt') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2 text-slate-500"
                    style={{ width: columnWidths.createdAt, minWidth: columnWidths.createdAt }}
                  >
                    <RelativeTime value={ticket.createdAt} />
                  </td>
                )}
                {visibleColumns.includes('slaStatus') && (
                  <td
                    className="border-b border-slate-100 px-3 py-2"
                    style={{ width: columnWidths.slaStatus, minWidth: columnWidths.slaStatus }}
                  >
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sla.className}`}
                    >
                      {sla.label}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
