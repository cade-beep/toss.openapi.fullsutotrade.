export interface RiskProfile {
  user_id: string;
  max_open_positions: number;
  max_position_size_value: number;
  max_order_value: number;
  max_symbol_exposure_pct: number;
  max_portfolio_exposure_pct: number;
  daily_loss_limit: number;
  kill_switch_active: boolean;
  max_trades_per_minute: number;
  min_ai_confidence: number;
  updated_at: string;
}
