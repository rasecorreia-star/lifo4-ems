"""
Entity Extractor for BESS Virtual Assistant
Extracts named entities and parameters from user input.
"""

import re
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class EntityType(Enum):
    """Types of entities for BESS management"""
    # Numeric entities
    POWER = "power"           # Power values (kW, MW)
    ENERGY = "energy"         # Energy values (kWh, MWh)
    PERCENTAGE = "percentage" # Percentage values
    TEMPERATURE = "temperature"  # Temperature values
    VOLTAGE = "voltage"       # Voltage values
    CURRENT = "current"       # Current values (A)
    TIME_DURATION = "time_duration"  # Duration (hours, minutes)

    # Temporal entities
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"
    RELATIVE_TIME = "relative_time"

    # Device/component entities
    BESS_ID = "bess_id"
    MODULE_ID = "module_id"
    CELL_ID = "cell_id"
    RACK_ID = "rack_id"
    PCS_ID = "pcs_id"

    # Operation entities
    OPERATION_MODE = "operation_mode"  # charge, discharge, idle
    ALARM_TYPE = "alarm_type"
    REPORT_TYPE = "report_type"

    # Other
    LOCATION = "location"
    USER = "user"
    CUSTOM = "custom"


@dataclass
class Entity:
    """Extracted entity"""
    type: EntityType
    value: Any
    raw_text: str
    start: int
    end: int
    confidence: float = 1.0
    unit: Optional[str] = None
    normalized_value: Optional[Any] = None


@dataclass
class ExtractionResult:
    """Result of entity extraction"""
    entities: List[Entity]
    text: str
    has_entities: bool = False


# Entity patterns
ENTITY_PATTERNS = {
    # Power patterns (kW, MW)
    EntityType.POWER: [
        (r'(\d+(?:[.,]\d+)?)\s*(kw|kilowatt|quilowatt)', 'kW'),
        (r'(\d+(?:[.,]\d+)?)\s*(mw|megawatt)', 'MW'),
        (r'(\d+(?:[.,]\d+)?)\s*(w|watt)', 'W'),
    ],

    # Energy patterns (kWh, MWh)
    EntityType.ENERGY: [
        (r'(\d+(?:[.,]\d+)?)\s*(kwh|kilowatt[- ]?hour)', 'kWh'),
        (r'(\d+(?:[.,]\d+)?)\s*(mwh|megawatt[- ]?hour)', 'MWh'),
        (r'(\d+(?:[.,]\d+)?)\s*(wh|watt[- ]?hour)', 'Wh'),
    ],

    # Percentage patterns
    EntityType.PERCENTAGE: [
        (r'(\d+(?:[.,]\d+)?)\s*(%|percent|por\s*cento|porcento)', '%'),
        (r'(\d+(?:[.,]\d+)?)\s*(pct)', '%'),
    ],

    # Temperature patterns
    EntityType.TEMPERATURE: [
        (r'(\d+(?:[.,]\d+)?)\s*(°?c|celsius|graus?)', '°C'),
        (r'(\d+(?:[.,]\d+)?)\s*(°?f|fahrenheit)', '°F'),
        (r'(\d+(?:[.,]\d+)?)\s*(k|kelvin)', 'K'),
    ],

    # Voltage patterns
    EntityType.VOLTAGE: [
        (r'(\d+(?:[.,]\d+)?)\s*(v|volt|volts)', 'V'),
        (r'(\d+(?:[.,]\d+)?)\s*(mv|milivolt)', 'mV'),
        (r'(\d+(?:[.,]\d+)?)\s*(kv|quilovolt|kilovolt)', 'kV'),
    ],

    # Current patterns
    EntityType.CURRENT: [
        (r'(\d+(?:[.,]\d+)?)\s*(a|amp|ampere|amperes)', 'A'),
        (r'(\d+(?:[.,]\d+)?)\s*(ma|miliampere)', 'mA'),
    ],

    # Time duration patterns
    EntityType.TIME_DURATION: [
        (r'(\d+(?:[.,]\d+)?)\s*(h|hora|horas|hour|hours)', 'hours'),
        (r'(\d+(?:[.,]\d+)?)\s*(min|minuto|minutos|minute|minutes)', 'minutes'),
        (r'(\d+(?:[.,]\d+)?)\s*(s|seg|segundo|segundos|second|seconds)', 'seconds'),
        (r'(\d+(?:[.,]\d+)?)\s*(d|dia|dias|day|days)', 'days'),
    ],

    # Device ID patterns
    EntityType.BESS_ID: [
        (r'bess[- _]?(\d+|[a-z]+)', None),
        (r'sistema[- _]?(\d+)', None),
        (r'battery[- _]?(\d+)', None),
    ],

    EntityType.MODULE_ID: [
        (r'modulo[- _]?(\d+)', None),
        (r'module[- _]?(\d+)', None),
        (r'mod[- _]?(\d+)', None),
    ],

    EntityType.RACK_ID: [
        (r'rack[- _]?(\d+)', None),
        (r'gabinete[- _]?(\d+)', None),
    ],

    # Operation mode patterns
    EntityType.OPERATION_MODE: [
        (r'\b(carga|carregamento|charge|charging)\b', 'charge'),
        (r'\b(descarga|descarregamento|discharge|discharging)\b', 'discharge'),
        (r'\b(ocioso|idle|standby|espera)\b', 'idle'),
        (r'\b(manutencao|maintenance)\b', 'maintenance'),
    ],

    # Report type patterns
    EntityType.REPORT_TYPE: [
        (r'\b(diario|daily)\b', 'daily'),
        (r'\b(semanal|weekly)\b', 'weekly'),
        (r'\b(mensal|monthly)\b', 'monthly'),
        (r'\b(anual|annual|yearly)\b', 'yearly'),
    ],
}

# Relative time patterns
RELATIVE_TIME_PATTERNS = [
    (r'\b(agora|now)\b', lambda: datetime.now()),
    (r'\b(hoje|today)\b', lambda: datetime.now().replace(hour=0, minute=0, second=0)),
    (r'\b(ontem|yesterday)\b', lambda: datetime.now().replace(hour=0, minute=0, second=0) - timedelta(days=1)),
    (r'\b(amanha|tomorrow)\b', lambda: datetime.now().replace(hour=0, minute=0, second=0) + timedelta(days=1)),
    (r'\b(esta\s+semana|this\s+week)\b', lambda: datetime.now() - timedelta(days=datetime.now().weekday())),
    (r'\b(semana\s+passada|last\s+week)\b', lambda: datetime.now() - timedelta(weeks=1)),
    (r'\b(este\s+mes|this\s+month)\b', lambda: datetime.now().replace(day=1)),
    (r'\b(mes\s+passado|last\s+month)\b', lambda: (datetime.now().replace(day=1) - timedelta(days=1)).replace(day=1)),
    (r'\b(proxima\s+hora|next\s+hour)\b', lambda: datetime.now() + timedelta(hours=1)),
    (r'\b(proximos?\s+(\d+)\s+(dia|dias|day|days))\b', lambda m: datetime.now() + timedelta(days=int(m.group(2)))),
    (r'\b(ultimos?\s+(\d+)\s+(dia|dias|day|days))\b', lambda m: datetime.now() - timedelta(days=int(m.group(2)))),
    (r'\b(ultimas?\s+(\d+)\s+(hora|horas|hour|hours))\b', lambda m: datetime.now() - timedelta(hours=int(m.group(2)))),
]

# Date patterns
DATE_PATTERNS = [
    # DD/MM/YYYY or DD-MM-YYYY
    (r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', lambda m: datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))),
    # YYYY-MM-DD
    (r'(\d{4})-(\d{1,2})-(\d{1,2})', lambda m: datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))),
    # DD de MONTH de YYYY
    (r'(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})', None),
]

# Time patterns
TIME_PATTERNS = [
    # HH:MM or HH:MM:SS
    (r'(\d{1,2}):(\d{2})(?::(\d{2}))?', lambda m: (int(m.group(1)), int(m.group(2)), int(m.group(3) or 0))),
    # HHh or HHhMM
    (r'(\d{1,2})h(\d{2})?', lambda m: (int(m.group(1)), int(m.group(2) or 0), 0)),
]


class EntityExtractor:
    """
    Extracts entities from user input for BESS management.

    Supports:
    - Numeric values with units (power, energy, temperature, etc.)
    - Temporal expressions (dates, times, durations)
    - Device identifiers (BESS, module, rack IDs)
    - Operation modes and parameters
    """

    def __init__(self):
        # Compile patterns
        self.compiled_patterns: Dict[EntityType, List[Tuple[re.Pattern, Any]]] = {}
        self._compile_patterns()

        self.compiled_relative_time = [
            (re.compile(pattern, re.IGNORECASE), func)
            for pattern, func in RELATIVE_TIME_PATTERNS
        ]

        self.compiled_date = [
            (re.compile(pattern, re.IGNORECASE), func)
            for pattern, func in DATE_PATTERNS
        ]

        self.compiled_time = [
            (re.compile(pattern, re.IGNORECASE), func)
            for pattern, func in TIME_PATTERNS
        ]

    def _compile_patterns(self):
        """Compile regex patterns"""
        for entity_type, patterns in ENTITY_PATTERNS.items():
            self.compiled_patterns[entity_type] = [
                (re.compile(pattern, re.IGNORECASE), unit)
                for pattern, unit in patterns
            ]

    def extract(self, text: str) -> ExtractionResult:
        """
        Extract all entities from text.

        Args:
            text: Input text

        Returns:
            ExtractionResult with list of extracted entities
        """
        entities: List[Entity] = []

        # Extract numeric entities with units
        for entity_type, patterns in self.compiled_patterns.items():
            for pattern, unit in patterns:
                for match in pattern.finditer(text):
                    value = self._parse_numeric(match.group(1))
                    normalized = self._normalize_value(value, unit, entity_type)

                    entity = Entity(
                        type=entity_type,
                        value=value,
                        raw_text=match.group(),
                        start=match.start(),
                        end=match.end(),
                        unit=unit,
                        normalized_value=normalized
                    )
                    entities.append(entity)

        # Extract relative time expressions
        for pattern, func in self.compiled_relative_time:
            for match in pattern.finditer(text):
                try:
                    if callable(func):
                        # Check if function expects match object
                        import inspect
                        sig = inspect.signature(func)
                        if len(sig.parameters) > 0:
                            value = func(match)
                        else:
                            value = func()

                        entity = Entity(
                            type=EntityType.RELATIVE_TIME,
                            value=value,
                            raw_text=match.group(),
                            start=match.start(),
                            end=match.end(),
                            normalized_value=value.isoformat() if isinstance(value, datetime) else str(value)
                        )
                        entities.append(entity)
                except Exception as e:
                    logger.debug(f"Failed to parse relative time: {match.group()}: {e}")

        # Extract dates
        for pattern, func in self.compiled_date:
            for match in pattern.finditer(text):
                try:
                    if func:
                        value = func(match)
                        entity = Entity(
                            type=EntityType.DATE,
                            value=value,
                            raw_text=match.group(),
                            start=match.start(),
                            end=match.end(),
                            normalized_value=value.isoformat() if isinstance(value, datetime) else str(value)
                        )
                        entities.append(entity)
                except Exception as e:
                    logger.debug(f"Failed to parse date: {match.group()}: {e}")

        # Extract times
        for pattern, func in self.compiled_time:
            for match in pattern.finditer(text):
                try:
                    if func:
                        hour, minute, second = func(match)
                        value = f"{hour:02d}:{minute:02d}:{second:02d}"
                        entity = Entity(
                            type=EntityType.TIME,
                            value=(hour, minute, second),
                            raw_text=match.group(),
                            start=match.start(),
                            end=match.end(),
                            normalized_value=value
                        )
                        entities.append(entity)
                except Exception as e:
                    logger.debug(f"Failed to parse time: {match.group()}: {e}")

        # Remove duplicates (prefer longer matches)
        entities = self._remove_overlapping(entities)

        return ExtractionResult(
            entities=entities,
            text=text,
            has_entities=len(entities) > 0
        )

    def _parse_numeric(self, value_str: str) -> float:
        """Parse numeric value from string"""
        # Replace comma with dot for decimal
        value_str = value_str.replace(',', '.')
        return float(value_str)

    def _normalize_value(
        self,
        value: float,
        unit: Optional[str],
        entity_type: EntityType
    ) -> float:
        """Normalize value to base units"""
        if unit is None:
            return value

        # Power normalization (to kW)
        if entity_type == EntityType.POWER:
            if unit == 'W':
                return value / 1000
            elif unit == 'MW':
                return value * 1000
            return value  # Already kW

        # Energy normalization (to kWh)
        if entity_type == EntityType.ENERGY:
            if unit == 'Wh':
                return value / 1000
            elif unit == 'MWh':
                return value * 1000
            return value  # Already kWh

        # Temperature normalization (to °C)
        if entity_type == EntityType.TEMPERATURE:
            if unit == '°F':
                return (value - 32) * 5 / 9
            elif unit == 'K':
                return value - 273.15
            return value  # Already °C

        # Voltage normalization (to V)
        if entity_type == EntityType.VOLTAGE:
            if unit == 'mV':
                return value / 1000
            elif unit == 'kV':
                return value * 1000
            return value  # Already V

        # Current normalization (to A)
        if entity_type == EntityType.CURRENT:
            if unit == 'mA':
                return value / 1000
            return value  # Already A

        # Time duration normalization (to seconds)
        if entity_type == EntityType.TIME_DURATION:
            if unit == 'minutes':
                return value * 60
            elif unit == 'hours':
                return value * 3600
            elif unit == 'days':
                return value * 86400
            return value  # Already seconds

        return value

    def _remove_overlapping(self, entities: List[Entity]) -> List[Entity]:
        """Remove overlapping entities, keeping longer matches"""
        if len(entities) <= 1:
            return entities

        # Sort by start position, then by length (descending)
        sorted_entities = sorted(
            entities,
            key=lambda e: (e.start, -(e.end - e.start))
        )

        result = []
        last_end = -1

        for entity in sorted_entities:
            if entity.start >= last_end:
                result.append(entity)
                last_end = entity.end
            elif entity.end - entity.start > (result[-1].end - result[-1].start):
                # Replace with longer match if it starts at the same position
                if entity.start == result[-1].start:
                    result[-1] = entity
                    last_end = entity.end

        return result

    def extract_power(self, text: str) -> Optional[float]:
        """Extract power value from text (returns kW)"""
        result = self.extract(text)
        for entity in result.entities:
            if entity.type == EntityType.POWER:
                return entity.normalized_value
        return None

    def extract_percentage(self, text: str) -> Optional[float]:
        """Extract percentage value from text"""
        result = self.extract(text)
        for entity in result.entities:
            if entity.type == EntityType.PERCENTAGE:
                return entity.value
        return None

    def extract_temperature(self, text: str) -> Optional[float]:
        """Extract temperature value from text (returns °C)"""
        result = self.extract(text)
        for entity in result.entities:
            if entity.type == EntityType.TEMPERATURE:
                return entity.normalized_value
        return None

    def extract_time_range(self, text: str) -> Optional[Tuple[datetime, datetime]]:
        """Extract time range from text"""
        result = self.extract(text)

        dates = [e for e in result.entities if e.type in [EntityType.DATE, EntityType.RELATIVE_TIME]]
        times = [e for e in result.entities if e.type == EntityType.TIME]

        if len(dates) >= 2:
            return (dates[0].value, dates[1].value)
        elif len(dates) == 1 and len(times) >= 2:
            date = dates[0].value
            start_time = times[0].value
            end_time = times[1].value
            return (
                date.replace(hour=start_time[0], minute=start_time[1]),
                date.replace(hour=end_time[0], minute=end_time[1])
            )
        elif len(dates) == 1:
            date = dates[0].value
            if isinstance(date, datetime):
                return (date, date + timedelta(days=1))

        return None

    def extract_device_id(self, text: str) -> Optional[Dict[str, str]]:
        """Extract device identifiers from text"""
        result = self.extract(text)

        devices = {}
        for entity in result.entities:
            if entity.type == EntityType.BESS_ID:
                devices['bess'] = entity.value
            elif entity.type == EntityType.MODULE_ID:
                devices['module'] = entity.value
            elif entity.type == EntityType.RACK_ID:
                devices['rack'] = entity.value
            elif entity.type == EntityType.CELL_ID:
                devices['cell'] = entity.value

        return devices if devices else None

    def extract_operation_mode(self, text: str) -> Optional[str]:
        """Extract operation mode from text"""
        result = self.extract(text)
        for entity in result.entities:
            if entity.type == EntityType.OPERATION_MODE:
                return entity.normalized_value or entity.value
        return None

    def get_entities_by_type(
        self,
        text: str,
        entity_type: EntityType
    ) -> List[Entity]:
        """Get all entities of a specific type"""
        result = self.extract(text)
        return [e for e in result.entities if e.type == entity_type]
