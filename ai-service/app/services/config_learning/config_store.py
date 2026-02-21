"""
Config Store
Storage and retrieval of BESS configurations with versioning.
"""

import json
import hashlib
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigCategory(Enum):
    """Categories of configurations"""
    CHARGING = "charging"
    DISCHARGING = "discharging"
    THERMAL = "thermal"
    BALANCING = "balancing"
    SAFETY = "safety"
    OPTIMIZATION = "optimization"
    PROTOCOL = "protocol"
    SCHEDULE = "schedule"


class ConfigStatus(Enum):
    """Status of a configuration"""
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


@dataclass
class ConfigMetadata:
    """Metadata for a configuration"""
    device_type: str  # e.g., "LiFePO4_280Ah"
    manufacturer: str
    model: str
    capacity_kwh: float
    voltage_nominal: float
    cells_in_series: int
    modules_count: int
    environment: str = "production"  # production, testing, simulation
    region: str = "default"
    tags: List[str] = field(default_factory=list)


@dataclass
class ConfigVersion:
    """Version of a configuration"""
    version: int
    created_at: datetime
    created_by: str
    parameters: Dict[str, Any]
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    notes: str = ""
    hash: str = ""

    def __post_init__(self):
        if not self.hash:
            self.hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """Compute hash of parameters"""
        param_str = json.dumps(self.parameters, sort_keys=True)
        return hashlib.sha256(param_str.encode()).hexdigest()[:16]


@dataclass
class ConfigEntry:
    """A configuration entry with version history"""
    id: str
    name: str
    category: ConfigCategory
    metadata: ConfigMetadata
    status: ConfigStatus = ConfigStatus.DRAFT
    current_version: int = 1
    versions: List[ConfigVersion] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    usage_count: int = 0
    success_rate: float = 0.0
    average_efficiency: float = 0.0

    def get_current_parameters(self) -> Dict[str, Any]:
        """Get parameters from current version"""
        for v in self.versions:
            if v.version == self.current_version:
                return v.parameters
        return {}

    def add_version(
        self,
        parameters: Dict[str, Any],
        created_by: str,
        notes: str = "",
        performance_metrics: Dict[str, float] = None
    ) -> ConfigVersion:
        """Add a new version"""
        new_version = ConfigVersion(
            version=self.current_version + 1,
            created_at=datetime.now(),
            created_by=created_by,
            parameters=parameters,
            performance_metrics=performance_metrics or {},
            notes=notes
        )

        self.versions.append(new_version)
        self.current_version = new_version.version
        self.updated_at = datetime.now()

        return new_version

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category.value,
            'status': self.status.value,
            'metadata': asdict(self.metadata),
            'current_version': self.current_version,
            'versions': [
                {
                    'version': v.version,
                    'created_at': v.created_at.isoformat(),
                    'created_by': v.created_by,
                    'parameters': v.parameters,
                    'performance_metrics': v.performance_metrics,
                    'notes': v.notes,
                    'hash': v.hash
                }
                for v in self.versions
            ],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'usage_count': self.usage_count,
            'success_rate': self.success_rate,
            'average_efficiency': self.average_efficiency
        }


# Default configurations for different battery types
DEFAULT_CONFIGS = {
    "LiFePO4_standard": {
        "charging": {
            "max_charge_current_c": 0.5,
            "bulk_charge_voltage_per_cell": 3.65,
            "float_voltage_per_cell": 3.40,
            "absorption_time_minutes": 30,
            "temperature_compensation_mv_per_c": -3,
            "min_charge_temperature_c": 0,
            "max_charge_temperature_c": 45
        },
        "discharging": {
            "max_discharge_current_c": 1.0,
            "min_cell_voltage": 2.5,
            "low_voltage_warning": 2.8,
            "min_discharge_temperature_c": -20,
            "max_discharge_temperature_c": 55
        },
        "thermal": {
            "target_temperature_c": 25,
            "cooling_start_temperature_c": 35,
            "cooling_max_temperature_c": 40,
            "heating_start_temperature_c": 10,
            "heating_stop_temperature_c": 15,
            "delta_t_alarm_c": 5
        },
        "balancing": {
            "balance_start_voltage_v": 3.4,
            "balance_delta_mv": 10,
            "balance_current_ma": 50,
            "balance_during_charge": True,
            "balance_during_discharge": False
        },
        "safety": {
            "overvoltage_protection_v": 3.7,
            "undervoltage_protection_v": 2.5,
            "overcurrent_protection_a": 500,
            "overtemperature_protection_c": 60,
            "undertemperature_protection_c": -25
        }
    },
    "NMC_standard": {
        "charging": {
            "max_charge_current_c": 1.0,
            "bulk_charge_voltage_per_cell": 4.2,
            "float_voltage_per_cell": 4.1,
            "absorption_time_minutes": 45,
            "temperature_compensation_mv_per_c": -4,
            "min_charge_temperature_c": 5,
            "max_charge_temperature_c": 45
        },
        "discharging": {
            "max_discharge_current_c": 2.0,
            "min_cell_voltage": 3.0,
            "low_voltage_warning": 3.2,
            "min_discharge_temperature_c": -10,
            "max_discharge_temperature_c": 55
        },
        "thermal": {
            "target_temperature_c": 25,
            "cooling_start_temperature_c": 30,
            "cooling_max_temperature_c": 35,
            "heating_start_temperature_c": 15,
            "heating_stop_temperature_c": 20,
            "delta_t_alarm_c": 3
        },
        "balancing": {
            "balance_start_voltage_v": 4.0,
            "balance_delta_mv": 5,
            "balance_current_ma": 100,
            "balance_during_charge": True,
            "balance_during_discharge": False
        },
        "safety": {
            "overvoltage_protection_v": 4.25,
            "undervoltage_protection_v": 2.8,
            "overcurrent_protection_a": 400,
            "overtemperature_protection_c": 55,
            "undertemperature_protection_c": -15
        }
    }
}


class ConfigStore:
    """
    Storage and retrieval of BESS configurations.

    Features:
    - Version control for configurations
    - Search by similarity
    - Performance tracking
    - Default configurations
    """

    def __init__(self, storage_path: Optional[str] = None):
        self.configs: Dict[str, ConfigEntry] = {}
        self.storage_path = Path(storage_path) if storage_path else None

        # Index by category and device type
        self.category_index: Dict[ConfigCategory, List[str]] = {cat: [] for cat in ConfigCategory}
        self.device_type_index: Dict[str, List[str]] = {}

        # Load defaults
        self._load_default_configs()

    def _load_default_configs(self):
        """Load default configurations"""
        for device_type, categories in DEFAULT_CONFIGS.items():
            for category_name, parameters in categories.items():
                try:
                    category = ConfigCategory(category_name)

                    config_id = f"default_{device_type}_{category_name}"
                    metadata = ConfigMetadata(
                        device_type=device_type,
                        manufacturer="Generic",
                        model="Standard",
                        capacity_kwh=100.0,
                        voltage_nominal=51.2 if "LiFePO4" in device_type else 400.0,
                        cells_in_series=16 if "LiFePO4" in device_type else 96,
                        modules_count=1,
                        tags=["default", device_type, category_name]
                    )

                    config = ConfigEntry(
                        id=config_id,
                        name=f"Default {device_type} {category_name.title()} Config",
                        category=category,
                        metadata=metadata,
                        status=ConfigStatus.ACTIVE
                    )

                    initial_version = ConfigVersion(
                        version=1,
                        created_at=datetime.now(),
                        created_by="system",
                        parameters=parameters,
                        notes="Default configuration"
                    )

                    config.versions.append(initial_version)
                    self.configs[config_id] = config

                    # Update indexes
                    self.category_index[category].append(config_id)
                    if device_type not in self.device_type_index:
                        self.device_type_index[device_type] = []
                    self.device_type_index[device_type].append(config_id)

                except ValueError:
                    continue

    def create_config(
        self,
        name: str,
        category: ConfigCategory,
        metadata: ConfigMetadata,
        parameters: Dict[str, Any],
        created_by: str,
        notes: str = ""
    ) -> ConfigEntry:
        """Create a new configuration"""
        import uuid

        config_id = str(uuid.uuid4())

        config = ConfigEntry(
            id=config_id,
            name=name,
            category=category,
            metadata=metadata
        )

        initial_version = ConfigVersion(
            version=1,
            created_at=datetime.now(),
            created_by=created_by,
            parameters=parameters,
            notes=notes
        )

        config.versions.append(initial_version)
        self.configs[config_id] = config

        # Update indexes
        self.category_index[category].append(config_id)
        if metadata.device_type not in self.device_type_index:
            self.device_type_index[metadata.device_type] = []
        self.device_type_index[metadata.device_type].append(config_id)

        logger.info(f"Created config {config_id}: {name}")

        return config

    def get_config(self, config_id: str) -> Optional[ConfigEntry]:
        """Get a configuration by ID"""
        return self.configs.get(config_id)

    def update_config(
        self,
        config_id: str,
        parameters: Dict[str, Any],
        updated_by: str,
        notes: str = "",
        performance_metrics: Dict[str, float] = None
    ) -> Optional[ConfigVersion]:
        """Update a configuration (creates new version)"""
        config = self.configs.get(config_id)
        if not config:
            return None

        new_version = config.add_version(
            parameters=parameters,
            created_by=updated_by,
            notes=notes,
            performance_metrics=performance_metrics
        )

        logger.info(f"Updated config {config_id} to version {new_version.version}")

        return new_version

    def search_configs(
        self,
        category: Optional[ConfigCategory] = None,
        device_type: Optional[str] = None,
        status: Optional[ConfigStatus] = None,
        tags: Optional[List[str]] = None
    ) -> List[ConfigEntry]:
        """Search configurations"""
        results = list(self.configs.values())

        if category:
            config_ids = self.category_index.get(category, [])
            results = [c for c in results if c.id in config_ids]

        if device_type:
            config_ids = self.device_type_index.get(device_type, [])
            results = [c for c in results if c.id in config_ids]

        if status:
            results = [c for c in results if c.status == status]

        if tags:
            results = [
                c for c in results
                if any(tag in c.metadata.tags for tag in tags)
            ]

        return results

    def get_best_config(
        self,
        category: ConfigCategory,
        device_type: str,
        min_usage: int = 5
    ) -> Optional[ConfigEntry]:
        """Get the best performing configuration for criteria"""
        configs = self.search_configs(category=category, device_type=device_type)

        # Filter by minimum usage and active status
        configs = [
            c for c in configs
            if c.usage_count >= min_usage and c.status == ConfigStatus.ACTIVE
        ]

        if not configs:
            # Return default if available
            defaults = [c for c in self.search_configs(category=category) if 'default' in c.metadata.tags]
            return defaults[0] if defaults else None

        # Sort by success rate and efficiency
        configs.sort(
            key=lambda c: (c.success_rate * 0.6 + c.average_efficiency * 0.4),
            reverse=True
        )

        return configs[0]

    def record_usage(
        self,
        config_id: str,
        success: bool,
        efficiency: Optional[float] = None,
        metrics: Dict[str, float] = None
    ):
        """Record usage of a configuration"""
        config = self.configs.get(config_id)
        if not config:
            return

        config.usage_count += 1

        # Update success rate (exponential moving average)
        alpha = 0.1  # Smoothing factor
        config.success_rate = alpha * (1.0 if success else 0.0) + (1 - alpha) * config.success_rate

        # Update efficiency
        if efficiency is not None:
            config.average_efficiency = alpha * efficiency + (1 - alpha) * config.average_efficiency

        # Store metrics in current version
        if metrics and config.versions:
            current = config.versions[-1]
            for key, value in metrics.items():
                if key in current.performance_metrics:
                    current.performance_metrics[key] = (
                        alpha * value + (1 - alpha) * current.performance_metrics[key]
                    )
                else:
                    current.performance_metrics[key] = value

    def deprecate_config(self, config_id: str) -> bool:
        """Mark a configuration as deprecated"""
        config = self.configs.get(config_id)
        if config:
            config.status = ConfigStatus.DEPRECATED
            config.updated_at = datetime.now()
            return True
        return False

    def archive_config(self, config_id: str) -> bool:
        """Archive a configuration"""
        config = self.configs.get(config_id)
        if config:
            config.status = ConfigStatus.ARCHIVED
            config.updated_at = datetime.now()
            return True
        return False

    def activate_config(self, config_id: str) -> bool:
        """Activate a configuration"""
        config = self.configs.get(config_id)
        if config:
            config.status = ConfigStatus.ACTIVE
            config.updated_at = datetime.now()
            return True
        return False

    def get_config_history(self, config_id: str) -> List[ConfigVersion]:
        """Get version history for a configuration"""
        config = self.configs.get(config_id)
        return config.versions if config else []

    def rollback_config(self, config_id: str, to_version: int) -> bool:
        """Rollback to a previous version"""
        config = self.configs.get(config_id)
        if not config:
            return False

        target_version = None
        for v in config.versions:
            if v.version == to_version:
                target_version = v
                break

        if not target_version:
            return False

        # Create new version with old parameters
        config.add_version(
            parameters=target_version.parameters.copy(),
            created_by="system",
            notes=f"Rollback to version {to_version}"
        )

        return True

    def export_config(self, config_id: str) -> Optional[Dict[str, Any]]:
        """Export configuration as dictionary"""
        config = self.configs.get(config_id)
        return config.to_dict() if config else None

    def import_config(self, data: Dict[str, Any], created_by: str) -> Optional[ConfigEntry]:
        """Import configuration from dictionary"""
        try:
            metadata = ConfigMetadata(**data['metadata'])
            category = ConfigCategory(data['category'])

            config = self.create_config(
                name=data['name'],
                category=category,
                metadata=metadata,
                parameters=data['versions'][-1]['parameters'] if data.get('versions') else {},
                created_by=created_by,
                notes=f"Imported from {data.get('id', 'unknown')}"
            )

            return config

        except Exception as e:
            logger.error(f"Failed to import config: {e}")
            return None

    def get_statistics(self) -> Dict[str, Any]:
        """Get store statistics"""
        total = len(self.configs)
        by_category = {cat.value: len(ids) for cat, ids in self.category_index.items()}
        by_status = {
            status.value: len([c for c in self.configs.values() if c.status == status])
            for status in ConfigStatus
        }
        by_device = {dt: len(ids) for dt, ids in self.device_type_index.items()}

        top_configs = sorted(
            self.configs.values(),
            key=lambda c: c.usage_count,
            reverse=True
        )[:10]

        return {
            'total_configs': total,
            'by_category': by_category,
            'by_status': by_status,
            'by_device_type': by_device,
            'top_used': [
                {'id': c.id, 'name': c.name, 'usage': c.usage_count}
                for c in top_configs
            ]
        }
