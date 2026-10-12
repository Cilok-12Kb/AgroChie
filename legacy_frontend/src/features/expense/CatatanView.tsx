'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { computeActualTotal, computeActualByCategory, computePhaseBudget } from '@/domain/calculations/cashflow';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AppButton } from '@/components/ui/AppButton';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/FeedbackState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah, EXPENSE_CATEGORY_LABELS } from '@/lib/formatters';
import { getWeekNumberFromDate } from '@/domain/calculations/seasons';
import type { Expense, ExpenseCategory } from '@/domain/models/types';
import { Plus, Pencil, Trash2, Lock, Filter } from 'lucide-react';

const expenseSchema = z.object({
  spentOn: z.string().min(1, 'Tanggal wajib diisi'),
  category: z.enum(['seed', 'fertilizer', 'pesticide', 'labor', 'other']),
  amountIdr: z.number().min(1, 'Nominal wajib diisi'),
  note: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const inputCls =
  'w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-[--text] focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition font-semibold';

export function CatatanView() {
  const qc = useQueryClient();
  const { season } = useActiveSeason();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  // Tanggal hari ini — di-set client-side via useEffect agar tidak dievaluasi saat prerender
  const todayRef = useRef('');

  const hasFinancing = canViewFinancing(season);

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', season?.id],
    queryFn: () => repositories.expense.getExpensesBySeason(season!.id),
    enabled: !!season?.id,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      spentOn: '',
      category: 'fertilizer',
      amountIdr: undefined,
    },
  });

  // Set tanggal hari ini setelah mount (client-only)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    todayRef.current = today;
    setValue('spentOn', today);
  }, [setValue]);

  const addMutation = useMutation({
    mutationFn: (data: ExpenseForm) => {
      const weekNumber = season?.plantingStartedAt
        ? getWeekNumberFromDate(season.plantingStartedAt, data.spentOn, season.crop)
        : undefined;
      return repositories.expense.addExpense({
        ...data,
        seasonId: season!.id,
        origin: 'actual',
        weekNumber,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      reset();
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repositories.expense.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setDeletingId(null);
    },
  });

  if (!hasFinancing) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Catatan pengeluaran" />
        <EmptyState
          icon={<Lock size={40} className="text-[--text-muted]" />}
          title="Mulai pembiayaan untuk mencatat"
          description="Buka menu Musim tanam dan klik Mulai untuk membuka fitur pencatatan pengeluaran."
        />
      </div>
    );
  }

  const actualExpenses = expenses.filter((e) => e.origin === 'actual');
  const filteredExpenses = filterCategory === 'all'
    ? actualExpenses
    : actualExpenses.filter((e) => e.category === filterCategory);

  const totalActual = computeActualTotal(expenses);
  const byCategory = computeActualByCategory(expenses);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Catatan pengeluaran"
        subtitle="Semua pengeluaran aktual musim ini."
        action={
          <AppButton
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={() => setShowForm(true)}
          >
            Catat pengeluaran
          </AppButton>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Total pengeluaran tercatat"
          value={formatRupiah(totalActual, true)}
          subtitle="Dari catatan aktual"
          highlight
        />
        <StatCard
          label="Pengeluaran minggu ini"
          value={formatRupiah(
            todayRef.current && season?.plantingStartedAt
              ? actualExpenses
                  .filter((e) => {
                    const week = getWeekNumberFromDate(season.plantingStartedAt!, e.spentOn, season.crop);
                    const curWeek = getWeekNumberFromDate(season.plantingStartedAt!, todayRef.current, season.crop);
                    return week === curWeek;
                  })
                  .reduce((s, e) => s + e.amountIdr, 0)
              : 0,
            true
          )}
          subtitle="Minggu berjalan"
        />
        <StatCard
          label="Jumlah transaksi"
          value={actualExpenses.length}
          subtitle="Total entri tercatat"
        />
      </div>

      {/* Form tambah */}
      {showForm && (
        <SectionCard title="Tambah pengeluaran">
          <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[--text] mb-1.5">Tanggal</label>
                <input {...register('spentOn')} type="date" className={inputCls} />
                {errors.spentOn && <p className="text-xs text-[--danger] mt-1">{errors.spentOn.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-bold text-[--text] mb-1.5">Kategori</label>
                <select {...register('category')} className={inputCls}>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[--text] mb-1.5">Nominal (Rp)</label>
                <input
                  {...register('amountIdr', { valueAsNumber: true })}
                  type="number" step="1000" min="0"
                  placeholder="1500000"
                  className={inputCls}
                />
                {errors.amountIdr && <p className="text-xs text-[--danger] mt-1">{errors.amountIdr.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-bold text-[--text] mb-1.5">Keterangan (opsional)</label>
                <input
                  {...register('note')}
                  placeholder="Misal: Pupuk NPK 20 kg"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <AppButton variant="outline" type="button" onClick={() => { setShowForm(false); reset(); }}>
                Batal
              </AppButton>
              <AppButton type="submit" isLoading={addMutation.isPending}>
                Simpan pengeluaran
              </AppButton>
            </div>
          </form>
        </SectionCard>
      )}

      {/* Per kategori */}
      <SectionCard title="Pengeluaran per kategori">
        <div className="space-y-2">
          {Object.entries(byCategory).map(([cat, amount]) => (
            <div key={cat} className="flex items-center justify-between py-2 border-b border-[--border] last:border-0">
              <span className="text-sm font-semibold text-[--text]">
                {EXPENSE_CATEGORY_LABELS[cat] ?? cat}
              </span>
              <span className="font-bold text-[--text] tabular-nums">{formatRupiah(amount, true)}</span>
            </div>
          ))}
          {Object.keys(byCategory).length === 0 && (
            <p className="text-sm text-[--text-muted] text-center py-4">Belum ada pengeluaran tercatat.</p>
          )}
        </div>
      </SectionCard>

      {/* Filter & list */}
      <SectionCard
        title="Daftar transaksi"
        action={
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[--text-muted]" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm border border-[--border] rounded-lg px-2 py-1 bg-[--surface] text-[--text] focus:outline-none"
            >
              <option value="all">Semua kategori</option>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        }
      >
        {filteredExpenses.length === 0 ? (
          <EmptyState
            title="Belum ada pengeluaran"
            description="Klik tombol Catat pengeluaran untuk menambah entri baru."
          />
        ) : (
          <div className="space-y-2">
            {[...filteredExpenses]
              .sort((a, b) => b.spentOn.localeCompare(a.spentOn))
              .map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[--border] hover:bg-[--surface-muted] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[--text]">
                        {formatRupiah(expense.amountIdr)}
                      </span>
                      <StatusBadge
                        label={EXPENSE_CATEGORY_LABELS[expense.category]}
                        variant="success"
                        size="sm"
                      />
                      {expense.weekNumber && (
                        <span className="text-xs text-[--text-muted]">Minggu {expense.weekNumber}</span>
                      )}
                    </div>
                    {expense.note && (
                      <p className="text-xs text-[--text-muted] mt-0.5 truncate">{expense.note}</p>
                    )}
                    <p className="text-xs text-[--text-muted]">{expense.spentOn}</p>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      className="p-2 rounded-lg hover:bg-[--border] text-[--text-muted] hover:text-[--text]"
                      aria-label="Hapus pengeluaran"
                      onClick={() => setDeletingId(expense.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!deletingId}
        title="Hapus pengeluaran ini?"
        description="Pengeluaran yang dihapus tidak dapat dikembalikan dan akan memengaruhi total aktual."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
