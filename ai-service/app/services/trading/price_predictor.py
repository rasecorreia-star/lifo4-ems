"""
Price Predictor
Deep learning model for energy price forecasting.
Uses LSTM/Transformer architecture for time series prediction.
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from enum import Enum

logger = logging.getLogger(__name__)

# Optional deep learning imports
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not installed. Using statistical fallback.")


class PredictionHorizon(Enum):
    """Prediction time horizons"""
    HOUR_1 = 1
    HOUR_4 = 4
    HOUR_24 = 24
    HOUR_48 = 48
    WEEK = 168


@dataclass
class PricePrediction:
    """Price prediction result"""
    timestamp: datetime
    horizon_hours: int
    predicted_price: float
    confidence_low: float
    confidence_high: float
    confidence_level: float
    trend: str  # 'up', 'down', 'stable'
    volatility: float
    features_importance: Dict[str, float]
    model_version: str


@dataclass
class PriceFeatures:
    """Features for price prediction"""
    price_history: List[float]
    load_history: List[float]
    solar_history: List[float]
    wind_history: List[float]
    temperature_history: List[float]
    hour_of_day: int
    day_of_week: int
    month: int
    is_holiday: bool
    is_weekend: bool


# LSTM Model for Price Prediction
if TORCH_AVAILABLE:
    class PriceLSTM(nn.Module):
        """LSTM model for price prediction"""

        def __init__(
            self,
            input_size: int = 10,
            hidden_size: int = 64,
            num_layers: int = 2,
            output_size: int = 24,
            dropout: float = 0.2
        ):
            super().__init__()

            self.hidden_size = hidden_size
            self.num_layers = num_layers

            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                dropout=dropout if num_layers > 1 else 0
            )

            self.fc = nn.Sequential(
                nn.Linear(hidden_size, hidden_size // 2),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_size // 2, output_size)
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # x shape: (batch, seq_len, input_size)
            lstm_out, _ = self.lstm(x)
            # Take last output
            last_out = lstm_out[:, -1, :]
            return self.fc(last_out)


    class PriceTransformer(nn.Module):
        """Transformer model for price prediction"""

        def __init__(
            self,
            input_size: int = 10,
            d_model: int = 64,
            nhead: int = 4,
            num_encoder_layers: int = 2,
            output_size: int = 24,
            dropout: float = 0.1
        ):
            super().__init__()

            self.input_projection = nn.Linear(input_size, d_model)

            encoder_layer = nn.TransformerEncoderLayer(
                d_model=d_model,
                nhead=nhead,
                dim_feedforward=d_model * 4,
                dropout=dropout,
                batch_first=True
            )

            self.transformer_encoder = nn.TransformerEncoder(
                encoder_layer,
                num_layers=num_encoder_layers
            )

            self.fc = nn.Sequential(
                nn.Linear(d_model, d_model // 2),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(d_model // 2, output_size)
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # x shape: (batch, seq_len, input_size)
            x = self.input_projection(x)
            x = self.transformer_encoder(x)
            # Global average pooling
            x = x.mean(dim=1)
            return self.fc(x)


class PricePredictor:
    """
    Price prediction service using deep learning.
    Supports multiple prediction horizons and provides confidence intervals.
    """

    def __init__(
        self,
        model_type: str = 'lstm',
        sequence_length: int = 168,  # 1 week of hourly data
        prediction_horizon: int = 24
    ):
        self.model_type = model_type
        self.sequence_length = sequence_length
        self.prediction_horizon = prediction_horizon
        self.model = None
        self.scaler_mean = None
        self.scaler_std = None
        self.is_loaded = False
        self.model_version = "1.0.0"

        # Historical predictions for calibration
        self.prediction_history: List[Tuple[PricePrediction, float]] = []

    async def load_model(self, model_path: Optional[str] = None):
        """Load or initialize model"""
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available, using statistical model")
            self.is_loaded = True
            return

        try:
            if model_path and os.path.exists(model_path):
                checkpoint = torch.load(model_path)
                self._build_model()
                self.model.load_state_dict(checkpoint['model_state_dict'])
                self.scaler_mean = checkpoint.get('scaler_mean')
                self.scaler_std = checkpoint.get('scaler_std')
            else:
                self._build_model()

            self.model.eval()
            self.is_loaded = True
            logger.info(f"Price predictor loaded ({self.model_type})")

        except Exception as e:
            logger.error(f"Failed to load price predictor: {e}")
            self.is_loaded = True  # Use fallback

    def _build_model(self):
        """Build neural network model"""
        if not TORCH_AVAILABLE:
            return

        if self.model_type == 'lstm':
            self.model = PriceLSTM(
                input_size=10,
                hidden_size=64,
                num_layers=2,
                output_size=self.prediction_horizon
            )
        else:
            self.model = PriceTransformer(
                input_size=10,
                d_model=64,
                nhead=4,
                num_encoder_layers=2,
                output_size=self.prediction_horizon
            )

    def predict(
        self,
        features: PriceFeatures,
        horizon: PredictionHorizon = PredictionHorizon.HOUR_24
    ) -> List[PricePrediction]:
        """
        Predict future prices.

        Args:
            features: Input features for prediction
            horizon: Prediction horizon

        Returns:
            List of PricePrediction objects
        """
        if TORCH_AVAILABLE and self.model is not None:
            return self._predict_neural(features, horizon)
        else:
            return self._predict_statistical(features, horizon)

    def _predict_neural(
        self,
        features: PriceFeatures,
        horizon: PredictionHorizon
    ) -> List[PricePrediction]:
        """Neural network prediction"""
        predictions = []

        # Prepare input tensor
        input_data = self._prepare_input(features)

        with torch.no_grad():
            # Get point predictions
            output = self.model(input_data)
            predicted_prices = output.squeeze().numpy()

        # Generate predictions with confidence intervals
        base_time = datetime.now()

        for i, price in enumerate(predicted_prices[:horizon.value]):
            # Estimate confidence based on horizon
            confidence_decay = 1 - (i / horizon.value) * 0.3
            std_estimate = abs(price) * 0.05 * (1 + i * 0.02)

            trend = self._calculate_trend(predicted_prices, i)
            volatility = self._calculate_volatility(features.price_history)

            predictions.append(PricePrediction(
                timestamp=base_time + timedelta(hours=i+1),
                horizon_hours=i + 1,
                predicted_price=float(price),
                confidence_low=float(price - 1.96 * std_estimate),
                confidence_high=float(price + 1.96 * std_estimate),
                confidence_level=confidence_decay,
                trend=trend,
                volatility=volatility,
                features_importance=self._get_feature_importance(),
                model_version=self.model_version
            ))

        return predictions

    def _predict_statistical(
        self,
        features: PriceFeatures,
        horizon: PredictionHorizon
    ) -> List[PricePrediction]:
        """Statistical fallback prediction using exponential smoothing"""
        predictions = []
        prices = features.price_history[-168:]  # Last week

        if len(prices) < 24:
            # Not enough data, return simple forecast
            last_price = prices[-1] if prices else 150
            for i in range(horizon.value):
                predictions.append(PricePrediction(
                    timestamp=datetime.now() + timedelta(hours=i+1),
                    horizon_hours=i + 1,
                    predicted_price=last_price,
                    confidence_low=last_price * 0.9,
                    confidence_high=last_price * 1.1,
                    confidence_level=0.5,
                    trend='stable',
                    volatility=0.1,
                    features_importance={},
                    model_version='statistical'
                ))
            return predictions

        # Calculate components
        hourly_pattern = self._calculate_hourly_pattern(prices)
        daily_pattern = self._calculate_daily_pattern(prices)
        trend = self._calculate_linear_trend(prices)
        volatility = self._calculate_volatility(prices)

        base_time = datetime.now()
        current_hour = base_time.hour

        for i in range(horizon.value):
            future_hour = (current_hour + i + 1) % 24

            # Combine patterns
            base_price = prices[-1]
            hourly_effect = hourly_pattern[future_hour] - hourly_pattern[current_hour]
            trend_effect = trend * (i + 1)

            predicted = base_price + hourly_effect + trend_effect
            predicted = max(0, predicted)  # Price can't be negative

            # Add noise for realistic confidence intervals
            std_estimate = volatility * base_price * (1 + i * 0.05)

            trend_str = 'up' if trend > 0.5 else 'down' if trend < -0.5 else 'stable'

            predictions.append(PricePrediction(
                timestamp=base_time + timedelta(hours=i+1),
                horizon_hours=i + 1,
                predicted_price=float(predicted),
                confidence_low=float(predicted - 1.96 * std_estimate),
                confidence_high=float(predicted + 1.96 * std_estimate),
                confidence_level=max(0.3, 0.9 - i * 0.02),
                trend=trend_str,
                volatility=float(volatility),
                features_importance={
                    'price_history': 0.4,
                    'hourly_pattern': 0.3,
                    'trend': 0.2,
                    'other': 0.1
                },
                model_version='statistical'
            ))

        return predictions

    def _prepare_input(self, features: PriceFeatures) -> 'torch.Tensor':
        """Prepare input tensor from features"""
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch not available")

        # Pad or truncate to sequence length
        def pad_sequence(seq: List[float], length: int) -> List[float]:
            if len(seq) >= length:
                return seq[-length:]
            return [seq[0]] * (length - len(seq)) + seq

        price_seq = pad_sequence(features.price_history, self.sequence_length)
        load_seq = pad_sequence(features.load_history, self.sequence_length)
        solar_seq = pad_sequence(features.solar_history, self.sequence_length)
        wind_seq = pad_sequence(features.wind_history, self.sequence_length)
        temp_seq = pad_sequence(features.temperature_history, self.sequence_length)

        # Create feature matrix
        data = np.array([
            price_seq,
            load_seq,
            solar_seq,
            wind_seq,
            temp_seq,
            [features.hour_of_day] * self.sequence_length,
            [features.day_of_week] * self.sequence_length,
            [features.month] * self.sequence_length,
            [float(features.is_holiday)] * self.sequence_length,
            [float(features.is_weekend)] * self.sequence_length
        ]).T

        # Normalize
        if self.scaler_mean is not None:
            data = (data - self.scaler_mean) / (self.scaler_std + 1e-8)

        return torch.FloatTensor(data).unsqueeze(0)

    def _calculate_trend(self, prices: np.ndarray, position: int) -> str:
        """Calculate trend direction"""
        if position < 3:
            return 'stable'

        recent = prices[max(0, position-3):position+1]
        if len(recent) < 2:
            return 'stable'

        slope = (recent[-1] - recent[0]) / len(recent)
        if slope > 1:
            return 'up'
        elif slope < -1:
            return 'down'
        return 'stable'

    def _calculate_volatility(self, prices: List[float]) -> float:
        """Calculate price volatility"""
        if len(prices) < 2:
            return 0.1

        returns = [(prices[i] - prices[i-1]) / prices[i-1]
                   for i in range(1, len(prices)) if prices[i-1] != 0]

        if not returns:
            return 0.1

        return float(np.std(returns))

    def _calculate_hourly_pattern(self, prices: List[float]) -> List[float]:
        """Calculate average hourly pattern"""
        hourly_prices = [[] for _ in range(24)]

        for i, price in enumerate(prices):
            hour = i % 24
            hourly_prices[hour].append(price)

        pattern = []
        for hour_prices in hourly_prices:
            if hour_prices:
                pattern.append(np.mean(hour_prices))
            else:
                pattern.append(np.mean(prices) if prices else 150)

        return pattern

    def _calculate_daily_pattern(self, prices: List[float]) -> List[float]:
        """Calculate average daily pattern"""
        daily_prices = [[] for _ in range(7)]

        for i, price in enumerate(prices):
            day = (i // 24) % 7
            daily_prices[day].append(price)

        pattern = []
        for day_prices in daily_prices:
            if day_prices:
                pattern.append(np.mean(day_prices))
            else:
                pattern.append(np.mean(prices) if prices else 150)

        return pattern

    def _calculate_linear_trend(self, prices: List[float]) -> float:
        """Calculate linear trend slope"""
        if len(prices) < 2:
            return 0.0

        x = np.arange(len(prices))
        coeffs = np.polyfit(x, prices, 1)
        return float(coeffs[0])

    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance (placeholder for interpretability)"""
        return {
            'price_history': 0.35,
            'load': 0.20,
            'solar': 0.15,
            'hour_of_day': 0.12,
            'temperature': 0.08,
            'day_of_week': 0.05,
            'wind': 0.03,
            'other': 0.02
        }

    def update_calibration(self, prediction: PricePrediction, actual_price: float):
        """Update model calibration with actual results"""
        self.prediction_history.append((prediction, actual_price))

        # Keep last 1000 predictions
        if len(self.prediction_history) > 1000:
            self.prediction_history = self.prediction_history[-1000:]

        # Could trigger retraining or calibration adjustment here
        logger.debug(f"Calibration updated: predicted={prediction.predicted_price:.2f}, actual={actual_price:.2f}")

    def get_accuracy_metrics(self) -> Dict[str, float]:
        """Calculate prediction accuracy metrics"""
        if len(self.prediction_history) < 10:
            return {'message': 'Insufficient data for metrics'}

        errors = []
        for pred, actual in self.prediction_history:
            error = (pred.predicted_price - actual) / actual if actual != 0 else 0
            errors.append(error)

        errors = np.array(errors)

        return {
            'mae': float(np.mean(np.abs(errors))),
            'rmse': float(np.sqrt(np.mean(errors ** 2))),
            'mape': float(np.mean(np.abs(errors)) * 100),
            'bias': float(np.mean(errors)),
            'samples': len(self.prediction_history)
        }


# Global instance
price_predictor = PricePredictor()
