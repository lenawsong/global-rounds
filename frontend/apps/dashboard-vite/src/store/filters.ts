import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GlobalFilters = {
  dateRange?: [string, string];
  payer?: string | null;
  deviceCategory?: string | null;
};

type FilterState = {
  filters: GlobalFilters;
  setFilters: (updater: (prev: GlobalFilters) => GlobalFilters) => void;
  reset: () => void;
};

const defaultFilters: GlobalFilters = {
  dateRange: undefined,
  payer: null,
  deviceCategory: null
};

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      filters: defaultFilters,
      setFilters: (updater) =>
        set((state) => ({
          filters: updater(state.filters)
        })),
      reset: () =>
        set(() => ({
          filters: defaultFilters
        }))
    }),
    {
      name: 'nh-dashboard-filters'
    }
  )
);
