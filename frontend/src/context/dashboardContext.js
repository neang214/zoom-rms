import { create } from "zustand"
import clientApi from "../services/axios"

export const useDashboardStore = create((set, get) => {
  const runTracked = async (url, key, fallbackErr) => {
    set((s) => ({
      pendingCount: s.pendingCount + 1,
      isLoading: true,
      error: null,
    }))
    try {
      const res = await clientApi.get(url)
      set((s) => {
        const next = Math.max(0, s.pendingCount - 1)
        return { [key]: res.data, pendingCount: next, isLoading: next > 0 }
      })
      return res.data
    } catch (error) {
      set((s) => {
        const next = Math.max(0, s.pendingCount - 1)
        return {
          error: error.message || fallbackErr,
          pendingCount: next,
          isLoading: next > 0,
        }
      })
      throw error
    }
  }

  return {
    dailyRevenue: null,
    weeklyRevenue: null,
    monthlyRevenue: null,
    topSellingItems: [],
    peakHours: [],

    pendingCount: 0,
    isLoading: false,
    error: null,

    fetchDailyRevenue: () =>
      runTracked("/analytics/revenue/daily", "dailyRevenue", "Failed to fetch daily revenue"),

    fetchWeeklyRevenue: () =>
      runTracked("/analytics/revenue/weekly", "weeklyRevenue", "Failed to fetch weekly revenue"),

    fetchMonthlyRevenue: () =>
      runTracked("/analytics/revenue/monthly", "monthlyRevenue", "Failed to fetch monthly revenue"),

    fetchTopSelling: () =>
      runTracked("/analytics/menu/top-selling", "topSellingItems", "Failed to fetch top selling items"),

    fetchPeakHours: () =>
      runTracked("/analytics/orders/peak-hours", "peakHours", "Failed to fetch peak hours"),

    fetchAll: async () => {
      const s = get()
      await Promise.allSettled([
        s.fetchDailyRevenue(),
        s.fetchWeeklyRevenue(),
        s.fetchMonthlyRevenue(),
        s.fetchTopSelling(),
        s.fetchPeakHours(),
      ])
    },
  }
})
