"""
Pattern Matcher Service
Advanced pattern matching for protocol and register identification
"""

import re
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import logging
import json

logger = logging.getLogger(__name__)


# ============================================
# TYPES
# ============================================

class PatternType(str, Enum):
    """Types of patterns to match"""
    BYTE_SEQUENCE = "byte_sequence"
    REGISTER_RANGE = "register_range"
    VALUE_RANGE = "value_range"
    STRUCTURE = "structure"
    TIMING = "timing"
    STATISTICAL = "statistical"


@dataclass
class Pattern:
    """A matchable pattern"""
    id: str
    name: str
    type: PatternType
    pattern: Any  # bytes, regex, or dict
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MatchResult:
    """Result of a pattern match"""
    pattern_id: str
    pattern_name: str
    matched: bool
    confidence: float
    matched_data: Optional[bytes]
    position: Optional[int]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RegisterPattern:
    """Pattern for register identification"""
    address: int
    name: str
    data_type: str
    scale: float = 1.0
    unit: str = ""
    description: str = ""
    valid_range: Optional[Tuple[float, float]] = None


# ============================================
# BYTE PATTERN MATCHER
# ============================================

class BytePatternMatcher:
    """Match byte patterns in binary data"""

    def __init__(self):
        self.patterns: Dict[str, bytes] = {}
        self.compiled_patterns: Dict[str, re.Pattern] = {}

    def add_pattern(self, name: str, pattern: bytes):
        """Add a byte pattern"""
        self.patterns[name] = pattern
        # Convert to regex for flexible matching
        regex = b''.join(
            b'.' if b == 0xFF else re.escape(bytes([b]))
            for b in pattern
        )
        self.compiled_patterns[name] = re.compile(regex)

    def add_pattern_hex(self, name: str, hex_pattern: str):
        """Add pattern from hex string (use ?? for wildcards)"""
        # Convert hex string to bytes, ?? becomes 0xFF (wildcard)
        hex_clean = hex_pattern.replace(' ', '').replace('??', 'FF')
        pattern = bytes.fromhex(hex_clean)
        self.add_pattern(name, pattern)

    def match(self, data: bytes) -> List[MatchResult]:
        """Find all pattern matches in data"""
        results = []

        for name, pattern in self.patterns.items():
            regex = self.compiled_patterns[name]
            for match in regex.finditer(data):
                results.append(MatchResult(
                    pattern_id=name,
                    pattern_name=name,
                    matched=True,
                    confidence=1.0,
                    matched_data=match.group(),
                    position=match.start()
                ))

        return results

    def match_any(self, data: bytes) -> Optional[MatchResult]:
        """Find first matching pattern"""
        for name, regex in self.compiled_patterns.items():
            match = regex.search(data)
            if match:
                return MatchResult(
                    pattern_id=name,
                    pattern_name=name,
                    matched=True,
                    confidence=1.0,
                    matched_data=match.group(),
                    position=match.start()
                )
        return None


# ============================================
# STRUCTURE PATTERN MATCHER
# ============================================

class StructurePatternMatcher:
    """Match structured data patterns"""

    def __init__(self):
        self.structures: Dict[str, Dict[str, Any]] = {}

    def add_structure(self, name: str, structure: Dict[str, Any]):
        """
        Add a structure pattern.
        Structure format:
        {
            "fields": [
                {"name": "header", "type": "uint8", "value": 0x01},
                {"name": "length", "type": "uint8"},
                {"name": "data", "type": "bytes", "length_field": "length"},
                {"name": "crc", "type": "uint16"}
            ],
            "endian": "big"  # or "little"
        }
        """
        self.structures[name] = structure

    def match(self, data: bytes, structure_name: str) -> Optional[MatchResult]:
        """Match data against a structure"""
        if structure_name not in self.structures:
            return None

        structure = self.structures[structure_name]
        fields = structure.get("fields", [])
        endian = structure.get("endian", "big")
        byte_order = ">" if endian == "big" else "<"

        offset = 0
        parsed = {}
        confidence = 1.0

        try:
            for field in fields:
                field_name = field["name"]
                field_type = field["type"]

                if field_type == "uint8":
                    if offset >= len(data):
                        return None
                    value = data[offset]
                    offset += 1

                    # Check expected value
                    if "value" in field and value != field["value"]:
                        confidence *= 0.5

                elif field_type == "uint16":
                    if offset + 2 > len(data):
                        return None
                    if endian == "big":
                        value = int.from_bytes(data[offset:offset+2], "big")
                    else:
                        value = int.from_bytes(data[offset:offset+2], "little")
                    offset += 2

                elif field_type == "uint32":
                    if offset + 4 > len(data):
                        return None
                    if endian == "big":
                        value = int.from_bytes(data[offset:offset+4], "big")
                    else:
                        value = int.from_bytes(data[offset:offset+4], "little")
                    offset += 4

                elif field_type == "bytes":
                    length = field.get("length", 0)
                    if "length_field" in field:
                        length = parsed.get(field["length_field"], 0)
                    if offset + length > len(data):
                        return None
                    value = data[offset:offset+length]
                    offset += length

                else:
                    continue

                parsed[field_name] = value

            return MatchResult(
                pattern_id=structure_name,
                pattern_name=structure_name,
                matched=True,
                confidence=confidence,
                matched_data=data[:offset],
                position=0,
                metadata={"parsed": parsed}
            )

        except Exception as e:
            logger.debug(f"Structure match failed: {e}")
            return None


# ============================================
# MODBUS PATTERN MATCHER
# ============================================

class ModbusPatternMatcher:
    """Specialized matcher for Modbus protocol"""

    # Modbus function codes
    FUNCTION_CODES = {
        0x01: "Read Coils",
        0x02: "Read Discrete Inputs",
        0x03: "Read Holding Registers",
        0x04: "Read Input Registers",
        0x05: "Write Single Coil",
        0x06: "Write Single Register",
        0x0F: "Write Multiple Coils",
        0x10: "Write Multiple Registers",
        0x17: "Read/Write Multiple Registers",
    }

    def __init__(self):
        self.known_registers: Dict[Tuple[int, int], RegisterPattern] = {}

    def add_register_map(
        self,
        device_id: int,
        registers: List[RegisterPattern]
    ):
        """Add known register patterns for a device"""
        for reg in registers:
            self.known_registers[(device_id, reg.address)] = reg

    def parse_request(self, data: bytes) -> Optional[Dict[str, Any]]:
        """Parse Modbus request"""
        if len(data) < 4:
            return None

        slave_id = data[0]
        function_code = data[1]

        if function_code not in self.FUNCTION_CODES:
            return None

        result = {
            "slave_id": slave_id,
            "function_code": function_code,
            "function_name": self.FUNCTION_CODES[function_code],
        }

        if function_code in [0x01, 0x02, 0x03, 0x04]:
            # Read request
            if len(data) >= 6:
                result["start_address"] = int.from_bytes(data[2:4], "big")
                result["quantity"] = int.from_bytes(data[4:6], "big")

        elif function_code == 0x06:
            # Write single register
            if len(data) >= 6:
                result["address"] = int.from_bytes(data[2:4], "big")
                result["value"] = int.from_bytes(data[4:6], "big")

        elif function_code == 0x10:
            # Write multiple registers
            if len(data) >= 7:
                result["start_address"] = int.from_bytes(data[2:4], "big")
                result["quantity"] = int.from_bytes(data[4:6], "big")
                result["byte_count"] = data[6]

        return result

    def parse_response(
        self,
        data: bytes,
        request: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Parse Modbus response"""
        if len(data) < 3:
            return None

        slave_id = data[0]
        function_code = data[1]

        # Check for error response
        if function_code & 0x80:
            return {
                "slave_id": slave_id,
                "error": True,
                "function_code": function_code & 0x7F,
                "exception_code": data[2] if len(data) > 2 else None,
            }

        result = {
            "slave_id": slave_id,
            "function_code": function_code,
            "error": False,
        }

        if function_code in [0x03, 0x04]:
            # Read holding/input registers response
            if len(data) >= 3:
                byte_count = data[2]
                result["byte_count"] = byte_count
                result["register_count"] = byte_count // 2

                if len(data) >= 3 + byte_count:
                    values = []
                    for i in range(0, byte_count, 2):
                        value = int.from_bytes(data[3+i:5+i], "big")
                        values.append(value)
                    result["values"] = values

                    # Map to known registers if request info available
                    if request and "start_address" in request:
                        result["registers"] = self._map_registers(
                            slave_id,
                            request["start_address"],
                            values
                        )

        return result

    def _map_registers(
        self,
        slave_id: int,
        start_address: int,
        values: List[int]
    ) -> List[Dict[str, Any]]:
        """Map values to known register definitions"""
        mapped = []
        for i, value in enumerate(values):
            address = start_address + i
            key = (slave_id, address)

            if key in self.known_registers:
                reg = self.known_registers[key]
                scaled_value = value * reg.scale
                mapped.append({
                    "address": address,
                    "name": reg.name,
                    "raw_value": value,
                    "value": scaled_value,
                    "unit": reg.unit,
                    "description": reg.description,
                })
            else:
                mapped.append({
                    "address": address,
                    "name": f"Unknown_{address}",
                    "raw_value": value,
                    "value": value,
                })

        return mapped

    def detect_register_type(
        self,
        values: List[int],
        address: int
    ) -> Dict[str, Any]:
        """Attempt to detect register type from values"""
        if not values:
            return {"type": "unknown"}

        # Analyze value patterns
        min_val = min(values)
        max_val = max(values)
        avg_val = sum(values) / len(values)

        result = {
            "address": address,
            "min": min_val,
            "max": max_val,
            "avg": avg_val,
            "variance": sum((v - avg_val) ** 2 for v in values) / len(values),
        }

        # Heuristics for type detection
        if max_val <= 1:
            result["type"] = "boolean"
            result["possible_name"] = "status_flag"

        elif max_val <= 100 and min_val >= 0:
            result["type"] = "percentage"
            result["possible_names"] = ["soc", "efficiency", "load"]

        elif 200 <= avg_val <= 600:
            result["type"] = "voltage"
            result["possible_names"] = ["pack_voltage", "cell_voltage"]
            result["scale"] = 0.1

        elif max_val > 10000:
            result["type"] = "power"
            result["possible_names"] = ["power_w", "energy_wh"]

        elif -100 <= min_val and max_val <= 100:
            result["type"] = "temperature"
            result["possible_names"] = ["temperature", "temp_offset"]

        else:
            result["type"] = "numeric"

        return result


# ============================================
# PATTERN MATCHER SERVICE
# ============================================

class PatternMatcher:
    """Main pattern matching service"""

    def __init__(self):
        self.byte_matcher = BytePatternMatcher()
        self.structure_matcher = StructurePatternMatcher()
        self.modbus_matcher = ModbusPatternMatcher()
        self.patterns: Dict[str, Pattern] = {}

        self._initialize_common_patterns()

    def _initialize_common_patterns(self):
        """Initialize common protocol patterns"""

        # Modbus RTU patterns
        self.byte_matcher.add_pattern_hex("modbus_read_holding", "?? 03 ?? ?? ?? ??")
        self.byte_matcher.add_pattern_hex("modbus_read_input", "?? 04 ?? ?? ?? ??")
        self.byte_matcher.add_pattern_hex("modbus_write_single", "?? 06 ?? ?? ?? ??")
        self.byte_matcher.add_pattern_hex("modbus_write_multiple", "?? 10 ?? ?? ?? ?? ??")

        # Modbus TCP MBAP header
        self.byte_matcher.add_pattern_hex("modbus_tcp_header", "?? ?? 00 00 ?? ??")

        # CAN bus patterns
        self.byte_matcher.add_pattern_hex("can_standard_frame", "?? ?? ?? ?? ?? ?? ?? ??")

        # SunSpec patterns
        self.byte_matcher.add_pattern("sunspec_id", b'SunS')

        # Common BMS patterns
        self.byte_matcher.add_pattern_hex("bms_soc_response", "?? 03 02 ?? ??")

        # Structure patterns
        self.structure_matcher.add_structure("modbus_rtu_request", {
            "fields": [
                {"name": "slave_id", "type": "uint8"},
                {"name": "function_code", "type": "uint8"},
                {"name": "start_address", "type": "uint16"},
                {"name": "quantity", "type": "uint16"},
                {"name": "crc", "type": "uint16"},
            ],
            "endian": "big"
        })

        self.structure_matcher.add_structure("modbus_tcp_request", {
            "fields": [
                {"name": "transaction_id", "type": "uint16"},
                {"name": "protocol_id", "type": "uint16", "value": 0},
                {"name": "length", "type": "uint16"},
                {"name": "unit_id", "type": "uint8"},
                {"name": "function_code", "type": "uint8"},
            ],
            "endian": "big"
        })

    def add_pattern(self, pattern: Pattern):
        """Add a custom pattern"""
        self.patterns[pattern.id] = pattern

        if pattern.type == PatternType.BYTE_SEQUENCE:
            if isinstance(pattern.pattern, bytes):
                self.byte_matcher.add_pattern(pattern.id, pattern.pattern)
            elif isinstance(pattern.pattern, str):
                self.byte_matcher.add_pattern_hex(pattern.id, pattern.pattern)

        elif pattern.type == PatternType.STRUCTURE:
            self.structure_matcher.add_structure(pattern.id, pattern.pattern)

    def match_all(self, data: bytes) -> List[MatchResult]:
        """Find all matching patterns in data"""
        results = []

        # Byte patterns
        results.extend(self.byte_matcher.match(data))

        # Structure patterns
        for name in self.structure_matcher.structures:
            match = self.structure_matcher.match(data, name)
            if match:
                results.append(match)

        return results

    def match_modbus(
        self,
        data: bytes,
        is_request: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Parse Modbus data"""
        if is_request:
            return self.modbus_matcher.parse_request(data)
        return self.modbus_matcher.parse_response(data)

    def add_modbus_register_map(
        self,
        device_id: int,
        registers: List[RegisterPattern]
    ):
        """Add Modbus register definitions"""
        self.modbus_matcher.add_register_map(device_id, registers)

    def detect_modbus_registers(
        self,
        request_response_pairs: List[Tuple[bytes, bytes]]
    ) -> List[Dict[str, Any]]:
        """Detect and analyze unknown Modbus registers"""
        register_data: Dict[int, List[int]] = defaultdict(list)

        for request, response in request_response_pairs:
            req_parsed = self.modbus_matcher.parse_request(request)
            if not req_parsed:
                continue

            resp_parsed = self.modbus_matcher.parse_response(response, req_parsed)
            if not resp_parsed or "values" not in resp_parsed:
                continue

            start_addr = req_parsed.get("start_address", 0)
            for i, value in enumerate(resp_parsed["values"]):
                register_data[start_addr + i].append(value)

        # Analyze each register
        results = []
        for address, values in sorted(register_data.items()):
            analysis = self.modbus_matcher.detect_register_type(values, address)
            results.append(analysis)

        return results


# Singleton instance
pattern_matcher = PatternMatcher()
