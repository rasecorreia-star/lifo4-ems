"""
Register Mapper Service
Automatic register mapping and configuration generation
"""

from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging
import json
from pathlib import Path

logger = logging.getLogger(__name__)


# ============================================
# TYPES
# ============================================

class DataType(str, Enum):
    """Register data types"""
    UINT16 = "uint16"
    INT16 = "int16"
    UINT32 = "uint32"
    INT32 = "int32"
    FLOAT32 = "float32"
    FLOAT64 = "float64"
    STRING = "string"
    BITMAP = "bitmap"
    ENUM = "enum"


class RegisterCategory(str, Enum):
    """Categories of registers"""
    IDENTIFICATION = "identification"
    STATUS = "status"
    MEASUREMENT = "measurement"
    CONFIGURATION = "configuration"
    CONTROL = "control"
    ALARM = "alarm"
    STATISTICS = "statistics"


@dataclass
class RegisterDefinition:
    """Complete register definition"""
    address: int
    name: str
    description: str
    data_type: DataType
    category: RegisterCategory
    unit: str = ""
    scale: float = 1.0
    offset: float = 0.0
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    writable: bool = False
    enum_values: Optional[Dict[int, str]] = None
    bit_definitions: Optional[Dict[int, str]] = None
    related_registers: List[int] = field(default_factory=list)


@dataclass
class RegisterMap:
    """Complete register map for a device"""
    device_id: str
    manufacturer: str
    model: str
    protocol: str
    created_at: datetime
    updated_at: datetime
    registers: List[RegisterDefinition]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MappingResult:
    """Result of auto-mapping"""
    address: int
    suggested_name: str
    suggested_type: DataType
    suggested_category: RegisterCategory
    confidence: float
    reasoning: str
    sample_values: List[int]


# ============================================
# REGISTER ANALYZER
# ============================================

class RegisterAnalyzer:
    """Analyze register values to determine type and meaning"""

    # Common register patterns
    KNOWN_PATTERNS = {
        # Voltage patterns (typically 0-1000 representing 0-100V with 0.1 scale)
        "voltage": {
            "range": (0, 10000),
            "typical": (2000, 6000),
            "scale": 0.1,
            "unit": "V",
            "names": ["voltage", "v_dc", "v_ac", "pack_voltage", "cell_voltage"]
        },
        # Current patterns
        "current": {
            "range": (-32768, 32767),
            "typical": (-5000, 5000),
            "scale": 0.1,
            "unit": "A",
            "names": ["current", "i_dc", "i_ac", "charge_current", "discharge_current"]
        },
        # SOC patterns (0-100 or 0-1000)
        "soc": {
            "range": (0, 1000),
            "typical": (0, 1000),
            "scale": 0.1,
            "unit": "%",
            "names": ["soc", "state_of_charge", "battery_level"]
        },
        # Temperature patterns
        "temperature": {
            "range": (-400, 1500),  # -40 to 150°C with 0.1 scale
            "typical": (100, 600),  # 10 to 60°C
            "scale": 0.1,
            "unit": "°C",
            "names": ["temperature", "temp", "cell_temp", "ambient_temp"]
        },
        # Power patterns
        "power": {
            "range": (-100000, 100000),
            "typical": (0, 50000),
            "scale": 1,
            "unit": "W",
            "names": ["power", "active_power", "charge_power", "discharge_power"]
        },
        # Status/enum patterns
        "status": {
            "range": (0, 255),
            "typical": (0, 10),
            "scale": 1,
            "unit": "",
            "names": ["status", "state", "mode", "operating_state"]
        },
        # Alarm bitmap patterns
        "alarm": {
            "range": (0, 65535),
            "typical": (0, 0),  # Usually 0 when no alarms
            "scale": 1,
            "unit": "",
            "names": ["alarm", "fault", "warning", "error_code"]
        },
    }

    def __init__(self):
        pass

    def analyze(
        self,
        address: int,
        values: List[int],
        context: Optional[Dict[str, Any]] = None
    ) -> MappingResult:
        """Analyze register values and suggest mapping"""
        if not values:
            return MappingResult(
                address=address,
                suggested_name=f"reg_{address}",
                suggested_type=DataType.UINT16,
                suggested_category=RegisterCategory.STATUS,
                confidence=0.0,
                reasoning="No values to analyze",
                sample_values=[]
            )

        # Calculate statistics
        min_val = min(values)
        max_val = max(values)
        avg_val = sum(values) / len(values)
        unique_count = len(set(values))
        variance = sum((v - avg_val) ** 2 for v in values) / len(values)

        # Determine if signed (check for high values that might be negative)
        is_signed = any(v > 32767 for v in values)

        # Check for boolean
        if set(values) <= {0, 1}:
            return MappingResult(
                address=address,
                suggested_name=f"flag_{address}",
                suggested_type=DataType.UINT16,
                suggested_category=RegisterCategory.STATUS,
                confidence=0.9,
                reasoning="Binary values detected (0/1)",
                sample_values=values[:10]
            )

        # Check for enum (small number of unique values)
        if unique_count <= 10 and max_val < 100:
            return MappingResult(
                address=address,
                suggested_name=f"state_{address}",
                suggested_type=DataType.ENUM,
                suggested_category=RegisterCategory.STATUS,
                confidence=0.8,
                reasoning=f"Low cardinality ({unique_count} unique values)",
                sample_values=values[:10]
            )

        # Match against known patterns
        best_match = None
        best_confidence = 0.0

        for pattern_name, pattern in self.KNOWN_PATTERNS.items():
            confidence = self._match_pattern(values, pattern)
            if confidence > best_confidence:
                best_confidence = confidence
                best_match = (pattern_name, pattern)

        if best_match and best_confidence > 0.6:
            pattern_name, pattern = best_match
            return MappingResult(
                address=address,
                suggested_name=f"{pattern['names'][0]}_{address}",
                suggested_type=DataType.INT16 if is_signed else DataType.UINT16,
                suggested_category=self._get_category(pattern_name),
                confidence=best_confidence,
                reasoning=f"Matches {pattern_name} pattern (range: {min_val}-{max_val})",
                sample_values=values[:10]
            )

        # Fallback to generic analysis
        if variance < 1:
            category = RegisterCategory.CONFIGURATION  # Constant value
        elif variance > 10000:
            category = RegisterCategory.MEASUREMENT  # Varying measurement
        else:
            category = RegisterCategory.STATUS

        return MappingResult(
            address=address,
            suggested_name=f"reg_{address}",
            suggested_type=DataType.INT16 if is_signed else DataType.UINT16,
            suggested_category=category,
            confidence=0.4,
            reasoning=f"Generic analysis (range: {min_val}-{max_val}, variance: {variance:.1f})",
            sample_values=values[:10]
        )

    def _match_pattern(self, values: List[int], pattern: Dict) -> float:
        """Calculate confidence that values match a pattern"""
        min_val = min(values)
        max_val = max(values)
        avg_val = sum(values) / len(values)

        # Check if values are within expected range
        range_min, range_max = pattern["range"]
        if min_val < range_min or max_val > range_max:
            return 0.0

        # Check if values are in typical range
        typical_min, typical_max = pattern["typical"]
        in_typical = typical_min <= avg_val <= typical_max

        confidence = 0.5  # Base confidence for being in range
        if in_typical:
            confidence += 0.3

        # Additional confidence if variance is reasonable
        variance = sum((v - avg_val) ** 2 for v in values) / len(values)
        if variance < (range_max - range_min) ** 2 / 4:
            confidence += 0.2

        return min(confidence, 1.0)

    def _get_category(self, pattern_name: str) -> RegisterCategory:
        """Get category from pattern name"""
        if pattern_name in ["voltage", "current", "power", "temperature", "soc"]:
            return RegisterCategory.MEASUREMENT
        elif pattern_name in ["status", "alarm"]:
            return RegisterCategory.STATUS
        return RegisterCategory.STATUS


# ============================================
# REGISTER MAPPER SERVICE
# ============================================

class RegisterMapper:
    """Main register mapping service"""

    def __init__(self, library_path: Optional[str] = None):
        self.analyzer = RegisterAnalyzer()
        self.register_maps: Dict[str, RegisterMap] = {}
        self.library_path = Path(library_path) if library_path else Path("./data/register_maps")

        self._load_built_in_maps()

    def _load_built_in_maps(self):
        """Load built-in register maps"""

        # Generic BMS register map
        self.register_maps["generic_bms"] = RegisterMap(
            device_id="generic_bms",
            manufacturer="Generic",
            model="BMS",
            protocol="modbus_rtu",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            registers=[
                RegisterDefinition(
                    address=0, name="pack_voltage", description="Total pack voltage",
                    data_type=DataType.UINT16, category=RegisterCategory.MEASUREMENT,
                    unit="V", scale=0.1
                ),
                RegisterDefinition(
                    address=1, name="pack_current", description="Pack current (+ charge, - discharge)",
                    data_type=DataType.INT16, category=RegisterCategory.MEASUREMENT,
                    unit="A", scale=0.1
                ),
                RegisterDefinition(
                    address=2, name="soc", description="State of Charge",
                    data_type=DataType.UINT16, category=RegisterCategory.MEASUREMENT,
                    unit="%", scale=0.1, min_value=0, max_value=100
                ),
                RegisterDefinition(
                    address=3, name="soh", description="State of Health",
                    data_type=DataType.UINT16, category=RegisterCategory.MEASUREMENT,
                    unit="%", scale=0.1, min_value=0, max_value=100
                ),
                RegisterDefinition(
                    address=4, name="max_cell_temp", description="Maximum cell temperature",
                    data_type=DataType.INT16, category=RegisterCategory.MEASUREMENT,
                    unit="°C", scale=0.1
                ),
                RegisterDefinition(
                    address=5, name="min_cell_temp", description="Minimum cell temperature",
                    data_type=DataType.INT16, category=RegisterCategory.MEASUREMENT,
                    unit="°C", scale=0.1
                ),
                RegisterDefinition(
                    address=10, name="bms_status", description="BMS operating status",
                    data_type=DataType.ENUM, category=RegisterCategory.STATUS,
                    enum_values={0: "Idle", 1: "Charging", 2: "Discharging", 3: "Fault"}
                ),
                RegisterDefinition(
                    address=11, name="alarm_flags", description="Active alarm flags",
                    data_type=DataType.BITMAP, category=RegisterCategory.ALARM,
                    bit_definitions={
                        0: "Over voltage",
                        1: "Under voltage",
                        2: "Over current",
                        3: "Over temperature",
                        4: "Under temperature",
                        5: "Communication error"
                    }
                ),
            ]
        )

        # Sungrow PCS register map
        self.register_maps["sungrow_pcs"] = RegisterMap(
            device_id="sungrow_pcs",
            manufacturer="Sungrow",
            model="SC1000",
            protocol="modbus_tcp",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            registers=[
                RegisterDefinition(
                    address=5000, name="output_power", description="Active power output",
                    data_type=DataType.INT32, category=RegisterCategory.MEASUREMENT,
                    unit="W", scale=1
                ),
                RegisterDefinition(
                    address=5002, name="reactive_power", description="Reactive power",
                    data_type=DataType.INT32, category=RegisterCategory.MEASUREMENT,
                    unit="VAr", scale=1
                ),
                RegisterDefinition(
                    address=5004, name="dc_voltage", description="DC bus voltage",
                    data_type=DataType.UINT16, category=RegisterCategory.MEASUREMENT,
                    unit="V", scale=0.1
                ),
                RegisterDefinition(
                    address=5005, name="dc_current", description="DC current",
                    data_type=DataType.INT16, category=RegisterCategory.MEASUREMENT,
                    unit="A", scale=0.1
                ),
                RegisterDefinition(
                    address=5008, name="operating_state", description="PCS operating state",
                    data_type=DataType.ENUM, category=RegisterCategory.STATUS,
                    enum_values={
                        0: "Stop", 1: "Standby", 2: "Running",
                        3: "Fault", 4: "Grid Off"
                    }
                ),
            ]
        )

    def auto_map(
        self,
        register_data: Dict[int, List[int]],
        device_hint: Optional[str] = None
    ) -> List[MappingResult]:
        """Automatically map registers from collected data"""
        results = []

        for address, values in sorted(register_data.items()):
            result = self.analyzer.analyze(address, values)
            results.append(result)

        # Post-process to find related registers
        self._find_related_registers(results)

        return results

    def _find_related_registers(self, results: List[MappingResult]):
        """Find registers that might be related (e.g., high/low word pairs)"""
        for i, r1 in enumerate(results):
            for j, r2 in enumerate(results):
                if i >= j:
                    continue

                # Check for consecutive addresses (might be 32-bit value)
                if r2.address == r1.address + 1:
                    # Check if values suggest a 32-bit combination
                    pass

    def generate_config(
        self,
        mapping_results: List[MappingResult],
        device_info: Dict[str, str]
    ) -> RegisterMap:
        """Generate register map configuration from mapping results"""
        registers = []

        for result in mapping_results:
            reg = RegisterDefinition(
                address=result.address,
                name=result.suggested_name,
                description=f"Auto-detected: {result.reasoning}",
                data_type=result.suggested_type,
                category=result.suggested_category,
            )
            registers.append(reg)

        return RegisterMap(
            device_id=f"{device_info.get('manufacturer', 'unknown')}_{device_info.get('model', 'unknown')}",
            manufacturer=device_info.get("manufacturer", "Unknown"),
            model=device_info.get("model", "Unknown"),
            protocol=device_info.get("protocol", "modbus"),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            registers=registers,
            metadata={"auto_generated": True}
        )

    def get_register_map(self, device_id: str) -> Optional[RegisterMap]:
        """Get register map by device ID"""
        return self.register_maps.get(device_id)

    def list_register_maps(self) -> List[str]:
        """List available register maps"""
        return list(self.register_maps.keys())

    def add_register_map(self, register_map: RegisterMap):
        """Add a new register map"""
        self.register_maps[register_map.device_id] = register_map

    def save_register_map(self, device_id: str, path: Optional[str] = None):
        """Save register map to file"""
        if device_id not in self.register_maps:
            raise ValueError(f"Unknown device: {device_id}")

        reg_map = self.register_maps[device_id]

        if path is None:
            self.library_path.mkdir(parents=True, exist_ok=True)
            path = self.library_path / f"{device_id}.json"

        data = {
            "device_id": reg_map.device_id,
            "manufacturer": reg_map.manufacturer,
            "model": reg_map.model,
            "protocol": reg_map.protocol,
            "created_at": reg_map.created_at.isoformat(),
            "updated_at": reg_map.updated_at.isoformat(),
            "metadata": reg_map.metadata,
            "registers": [
                {
                    "address": r.address,
                    "name": r.name,
                    "description": r.description,
                    "data_type": r.data_type.value,
                    "category": r.category.value,
                    "unit": r.unit,
                    "scale": r.scale,
                    "offset": r.offset,
                    "min_value": r.min_value,
                    "max_value": r.max_value,
                    "writable": r.writable,
                    "enum_values": r.enum_values,
                    "bit_definitions": r.bit_definitions,
                }
                for r in reg_map.registers
            ]
        }

        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"Saved register map: {path}")

    def load_register_map(self, path: str) -> RegisterMap:
        """Load register map from file"""
        with open(path, 'r') as f:
            data = json.load(f)

        registers = [
            RegisterDefinition(
                address=r["address"],
                name=r["name"],
                description=r.get("description", ""),
                data_type=DataType(r["data_type"]),
                category=RegisterCategory(r["category"]),
                unit=r.get("unit", ""),
                scale=r.get("scale", 1.0),
                offset=r.get("offset", 0.0),
                min_value=r.get("min_value"),
                max_value=r.get("max_value"),
                writable=r.get("writable", False),
                enum_values=r.get("enum_values"),
                bit_definitions=r.get("bit_definitions"),
            )
            for r in data["registers"]
        ]

        reg_map = RegisterMap(
            device_id=data["device_id"],
            manufacturer=data["manufacturer"],
            model=data["model"],
            protocol=data["protocol"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            registers=registers,
            metadata=data.get("metadata", {})
        )

        self.register_maps[reg_map.device_id] = reg_map
        return reg_map

    def export_to_driver_config(
        self,
        device_id: str,
        output_format: str = "typescript"
    ) -> str:
        """Export register map to driver configuration format"""
        reg_map = self.register_maps.get(device_id)
        if not reg_map:
            raise ValueError(f"Unknown device: {device_id}")

        if output_format == "typescript":
            return self._export_typescript(reg_map)
        elif output_format == "json":
            return self._export_json(reg_map)
        else:
            raise ValueError(f"Unknown format: {output_format}")

    def _export_typescript(self, reg_map: RegisterMap) -> str:
        """Export as TypeScript interface"""
        lines = [
            f"// Auto-generated register map for {reg_map.manufacturer} {reg_map.model}",
            f"// Generated at: {datetime.now().isoformat()}",
            "",
            "export interface RegisterMap {",
        ]

        for reg in reg_map.registers:
            ts_type = "number"
            if reg.data_type == DataType.STRING:
                ts_type = "string"
            elif reg.data_type == DataType.BITMAP:
                ts_type = "number"

            lines.append(f"  /** {reg.description} */")
            lines.append(f"  {reg.name}: {ts_type};")

        lines.append("}")
        lines.append("")
        lines.append("export const REGISTER_ADDRESSES = {")

        for reg in reg_map.registers:
            lines.append(f"  {reg.name.upper()}: {reg.address},")

        lines.append("};")

        return "\n".join(lines)

    def _export_json(self, reg_map: RegisterMap) -> str:
        """Export as JSON"""
        data = {
            "device_id": reg_map.device_id,
            "manufacturer": reg_map.manufacturer,
            "model": reg_map.model,
            "registers": {
                reg.name: {
                    "address": reg.address,
                    "type": reg.data_type.value,
                    "scale": reg.scale,
                    "unit": reg.unit,
                }
                for reg in reg_map.registers
            }
        }
        return json.dumps(data, indent=2)


# Singleton instance
register_mapper = RegisterMapper()
