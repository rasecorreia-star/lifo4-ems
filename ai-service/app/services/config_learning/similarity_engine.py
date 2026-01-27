"""
Similarity Engine
Finds similar devices and transfers configurations between them.
"""

import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)


@dataclass
class DeviceProfile:
    """Profile of a BESS device"""
    device_id: str
    device_type: str  # LiFePO4, NMC, LTO, etc.
    manufacturer: str
    model: str
    capacity_kwh: float
    power_kw: float
    voltage_nominal: float
    cells_in_series: int
    cells_in_parallel: int
    modules_count: int
    installation_date: datetime
    climate_zone: str  # tropical, temperate, arid, etc.
    application: str  # grid, commercial, industrial, residential
    features: List[str] = field(default_factory=list)  # liquid_cooling, active_balancing, etc.


@dataclass
class SimilarDevice:
    """Similar device with similarity score"""
    device: DeviceProfile
    similarity_score: float
    matching_factors: Dict[str, float]
    recommended_configs: List[str] = field(default_factory=list)


class SimilarityEngine:
    """
    Finds similar BESS devices for configuration transfer.

    Uses multi-factor similarity matching:
    - Chemistry/type matching
    - Capacity and power ratings
    - Environmental conditions
    - Application type
    - Hardware features
    """

    def __init__(self):
        self.devices: Dict[str, DeviceProfile] = {}

        # Feature weights for similarity calculation
        self.weights = {
            'device_type': 0.25,
            'manufacturer': 0.10,
            'capacity': 0.15,
            'power': 0.10,
            'voltage': 0.10,
            'cell_config': 0.10,
            'climate': 0.10,
            'application': 0.05,
            'features': 0.05
        }

        # Device type compatibility matrix
        self.type_compatibility = {
            ('LiFePO4', 'LiFePO4'): 1.0,
            ('LiFePO4', 'LFP'): 1.0,
            ('NMC', 'NMC'): 1.0,
            ('NMC', 'NCM'): 1.0,
            ('LTO', 'LTO'): 1.0,
            ('LiFePO4', 'NMC'): 0.6,
            ('LiFePO4', 'LTO'): 0.5,
            ('NMC', 'LTO'): 0.5,
        }

    def register_device(self, profile: DeviceProfile) -> bool:
        """Register a device profile"""
        self.devices[profile.device_id] = profile
        logger.info(f"Registered device: {profile.device_id}")
        return True

    def update_device(self, device_id: str, updates: Dict[str, Any]) -> bool:
        """Update device profile"""
        if device_id not in self.devices:
            return False

        device = self.devices[device_id]
        for key, value in updates.items():
            if hasattr(device, key):
                setattr(device, key, value)

        return True

    def find_similar(
        self,
        target: DeviceProfile,
        limit: int = 10,
        min_similarity: float = 0.5
    ) -> List[SimilarDevice]:
        """
        Find devices similar to the target.

        Args:
            target: Target device to match
            limit: Maximum number of results
            min_similarity: Minimum similarity threshold

        Returns:
            List of similar devices with scores
        """
        results = []

        for device_id, device in self.devices.items():
            if device_id == target.device_id:
                continue

            similarity, factors = self._calculate_similarity(target, device)

            if similarity >= min_similarity:
                results.append(SimilarDevice(
                    device=device,
                    similarity_score=similarity,
                    matching_factors=factors
                ))

        # Sort by similarity
        results.sort(key=lambda x: x.similarity_score, reverse=True)

        return results[:limit]

    def _calculate_similarity(
        self,
        target: DeviceProfile,
        candidate: DeviceProfile
    ) -> Tuple[float, Dict[str, float]]:
        """Calculate similarity between two devices"""
        factors = {}

        # Device type similarity
        type_key = (target.device_type, candidate.device_type)
        reverse_key = (candidate.device_type, target.device_type)
        type_sim = self.type_compatibility.get(
            type_key,
            self.type_compatibility.get(reverse_key, 0.3)
        )
        factors['device_type'] = type_sim

        # Manufacturer similarity
        factors['manufacturer'] = 1.0 if target.manufacturer == candidate.manufacturer else 0.5

        # Capacity similarity (exponential decay)
        cap_ratio = min(target.capacity_kwh, candidate.capacity_kwh) / max(target.capacity_kwh, candidate.capacity_kwh)
        factors['capacity'] = cap_ratio ** 0.5

        # Power similarity
        power_ratio = min(target.power_kw, candidate.power_kw) / max(target.power_kw, candidate.power_kw)
        factors['power'] = power_ratio ** 0.5

        # Voltage similarity
        volt_ratio = min(target.voltage_nominal, candidate.voltage_nominal) / max(target.voltage_nominal, candidate.voltage_nominal)
        factors['voltage'] = volt_ratio ** 0.5

        # Cell configuration similarity
        series_match = 1.0 - abs(target.cells_in_series - candidate.cells_in_series) / max(target.cells_in_series, 1)
        factors['cell_config'] = max(0, series_match)

        # Climate similarity
        factors['climate'] = 1.0 if target.climate_zone == candidate.climate_zone else 0.6

        # Application similarity
        factors['application'] = 1.0 if target.application == candidate.application else 0.7

        # Features similarity (Jaccard)
        if target.features and candidate.features:
            intersection = len(set(target.features) & set(candidate.features))
            union = len(set(target.features) | set(candidate.features))
            factors['features'] = intersection / union if union > 0 else 0
        else:
            factors['features'] = 0.5

        # Calculate weighted sum
        total_similarity = sum(
            factors[k] * self.weights[k]
            for k in factors
        )

        return total_similarity, factors

    def get_transfer_recommendations(
        self,
        source: DeviceProfile,
        target: DeviceProfile,
        source_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get recommendations for transferring config from source to target.

        Args:
            source: Source device
            target: Target device
            source_config: Configuration from source device

        Returns:
            Adapted configuration with recommendations
        """
        similarity, factors = self._calculate_similarity(source, target)

        adapted_config = source_config.copy()
        recommendations = []

        # Adapt based on capacity difference
        cap_ratio = target.capacity_kwh / source.capacity_kwh
        if abs(cap_ratio - 1.0) > 0.1:
            recommendations.append(
                f"Capacity differs by {(cap_ratio-1)*100:.1f}%. "
                "Currents scaled proportionally."
            )

        # Adapt based on voltage difference
        volt_ratio = target.voltage_nominal / source.voltage_nominal
        if abs(volt_ratio - 1.0) > 0.1:
            recommendations.append(
                f"Voltage differs by {(volt_ratio-1)*100:.1f}%. "
                "Voltage parameters scaled."
            )

            # Scale voltage-related parameters
            for key in adapted_config:
                if 'voltage' in key.lower():
                    adapted_config[key] = source_config[key] * volt_ratio

        # Adapt based on cell configuration
        if target.cells_in_series != source.cells_in_series:
            cell_ratio = target.cells_in_series / source.cells_in_series
            recommendations.append(
                f"Cell count differs ({source.cells_in_series}S vs {target.cells_in_series}S). "
                "Consider reviewing per-cell parameters."
            )

        # Climate adaptations
        if target.climate_zone != source.climate_zone:
            recommendations.append(
                f"Different climate zones ({source.climate_zone} vs {target.climate_zone}). "
                "Review thermal management parameters."
            )

            # Adjust thermal parameters
            if target.climate_zone == 'tropical':
                adapted_config['cooling_start_temperature_c'] = min(
                    adapted_config.get('cooling_start_temperature_c', 35),
                    32
                )
            elif target.climate_zone == 'arid':
                adapted_config['target_temperature_c'] = 28

        # Safety margin for low similarity
        if similarity < 0.7:
            recommendations.append(
                f"Low similarity ({similarity:.2f}). "
                "Recommend starting with conservative parameters and gradual tuning."
            )
            # Apply safety derating
            for key in adapted_config:
                if 'current' in key.lower() and isinstance(adapted_config[key], (int, float)):
                    adapted_config[key] = adapted_config[key] * 0.8

        return {
            'adapted_config': adapted_config,
            'similarity': similarity,
            'recommendations': recommendations,
            'confidence': similarity * 0.8  # Confidence is related to similarity
        }

    def find_optimal_donor(
        self,
        target: DeviceProfile,
        available_configs: Dict[str, Dict[str, Any]]
    ) -> Optional[Tuple[str, float, Dict[str, Any]]]:
        """
        Find the best device to transfer configuration from.

        Args:
            target: Target device
            available_configs: Dict of device_id -> config

        Returns:
            Tuple of (donor_device_id, similarity, adapted_config) or None
        """
        best_donor = None
        best_similarity = 0.0
        best_config = None

        for device_id, config in available_configs.items():
            if device_id not in self.devices:
                continue

            donor = self.devices[device_id]
            similarity, _ = self._calculate_similarity(target, donor)

            if similarity > best_similarity:
                best_similarity = similarity
                best_donor = device_id
                transfer = self.get_transfer_recommendations(donor, target, config)
                best_config = transfer['adapted_config']

        if best_donor and best_similarity >= 0.5:
            return (best_donor, best_similarity, best_config)

        return None

    def get_fleet_statistics(self) -> Dict[str, Any]:
        """Get statistics about registered devices"""
        if not self.devices:
            return {'total': 0}

        types = {}
        climates = {}
        applications = {}
        total_capacity = 0
        total_power = 0

        for device in self.devices.values():
            types[device.device_type] = types.get(device.device_type, 0) + 1
            climates[device.climate_zone] = climates.get(device.climate_zone, 0) + 1
            applications[device.application] = applications.get(device.application, 0) + 1
            total_capacity += device.capacity_kwh
            total_power += device.power_kw

        return {
            'total_devices': len(self.devices),
            'by_type': types,
            'by_climate': climates,
            'by_application': applications,
            'total_capacity_kwh': total_capacity,
            'total_power_kw': total_power,
            'average_capacity_kwh': total_capacity / len(self.devices),
            'average_power_kw': total_power / len(self.devices)
        }

    def get_device(self, device_id: str) -> Optional[DeviceProfile]:
        """Get device by ID"""
        return self.devices.get(device_id)

    def list_devices(
        self,
        device_type: Optional[str] = None,
        climate: Optional[str] = None,
        application: Optional[str] = None
    ) -> List[DeviceProfile]:
        """List devices with optional filtering"""
        results = list(self.devices.values())

        if device_type:
            results = [d for d in results if d.device_type == device_type]

        if climate:
            results = [d for d in results if d.climate_zone == climate]

        if application:
            results = [d for d in results if d.application == application]

        return results
