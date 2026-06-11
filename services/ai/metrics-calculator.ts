export interface BacktestTrade {
  date: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  totalValue: number;
  pnl?: number; // realized PnL
}

export interface CalculatedMetrics {
  totalReturn: number; // percentage (e.g. 15.5 for 15.5%)
  cagr: number;        // ratio (e.g. 0.12 for 12% CAGR)
  winRate: number;     // ratio (e.g. 0.55 for 55%)
  profitFactor: number; // ratio (e.g. 1.8)
  maxDrawdown: number; // ratio (e.g. 0.08 for 8%)
  sharpeRatio: number; // ratio (e.g. 1.5)
  totalTrades: number;
}

export class BacktestMetricsCalculator {
  static calculate(
    equityCurve: { date: string; value: number }[],
    trades: BacktestTrade[],
    initialCapital: number
  ): CalculatedMetrics {
    const totalTrades = trades.length;
    if (equityCurve.length === 0) {
      return { totalReturn: 0, cagr: 0, winRate: 0, profitFactor: 0, maxDrawdown: 0, sharpeRatio: 0, totalTrades: 0 };
    }

    const finalValue = equityCurve[equityCurve.length - 1].value;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    // 1. CAGR Calculation
    const startDate = new Date(equityCurve[0].date);
    const endDate = new Date(equityCurve[equityCurve.length - 1].date);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.max(1, durationMs / (1000 * 60 * 60 * 24));
    const years = durationDays / 365.25;
    const cagr = years > 0 ? Math.pow(finalValue / initialCapital, 1 / years) - 1 : 0;

    // 2. Win Rate & Profit Factor Calculation
    // Extract realized trades by matching BUYs and SELLs
    const completedPnLs: number[] = [];
    const openBuyExecutions: { qty: number; price: number }[] = [];

    // Simple FIFO Matching to find realized trade PnL
    for (const t of trades) {
      if (t.side === 'BUY') {
        openBuyExecutions.push({ qty: t.qty, price: t.price });
      } else {
        let remainingQtyToSell = t.qty;
        let totalCostBasis = 0;
        let matchedQty = 0;

        while (remainingQtyToSell > 0 && openBuyExecutions.length > 0) {
          const buy = openBuyExecutions[0];
          const qtyMatched = Math.min(buy.qty, remainingQtyToSell);
          
          totalCostBasis += qtyMatched * buy.price;
          matchedQty += qtyMatched;
          buy.qty -= qtyMatched;
          remainingQtyToSell -= qtyMatched;

          if (buy.qty <= 0) {
            openBuyExecutions.shift();
          }
        }

        if (matchedQty > 0) {
          const salesRevenue = matchedQty * t.price;
          const pnl = salesRevenue - totalCostBasis;
          completedPnLs.push(pnl);
          t.pnl = pnl; // record realized PnL
        }
      }
    }

    const winningTrades = completedPnLs.filter(pnl => pnl > 0);
    const losingTrades = completedPnLs.filter(pnl => pnl < 0);

    const winRate = completedPnLs.length > 0 ? winningTrades.length / completedPnLs.length : 0;

    const grossProfit = winningTrades.reduce((sum, p) => sum + p, 0);
    const grossLoss = losingTrades.reduce((sum, l) => sum + Math.abs(l), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 1.0);

    // 3. Max Drawdown Calculation
    let peak = initialCapital;
    let maxDrawdown = 0;

    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      }
      const dd = peak > 0 ? (peak - point.value) / peak : 0;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
    }

    // 4. Annualized Sharpe Ratio Calculation
    // Daily Returns: R_t = (Eq_t - Eq_{t-1}) / Eq_{t-1}
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].value;
      const curr = equityCurve[i].value;
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev);
      }
    }

    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
      const averageDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - averageDailyReturn, 2), 0) / (dailyReturns.length - 1);
      const stdDevDailyReturn = Math.sqrt(variance);

      // Assume annual risk free rate is 2% (0.02), which is approx 0.02 / 252 daily
      const dailyRf = 0.02 / 252;

      if (stdDevDailyReturn > 0) {
        // Annualize by multiplying by sqrt(252)
        sharpeRatio = ((averageDailyReturn - dailyRf) / stdDevDailyReturn) * Math.sqrt(252);
      }
    }

    return {
      totalReturn,
      cagr: isNaN(cagr) ? 0 : cagr,
      winRate,
      profitFactor: isNaN(profitFactor) ? 0 : profitFactor,
      maxDrawdown,
      sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
      totalTrades
    };
  }
}
