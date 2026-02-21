"""
Portfolio Optimizer
Optimizes energy trading portfolio using Modern Portfolio Theory
and BESS-specific constraints.
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# Optional scipy for optimization
try:
    from scipy.optimize import minimize, LinearConstraint
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("SciPy not installed. Using simplified optimization.")


class AssetClass(Enum):
    """Trading asset classes"""
    DAY_AHEAD = "day_ahead"
    INTRADAY = "intraday"
    ANCILLARY = "ancillary"
    CAPACITY = "capacity"
    BILATERAL = "bilateral"


class OptimizationObjective(Enum):
    """Portfolio optimization objectives"""
    MAX_RETURN = "max_return"
    MIN_RISK = "min_risk"
    MAX_SHARPE = "max_sharpe"
    TARGET_RETURN = "target_return"
    TARGET_RISK = "target_risk"


@dataclass
class Asset:
    """Trading asset definition"""
    id: str
    name: str
    asset_class: AssetClass
    expected_return: float  # Annual return
    volatility: float       # Annual volatility
    liquidity: float        # 0-1 scale
    min_position: float     # Minimum position in MWh
    max_position: float     # Maximum position in MWh
    transaction_cost: float # As percentage


@dataclass
class PortfolioAllocation:
    """Portfolio allocation result"""
    allocations: Dict[str, float]  # asset_id -> weight (0-1)
    positions_mwh: Dict[str, float]  # asset_id -> MWh
    expected_return: float
    expected_volatility: float
    sharpe_ratio: float
    var_95: float
    var_99: float
    diversification_ratio: float
    total_position_mwh: float
    transaction_costs: float
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'allocations': self.allocations,
            'positions_mwh': self.positions_mwh,
            'expected_return': self.expected_return,
            'expected_volatility': self.expected_volatility,
            'sharpe_ratio': self.sharpe_ratio,
            'var_95': self.var_95,
            'var_99': self.var_99,
            'diversification_ratio': self.diversification_ratio,
            'total_position_mwh': self.total_position_mwh,
            'transaction_costs': self.transaction_costs,
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class OptimizationConstraints:
    """Constraints for portfolio optimization"""
    max_total_position_mwh: float = 500.0
    min_diversification: float = 0.3  # Minimum # of assets
    max_single_asset_weight: float = 0.5
    max_volatility: float = 0.3
    target_return: Optional[float] = None
    target_risk: Optional[float] = None
    required_liquidity: float = 0.5


class PortfolioOptimizer:
    """
    Portfolio optimizer for energy trading.
    Uses Mean-Variance Optimization with BESS-specific constraints.
    """

    def __init__(
        self,
        risk_free_rate: float = 0.05,
        rebalance_threshold: float = 0.1
    ):
        self.risk_free_rate = risk_free_rate
        self.rebalance_threshold = rebalance_threshold
        self.assets: Dict[str, Asset] = {}
        self.correlation_matrix: Optional[np.ndarray] = None
        self.current_allocation: Optional[PortfolioAllocation] = None

    def add_asset(self, asset: Asset):
        """Add asset to universe"""
        self.assets[asset.id] = asset
        logger.info(f"Added asset: {asset.name}")

    def set_correlation_matrix(self, correlations: Dict[Tuple[str, str], float]):
        """
        Set correlation matrix from pairwise correlations.

        Args:
            correlations: Dict mapping (asset1_id, asset2_id) to correlation
        """
        n = len(self.assets)
        asset_ids = list(self.assets.keys())
        matrix = np.eye(n)

        for i, id1 in enumerate(asset_ids):
            for j, id2 in enumerate(asset_ids):
                if i != j:
                    corr = correlations.get((id1, id2), correlations.get((id2, id1), 0.3))
                    matrix[i, j] = corr
                    matrix[j, i] = corr

        self.correlation_matrix = matrix

    def optimize(
        self,
        objective: OptimizationObjective = OptimizationObjective.MAX_SHARPE,
        constraints: Optional[OptimizationConstraints] = None
    ) -> PortfolioAllocation:
        """
        Optimize portfolio allocation.

        Args:
            objective: Optimization objective
            constraints: Portfolio constraints

        Returns:
            Optimal portfolio allocation
        """
        if not self.assets:
            raise ValueError("No assets in portfolio")

        constraints = constraints or OptimizationConstraints()

        # Use scipy if available, otherwise simplified optimization
        if SCIPY_AVAILABLE:
            return self._optimize_scipy(objective, constraints)
        else:
            return self._optimize_simple(objective, constraints)

    def _optimize_scipy(
        self,
        objective: OptimizationObjective,
        constraints: OptimizationConstraints
    ) -> PortfolioAllocation:
        """Optimize using scipy"""
        asset_ids = list(self.assets.keys())
        n = len(asset_ids)

        # Expected returns and volatilities
        returns = np.array([self.assets[id].expected_return for id in asset_ids])
        vols = np.array([self.assets[id].volatility for id in asset_ids])

        # Covariance matrix
        if self.correlation_matrix is None:
            # Default correlation of 0.3
            corr = np.full((n, n), 0.3)
            np.fill_diagonal(corr, 1.0)
        else:
            corr = self.correlation_matrix

        cov = np.outer(vols, vols) * corr

        # Initial weights
        x0 = np.ones(n) / n

        # Bounds (0 to max_single_asset_weight)
        bounds = [(0, constraints.max_single_asset_weight) for _ in range(n)]

        # Constraints
        scipy_constraints = [
            {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}  # Weights sum to 1
        ]

        # Objective function
        if objective == OptimizationObjective.MAX_SHARPE:
            def neg_sharpe(weights):
                ret = np.dot(weights, returns)
                vol = np.sqrt(np.dot(weights, np.dot(cov, weights)))
                return -(ret - self.risk_free_rate) / (vol + 1e-8)
            obj_func = neg_sharpe

        elif objective == OptimizationObjective.MIN_RISK:
            def portfolio_vol(weights):
                return np.sqrt(np.dot(weights, np.dot(cov, weights)))
            obj_func = portfolio_vol

        elif objective == OptimizationObjective.MAX_RETURN:
            def neg_return(weights):
                return -np.dot(weights, returns)
            obj_func = neg_return

        elif objective == OptimizationObjective.TARGET_RETURN:
            if constraints.target_return is None:
                raise ValueError("Target return must be specified")
            scipy_constraints.append({
                'type': 'ineq',
                'fun': lambda x: np.dot(x, returns) - constraints.target_return
            })
            def portfolio_vol(weights):
                return np.sqrt(np.dot(weights, np.dot(cov, weights)))
            obj_func = portfolio_vol

        else:  # TARGET_RISK
            if constraints.target_risk is None:
                raise ValueError("Target risk must be specified")
            scipy_constraints.append({
                'type': 'ineq',
                'fun': lambda x: constraints.target_risk - np.sqrt(np.dot(x, np.dot(cov, x)))
            })
            def neg_return(weights):
                return -np.dot(weights, returns)
            obj_func = neg_return

        # Optimize
        result = minimize(
            obj_func,
            x0,
            method='SLSQP',
            bounds=bounds,
            constraints=scipy_constraints,
            options={'maxiter': 1000}
        )

        if not result.success:
            logger.warning(f"Optimization may not have converged: {result.message}")

        weights = result.x
        weights = np.maximum(weights, 0)  # Ensure non-negative
        weights = weights / weights.sum()  # Normalize

        return self._create_allocation(weights, asset_ids, returns, cov, constraints)

    def _optimize_simple(
        self,
        objective: OptimizationObjective,
        constraints: OptimizationConstraints
    ) -> PortfolioAllocation:
        """Simplified optimization without scipy"""
        asset_ids = list(self.assets.keys())
        n = len(asset_ids)

        returns = np.array([self.assets[id].expected_return for id in asset_ids])
        vols = np.array([self.assets[id].volatility for id in asset_ids])

        # Simple heuristic allocation
        if objective == OptimizationObjective.MAX_RETURN:
            # Weight by returns
            weights = returns / returns.sum()
        elif objective == OptimizationObjective.MIN_RISK:
            # Inverse volatility weighting
            inv_vols = 1 / (vols + 0.01)
            weights = inv_vols / inv_vols.sum()
        else:
            # Risk-adjusted return (simple Sharpe-like)
            sharpe_like = (returns - self.risk_free_rate) / (vols + 0.01)
            sharpe_like = np.maximum(sharpe_like, 0)
            if sharpe_like.sum() > 0:
                weights = sharpe_like / sharpe_like.sum()
            else:
                weights = np.ones(n) / n

        # Apply max weight constraint
        weights = np.minimum(weights, constraints.max_single_asset_weight)
        weights = weights / weights.sum()

        # Estimate covariance (simple)
        cov = np.outer(vols, vols) * 0.3
        np.fill_diagonal(cov, vols ** 2)

        return self._create_allocation(weights, asset_ids, returns, cov, constraints)

    def _create_allocation(
        self,
        weights: np.ndarray,
        asset_ids: List[str],
        returns: np.ndarray,
        cov: np.ndarray,
        constraints: OptimizationConstraints
    ) -> PortfolioAllocation:
        """Create allocation result from optimized weights"""
        # Portfolio metrics
        portfolio_return = np.dot(weights, returns)
        portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov, weights)))
        sharpe = (portfolio_return - self.risk_free_rate) / (portfolio_vol + 1e-8)

        # VaR calculations (assuming normal distribution)
        var_95 = portfolio_vol * 1.645
        var_99 = portfolio_vol * 2.326

        # Diversification ratio
        weighted_vols = np.sum(weights * np.sqrt(np.diag(cov)))
        div_ratio = weighted_vols / (portfolio_vol + 1e-8)

        # Calculate positions in MWh
        allocations = {asset_ids[i]: float(weights[i]) for i in range(len(weights))}

        positions_mwh = {}
        total_position = 0
        for asset_id, weight in allocations.items():
            position = weight * constraints.max_total_position_mwh
            # Apply asset-specific limits
            asset = self.assets[asset_id]
            position = max(asset.min_position, min(position, asset.max_position))
            positions_mwh[asset_id] = position
            total_position += position

        # Transaction costs
        total_costs = sum(
            positions_mwh[id] * self.assets[id].transaction_cost / 100
            for id in asset_ids
        )

        allocation = PortfolioAllocation(
            allocations=allocations,
            positions_mwh=positions_mwh,
            expected_return=float(portfolio_return),
            expected_volatility=float(portfolio_vol),
            sharpe_ratio=float(sharpe),
            var_95=float(var_95),
            var_99=float(var_99),
            diversification_ratio=float(div_ratio),
            total_position_mwh=total_position,
            transaction_costs=total_costs
        )

        self.current_allocation = allocation
        return allocation

    def rebalance_check(
        self,
        current_positions: Dict[str, float]
    ) -> Tuple[bool, Dict[str, float]]:
        """
        Check if rebalancing is needed.

        Args:
            current_positions: Current positions by asset_id

        Returns:
            Tuple of (needs_rebalance, suggested_trades)
        """
        if self.current_allocation is None:
            return True, {}

        target = self.current_allocation.positions_mwh
        trades = {}
        max_drift = 0

        for asset_id in self.assets:
            current = current_positions.get(asset_id, 0)
            target_pos = target.get(asset_id, 0)

            if target_pos > 0:
                drift = abs(current - target_pos) / target_pos
                max_drift = max(max_drift, drift)

            trade = target_pos - current
            if abs(trade) > self.assets[asset_id].min_position:
                trades[asset_id] = trade

        needs_rebalance = max_drift > self.rebalance_threshold
        return needs_rebalance, trades

    def efficient_frontier(
        self,
        n_points: int = 20,
        constraints: Optional[OptimizationConstraints] = None
    ) -> List[Dict[str, float]]:
        """
        Calculate efficient frontier.

        Returns list of (return, volatility, sharpe) points.
        """
        constraints = constraints or OptimizationConstraints()

        # Get range of returns
        returns = [self.assets[id].expected_return for id in self.assets]
        min_ret = min(returns)
        max_ret = max(returns)

        frontier = []

        for target_return in np.linspace(min_ret, max_ret, n_points):
            constraints.target_return = target_return
            try:
                allocation = self.optimize(
                    OptimizationObjective.TARGET_RETURN,
                    constraints
                )
                frontier.append({
                    'return': allocation.expected_return,
                    'volatility': allocation.expected_volatility,
                    'sharpe': allocation.sharpe_ratio
                })
            except Exception:
                continue

        return frontier

    def risk_contribution(self) -> Dict[str, float]:
        """Calculate risk contribution by asset"""
        if self.current_allocation is None:
            return {}

        asset_ids = list(self.assets.keys())
        weights = np.array([self.current_allocation.allocations.get(id, 0) for id in asset_ids])
        vols = np.array([self.assets[id].volatility for id in asset_ids])

        if self.correlation_matrix is None:
            cov = np.outer(vols, vols) * 0.3
            np.fill_diagonal(cov, vols ** 2)
        else:
            cov = np.outer(vols, vols) * self.correlation_matrix

        # Marginal contribution
        portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov, weights)))
        mcr = np.dot(cov, weights) / (portfolio_vol + 1e-8)

        # Component contribution
        ccr = weights * mcr

        # Percentage contribution
        pcr = ccr / (np.sum(ccr) + 1e-8)

        return {asset_ids[i]: float(pcr[i]) for i in range(len(asset_ids))}

    def stress_test(
        self,
        scenarios: Dict[str, Dict[str, float]]
    ) -> Dict[str, Dict[str, float]]:
        """
        Run stress tests on portfolio.

        Args:
            scenarios: Dict mapping scenario_name to Dict of (asset_id -> return_shock)

        Returns:
            Dict mapping scenario_name to portfolio impact metrics
        """
        if self.current_allocation is None:
            return {}

        results = {}

        for scenario_name, shocks in scenarios.items():
            portfolio_loss = 0
            for asset_id, position in self.current_allocation.positions_mwh.items():
                shock = shocks.get(asset_id, 0)
                loss = position * shock
                portfolio_loss += loss

            results[scenario_name] = {
                'portfolio_loss': portfolio_loss,
                'loss_percent': portfolio_loss / self.current_allocation.total_position_mwh * 100
                    if self.current_allocation.total_position_mwh > 0 else 0
            }

        return results


# Factory function
def create_default_portfolio() -> PortfolioOptimizer:
    """Create portfolio optimizer with default energy assets"""
    optimizer = PortfolioOptimizer()

    # Add typical energy trading assets
    assets = [
        Asset("da_seco", "Day-Ahead SE/CO", AssetClass.DAY_AHEAD,
              0.15, 0.25, 0.9, 5, 200, 0.1),
        Asset("da_sul", "Day-Ahead Sul", AssetClass.DAY_AHEAD,
              0.12, 0.22, 0.8, 5, 150, 0.1),
        Asset("id_seco", "Intraday SE/CO", AssetClass.INTRADAY,
              0.18, 0.35, 0.7, 1, 100, 0.15),
        Asset("anc_freq", "Ancillary - Frequency", AssetClass.ANCILLARY,
              0.25, 0.40, 0.5, 10, 50, 0.2),
        Asset("cap_mkt", "Capacity Market", AssetClass.CAPACITY,
              0.08, 0.10, 0.4, 50, 500, 0.05),
    ]

    for asset in assets:
        optimizer.add_asset(asset)

    # Set correlations
    correlations = {
        ("da_seco", "da_sul"): 0.8,
        ("da_seco", "id_seco"): 0.6,
        ("da_seco", "anc_freq"): 0.3,
        ("da_seco", "cap_mkt"): 0.2,
        ("da_sul", "id_seco"): 0.5,
        ("da_sul", "anc_freq"): 0.25,
        ("da_sul", "cap_mkt"): 0.15,
        ("id_seco", "anc_freq"): 0.4,
        ("id_seco", "cap_mkt"): 0.1,
        ("anc_freq", "cap_mkt"): 0.1,
    }
    optimizer.set_correlation_matrix(correlations)

    return optimizer


# Global instance
portfolio_optimizer = create_default_portfolio()
