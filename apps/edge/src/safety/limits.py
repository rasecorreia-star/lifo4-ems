"""
HARDCODED safety limits for LiFePO4 BESS.
These constants CANNOT be changed remotely — only via code deployment.
This is intentional: safety limits must never be overridable from cloud.
"""

# Cell voltage limits (LiFePO4 chemistry)
CELL_VOLTAGE_MIN_V: float = 2.5       # Emergency discharge stop
CELL_VOLTAGE_MAX_V: float = 3.65      # Emergency charge stop
CELL_DELTA_MAX_MV: float = 100.0      # Max imbalance between cells

# Pack temperature limits
PACK_TEMP_MIN_C: float = -10.0        # Stop all operations
PACK_TEMP_MAX_C: float = 55.0         # Emergency stop
PACK_TEMP_WARN_C: float = 45.0        # Reduce power to 50%

# State of Charge limits
SOC_ABSOLUTE_MIN_PCT: float = 5.0     # Emergency discharge stop
SOC_ABSOLUTE_MAX_PCT: float = 98.0    # Emergency charge stop

# Grid limits for black start detection
GRID_FREQ_MIN_HZ: float = 49.0        # Below: grid failure
GRID_FREQ_MAX_HZ: float = 51.0        # Above: grid anomaly
GRID_VOLTAGE_MIN_V: float = 180.0     # Below: grid failure
GRID_VOLTAGE_MAX_V: float = 265.0     # Above: grid overvoltage

# Black start thresholds (tighter than grid limits)
# F3: spec defines 180V for failure detection (was incorrectly 190V)
BLACKSTART_FREQ_MIN_HZ: float = 49.5       # Trigger black start detection (< 49.5Hz)
BLACKSTART_VOLTAGE_MIN_V: float = 180.0    # Trigger failure detection — spec: 180V
# F5: separate restore threshold prevents chattering (180V fail vs 190V restore deadband)
BLACKSTART_VOLTAGE_RESTORE_V: float = 210.0  # Grid recovery confirmed only above this
BLACKSTART_CONFIRM_READINGS: int = 2          # Consecutive readings to confirm
