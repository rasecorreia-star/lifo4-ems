"""
Arbitrage Detector
Detects arbitrage opportunities across markets, time periods, and products.
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ArbitrageType(Enum):
    """Types of arbitrage opportunities"""
    SPATIAL = "spatial"           # Between different locations/markets
    TEMPORAL = "temporal"         # Between different time periods
    PRODUCT = "product"           # Between different products
    CROSS_COMMODITY = "cross_commodity"  # Between electricity and related commodities


class RiskLevel(Enum):
    """Risk levels for arbitrage"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class ArbitrageOpportunity:
    """Represents an arbitrage opportunity"""
    id: str
    type: ArbitrageType
    buy_market: str
    sell_market: str
    buy_price: float
    sell_price: float
    spread: float
    spread_percent: float
    quantity_mwh: float
    expected_profit: float
    transaction_costs: float
    net_profit: float
    risk_level: RiskLevel
    confidence: float
    valid_from: datetime
    valid_until: datetime
    execution_window_minutes: int
    constraints: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'type': self.type.value,
            'buy_market': self.buy_market,
            'sell_market': self.sell_market,
            'buy_price': self.buy_price,
            'sell_price': self.sell_price,
            'spread': self.spread,
            'spread_percent': self.spread_percent,
            'quantity_mwh': self.quantity_mwh,
            'expected_profit': self.expected_profit,
            'transaction_costs': self.transaction_costs,
            'net_profit': self.net_profit,
            'risk_level': self.risk_level.value,
            'confidence': self.confidence,
            'valid_from': self.valid_from.isoformat(),
            'valid_until': self.valid_until.isoformat(),
            'execution_window_minutes': self.execution_window_minutes
        }


@dataclass
class MarketPrice:
    """Market price data point"""
    market: str
    price: float
    volume: float
    timestamp: datetime
    product: str = "conventional"


class ArbitrageDetector:
    """
    Detects and analyzes arbitrage opportunities in energy markets.
    """

    def __init__(
        self,
        min_spread_percent: float = 2.0,
        transaction_cost_percent: float = 0.5,
        min_profit_threshold: float = 100.0,
        max_position_mwh: float = 100.0
    ):
        self.min_spread_percent = min_spread_percent
        self.transaction_cost_percent = transaction_cost_percent
        self.min_profit_threshold = min_profit_threshold
        self.max_position_mwh = max_position_mwh

        self.opportunity_counter = 0
        self.detected_opportunities: List[ArbitrageOpportunity] = []
        self.execution_history: List[Dict[str, Any]] = []

    def detect_spatial_arbitrage(
        self,
        market_prices: List[MarketPrice]
    ) -> List[ArbitrageOpportunity]:
        """
        Detect spatial arbitrage between different markets/regions.
        """
        opportunities = []

        # Group by timestamp and product
        price_groups: Dict[str, List[MarketPrice]] = {}
        for mp in market_prices:
            key = f"{mp.timestamp.isoformat()}-{mp.product}"
            if key not in price_groups:
                price_groups[key] = []
            price_groups[key].append(mp)

        # Find price differences within each group
        for key, prices in price_groups.items():
            if len(prices) < 2:
                continue

            prices_sorted = sorted(prices, key=lambda x: x.price)

            for i, buy_price in enumerate(prices_sorted[:-1]):
                for sell_price in prices_sorted[i+1:]:
                    spread = sell_price.price - buy_price.price
                    spread_percent = (spread / buy_price.price) * 100

                    if spread_percent >= self.min_spread_percent:
                        opp = self._create_opportunity(
                            ArbitrageType.SPATIAL,
                            buy_price,
                            sell_price,
                            spread,
                            spread_percent
                        )
                        if opp.net_profit >= self.min_profit_threshold:
                            opportunities.append(opp)

        return opportunities

    def detect_temporal_arbitrage(
        self,
        price_history: List[MarketPrice],
        price_forecast: List[Tuple[datetime, float]],
        current_price: float
    ) -> List[ArbitrageOpportunity]:
        """
        Detect temporal arbitrage (buy now, sell later or vice versa).
        """
        opportunities = []

        if not price_forecast:
            return opportunities

        market = price_history[0].market if price_history else "unknown"

        for forecast_time, forecast_price in price_forecast:
            spread = forecast_price - current_price
            spread_percent = abs(spread / current_price) * 100

            if spread_percent >= self.min_spread_percent:
                hours_ahead = (forecast_time - datetime.now()).total_seconds() / 3600

                # Buy now, sell later (price going up)
                if spread > 0:
                    buy_mp = MarketPrice(market, current_price, 100, datetime.now())
                    sell_mp = MarketPrice(market, forecast_price, 100, forecast_time)
                # Sell now, buy later (price going down)
                else:
                    buy_mp = MarketPrice(market, forecast_price, 100, forecast_time)
                    sell_mp = MarketPrice(market, current_price, 100, datetime.now())

                opp = self._create_opportunity(
                    ArbitrageType.TEMPORAL,
                    buy_mp,
                    sell_mp,
                    abs(spread),
                    spread_percent
                )

                # Adjust confidence based on forecast horizon
                opp.confidence *= max(0.5, 1 - hours_ahead * 0.02)
                opp.metadata['hours_ahead'] = hours_ahead
                opp.metadata['direction'] = 'long' if spread > 0 else 'short'

                if opp.net_profit >= self.min_profit_threshold:
                    opportunities.append(opp)

        return opportunities

    def detect_product_arbitrage(
        self,
        conventional_prices: List[MarketPrice],
        renewable_prices: List[MarketPrice]
    ) -> List[ArbitrageOpportunity]:
        """
        Detect arbitrage between conventional and renewable products.
        (Including I-REC premiums)
        """
        opportunities = []

        # Match by timestamp and market
        for conv in conventional_prices:
            for renew in renewable_prices:
                if conv.market == renew.market and \
                   abs((conv.timestamp - renew.timestamp).total_seconds()) < 3600:

                    # Typically renewable has premium, but sometimes inverted
                    spread = conv.price - renew.price
                    spread_percent = abs(spread / min(conv.price, renew.price)) * 100

                    if spread_percent >= self.min_spread_percent:
                        if spread > 0:  # Conventional is more expensive
                            buy_mp = renew
                            sell_mp = conv
                        else:
                            buy_mp = conv
                            sell_mp = renew

                        opp = self._create_opportunity(
                            ArbitrageType.PRODUCT,
                            buy_mp,
                            sell_mp,
                            abs(spread),
                            spread_percent
                        )

                        opp.metadata['product_spread'] = 'conv_over_renew' if spread > 0 else 'renew_over_conv'

                        if opp.net_profit >= self.min_profit_threshold:
                            opportunities.append(opp)

        return opportunities

    def _create_opportunity(
        self,
        arb_type: ArbitrageType,
        buy_price: MarketPrice,
        sell_price: MarketPrice,
        spread: float,
        spread_percent: float
    ) -> ArbitrageOpportunity:
        """Create an arbitrage opportunity object"""
        self.opportunity_counter += 1

        # Calculate quantity (limited by volume and position limits)
        available_volume = min(buy_price.volume, sell_price.volume)
        quantity = min(available_volume, self.max_position_mwh)

        # Calculate profits
        gross_profit = quantity * spread
        transaction_costs = quantity * (buy_price.price + sell_price.price) * \
                           (self.transaction_cost_percent / 100) / 2
        net_profit = gross_profit - transaction_costs

        # Assess risk
        risk_level = self._assess_risk(arb_type, spread_percent, quantity)

        # Calculate confidence
        confidence = self._calculate_confidence(arb_type, spread_percent, available_volume)

        # Determine validity window
        if arb_type == ArbitrageType.SPATIAL:
            valid_minutes = 15
        elif arb_type == ArbitrageType.TEMPORAL:
            valid_minutes = 60
        else:
            valid_minutes = 30

        return ArbitrageOpportunity(
            id=f"ARB-{self.opportunity_counter:06d}",
            type=arb_type,
            buy_market=buy_price.market,
            sell_market=sell_price.market,
            buy_price=buy_price.price,
            sell_price=sell_price.price,
            spread=spread,
            spread_percent=spread_percent,
            quantity_mwh=quantity,
            expected_profit=gross_profit,
            transaction_costs=transaction_costs,
            net_profit=net_profit,
            risk_level=risk_level,
            confidence=confidence,
            valid_from=datetime.now(),
            valid_until=datetime.now() + timedelta(minutes=valid_minutes),
            execution_window_minutes=valid_minutes,
            constraints={
                'min_quantity': 1.0,
                'max_quantity': quantity,
                'requires_both_legs': True
            }
        )

    def _assess_risk(
        self,
        arb_type: ArbitrageType,
        spread_percent: float,
        quantity: float
    ) -> RiskLevel:
        """Assess risk level of arbitrage opportunity"""
        risk_score = 0

        # Type-based risk
        if arb_type == ArbitrageType.TEMPORAL:
            risk_score += 2  # Higher risk due to time component
        elif arb_type == ArbitrageType.PRODUCT:
            risk_score += 1

        # Spread-based risk (very high spreads might be errors)
        if spread_percent > 20:
            risk_score += 2
        elif spread_percent > 10:
            risk_score += 1

        # Size-based risk
        if quantity > self.max_position_mwh * 0.8:
            risk_score += 1

        if risk_score >= 4:
            return RiskLevel.HIGH
        elif risk_score >= 2:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _calculate_confidence(
        self,
        arb_type: ArbitrageType,
        spread_percent: float,
        volume: float
    ) -> float:
        """Calculate confidence score for opportunity"""
        confidence = 0.8

        # Type adjustment
        if arb_type == ArbitrageType.SPATIAL:
            confidence += 0.1  # Most reliable
        elif arb_type == ArbitrageType.TEMPORAL:
            confidence -= 0.2  # Depends on forecast

        # Spread sanity check
        if spread_percent > 30:
            confidence -= 0.3  # Might be data error

        # Volume adjustment
        if volume > 50:
            confidence += 0.05
        elif volume < 10:
            confidence -= 0.1

        return max(0.1, min(1.0, confidence))

    def scan_all_opportunities(
        self,
        market_prices: List[MarketPrice],
        price_forecast: Optional[List[Tuple[datetime, float]]] = None
    ) -> List[ArbitrageOpportunity]:
        """
        Comprehensive scan for all types of arbitrage opportunities.
        """
        all_opportunities = []

        # Spatial arbitrage
        spatial_opps = self.detect_spatial_arbitrage(market_prices)
        all_opportunities.extend(spatial_opps)

        # Temporal arbitrage (if forecast available)
        if price_forecast and market_prices:
            current_price = market_prices[-1].price
            temporal_opps = self.detect_temporal_arbitrage(
                market_prices, price_forecast, current_price
            )
            all_opportunities.extend(temporal_opps)

        # Product arbitrage
        conventional = [mp for mp in market_prices if mp.product == 'conventional']
        renewable = [mp for mp in market_prices if mp.product in ['renewable', 'incentivized']]
        if conventional and renewable:
            product_opps = self.detect_product_arbitrage(conventional, renewable)
            all_opportunities.extend(product_opps)

        # Sort by net profit
        all_opportunities.sort(key=lambda x: x.net_profit, reverse=True)

        # Store detected opportunities
        self.detected_opportunities = all_opportunities

        return all_opportunities

    def get_best_opportunity(
        self,
        risk_tolerance: RiskLevel = RiskLevel.MEDIUM
    ) -> Optional[ArbitrageOpportunity]:
        """Get the best opportunity within risk tolerance"""
        valid_opps = [
            opp for opp in self.detected_opportunities
            if opp.valid_until > datetime.now() and
               self._risk_within_tolerance(opp.risk_level, risk_tolerance)
        ]

        if not valid_opps:
            return None

        return valid_opps[0]  # Already sorted by profit

    def _risk_within_tolerance(
        self,
        risk: RiskLevel,
        tolerance: RiskLevel
    ) -> bool:
        """Check if risk is within tolerance"""
        risk_order = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2}
        return risk_order[risk] <= risk_order[tolerance]

    def record_execution(
        self,
        opportunity_id: str,
        executed: bool,
        actual_profit: Optional[float] = None,
        notes: str = ""
    ):
        """Record opportunity execution result"""
        self.execution_history.append({
            'opportunity_id': opportunity_id,
            'executed': executed,
            'actual_profit': actual_profit,
            'notes': notes,
            'timestamp': datetime.now().isoformat()
        })

    def get_statistics(self) -> Dict[str, Any]:
        """Get arbitrage detection statistics"""
        if not self.detected_opportunities:
            return {'message': 'No opportunities detected'}

        profits = [opp.net_profit for opp in self.detected_opportunities]
        spreads = [opp.spread_percent for opp in self.detected_opportunities]

        by_type = {}
        for opp in self.detected_opportunities:
            t = opp.type.value
            if t not in by_type:
                by_type[t] = {'count': 0, 'total_profit': 0}
            by_type[t]['count'] += 1
            by_type[t]['total_profit'] += opp.net_profit

        return {
            'total_opportunities': len(self.detected_opportunities),
            'total_potential_profit': sum(profits),
            'average_profit': np.mean(profits),
            'average_spread_percent': np.mean(spreads),
            'by_type': by_type,
            'executions': len(self.execution_history)
        }


# Global instance
arbitrage_detector = ArbitrageDetector()
