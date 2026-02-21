"""
Battery Models for Digital Twin
Provides parameterized models for different LiFePO4 cell configurations
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class CellParameters:
    """Parameters for a single battery cell"""
    manufacturer: str
    model: str
    chemistry: str = "LiFePO4"

    # Electrical parameters
    nominal_voltage: float = 3.2  # V
    max_voltage: float = 3.65  # V
    min_voltage: float = 2.5  # V
    nominal_capacity: float = 100.0  # Ah

    # Internal resistance
    dcr_charge: float = 0.001  # Ohms at 50% SOC
    dcr_discharge: float = 0.0012  # Ohms at 50% SOC

    # Thermal parameters
    thermal_resistance: float = 10.0  # K/W
    thermal_capacitance: float = 500.0  # J/K
    max_temperature: float = 60.0  # C
    min_temperature: float = -20.0  # C

    # Cycle life parameters
    rated_cycles: int = 6000  # at 80% DOD
    eol_capacity: float = 0.8  # 80% of nominal

    # C-rate limits
    max_charge_rate: float = 1.0  # C
    max_discharge_rate: float = 2.0  # C
    continuous_charge_rate: float = 0.5  # C
    continuous_discharge_rate: float = 1.0  # C


@dataclass
class PackConfiguration:
    """Battery pack configuration"""
    cells_in_series: int = 16  # For 51.2V nominal
    cells_in_parallel: int = 1
    modules_in_series: int = 1
    modules_in_parallel: int = 1
    balancing_type: str = "passive"  # passive, active
    bms_type: str = "centralized"  # centralized, distributed


@dataclass
class BatteryModel:
    """Complete battery model with cells and pack configuration"""
    id: str
    name: str
    cell: CellParameters
    pack: PackConfiguration

    # Derived parameters
    @property
    def nominal_voltage(self) -> float:
        return self.cell.nominal_voltage * self.pack.cells_in_series

    @property
    def max_voltage(self) -> float:
        return self.cell.max_voltage * self.pack.cells_in_series

    @property
    def min_voltage(self) -> float:
        return self.cell.min_voltage * self.pack.cells_in_series

    @property
    def nominal_capacity(self) -> float:
        return self.cell.nominal_capacity * self.pack.cells_in_parallel

    @property
    def energy_capacity(self) -> float:
        """Energy capacity in kWh"""
        return self.nominal_voltage * self.nominal_capacity / 1000

    @property
    def total_cells(self) -> int:
        return (
            self.pack.cells_in_series *
            self.pack.cells_in_parallel *
            self.pack.modules_in_series *
            self.pack.modules_in_parallel
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "cell": self.cell.__dict__,
            "pack": self.pack.__dict__,
            "derived": {
                "nominal_voltage": self.nominal_voltage,
                "max_voltage": self.max_voltage,
                "min_voltage": self.min_voltage,
                "nominal_capacity": self.nominal_capacity,
                "energy_capacity": self.energy_capacity,
                "total_cells": self.total_cells,
            }
        }


class LiFePO4Model:
    """
    LiFePO4 specific battery model with OCV-SOC curve and degradation
    """

    def __init__(self, battery_model: BatteryModel):
        self.model = battery_model
        self.cell = battery_model.cell
        self.pack = battery_model.pack

        # OCV-SOC lookup table (typical LiFePO4)
        self._soc_points = np.array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
        self._ocv_points = np.array([2.5, 3.0, 3.15, 3.2, 3.22, 3.25, 3.27, 3.3, 3.32, 3.35, 3.65])

        # Resistance vs SOC (typical behavior)
        self._resistance_soc = np.array([0, 0.1, 0.2, 0.5, 0.8, 0.9, 1.0])
        self._resistance_factor = np.array([1.5, 1.2, 1.0, 1.0, 1.0, 1.2, 1.5])

        # Temperature coefficient
        self._temp_ref = 25.0  # Reference temperature
        self._temp_coefficient = 0.003  # Per degree C deviation

    def get_ocv(self, soc: float) -> float:
        """Get open circuit voltage for given SOC"""
        soc = np.clip(soc, 0, 1)
        cell_ocv = np.interp(soc, self._soc_points, self._ocv_points)
        return cell_ocv * self.pack.cells_in_series

    def get_ocv_curve(self, points: int = 100) -> Dict[str, List[float]]:
        """Get full OCV-SOC curve"""
        soc = np.linspace(0, 1, points)
        ocv = [self.get_ocv(s) for s in soc]
        return {"soc": soc.tolist(), "ocv": ocv}

    def get_resistance(
        self,
        soc: float,
        temperature: float = 25.0,
        charging: bool = False
    ) -> float:
        """Get internal resistance for given conditions"""
        soc = np.clip(soc, 0, 1)

        # Base resistance
        base_r = self.cell.dcr_charge if charging else self.cell.dcr_discharge

        # SOC factor
        soc_factor = np.interp(soc, self._resistance_soc, self._resistance_factor)

        # Temperature factor (resistance increases at low/high temps)
        temp_deviation = abs(temperature - self._temp_ref)
        temp_factor = 1.0 + self._temp_coefficient * temp_deviation

        # Pack resistance
        cell_r = base_r * soc_factor * temp_factor
        pack_r = (cell_r * self.pack.cells_in_series) / self.pack.cells_in_parallel

        return pack_r

    def get_terminal_voltage(
        self,
        soc: float,
        current: float,
        temperature: float = 25.0
    ) -> float:
        """Calculate terminal voltage under load"""
        ocv = self.get_ocv(soc)
        resistance = self.get_resistance(soc, temperature, charging=(current > 0))
        ir_drop = current * resistance
        return ocv - ir_drop

    def calculate_soc_from_voltage(
        self,
        voltage: float,
        current: float = 0,
        temperature: float = 25.0
    ) -> float:
        """Estimate SOC from terminal voltage (inverse OCV)"""
        # Account for IR drop if current is flowing
        if abs(current) > 0.1:
            # Iterative estimation
            soc_estimate = 0.5
            for _ in range(5):
                r = self.get_resistance(soc_estimate, temperature, charging=(current > 0))
                ocv_estimate = voltage + current * r
                cell_ocv = ocv_estimate / self.pack.cells_in_series
                soc_estimate = np.interp(cell_ocv, self._ocv_points, self._soc_points)
            return np.clip(soc_estimate, 0, 1)
        else:
            cell_ocv = voltage / self.pack.cells_in_series
            return np.clip(np.interp(cell_ocv, self._ocv_points, self._soc_points), 0, 1)

    def calculate_degradation(
        self,
        cycles: int,
        avg_dod: float = 0.8,
        avg_temperature: float = 25.0,
        avg_c_rate: float = 0.5
    ) -> Dict[str, float]:
        """
        Calculate capacity degradation based on cycle count and conditions

        Returns:
            Dictionary with soh, capacity_remaining, resistance_increase
        """
        # Base degradation rate (linear approximation for LiFePO4)
        base_degradation_rate = (1 - self.cell.eol_capacity) / self.cell.rated_cycles

        # Stress factors
        # DOD factor - higher DOD accelerates degradation
        dod_factor = 0.5 + avg_dod

        # Temperature factor - optimal at 25C
        if avg_temperature < 10:
            temp_factor = 1.5  # Cold accelerates aging (lithium plating risk)
        elif avg_temperature > 40:
            temp_factor = 1.0 + 0.05 * (avg_temperature - 40)  # Heat accelerates
        else:
            temp_factor = 1.0

        # C-rate factor
        c_rate_factor = 1.0 + 0.2 * max(0, avg_c_rate - 0.5)

        # Total degradation
        effective_cycles = cycles * dod_factor * temp_factor * c_rate_factor
        capacity_loss = effective_cycles * base_degradation_rate
        soh = max(0, 1 - capacity_loss)

        # Resistance increase (typically increases as capacity fades)
        resistance_increase = 1.0 + (1 - soh) * 0.5

        return {
            "soh": soh,
            "capacity_remaining_ah": self.model.nominal_capacity * soh,
            "energy_remaining_kwh": self.model.energy_capacity * soh,
            "resistance_increase_factor": resistance_increase,
            "effective_cycles": effective_cycles,
            "stress_factors": {
                "dod": dod_factor,
                "temperature": temp_factor,
                "c_rate": c_rate_factor,
            }
        }

    def get_thermal_model(
        self,
        power_dissipation: float,
        ambient_temperature: float,
        current_temperature: float,
        dt: float
    ) -> float:
        """
        Simple thermal model - calculate new temperature

        Args:
            power_dissipation: Heat generated (W)
            ambient_temperature: Ambient temp (C)
            current_temperature: Current battery temp (C)
            dt: Time step (s)

        Returns:
            New temperature (C)
        """
        # Heat added
        heat_in = power_dissipation * dt

        # Heat lost to ambient
        temp_diff = current_temperature - ambient_temperature
        heat_out = temp_diff / self.cell.thermal_resistance * dt

        # Temperature change
        delta_temp = (heat_in - heat_out) / self.cell.thermal_capacitance

        new_temp = current_temperature + delta_temp
        return np.clip(new_temp, self.cell.min_temperature, self.cell.max_temperature + 10)


class BatteryModelFactory:
    """Factory for creating battery models with predefined configurations"""

    # Predefined cell libraries
    CELL_LIBRARY = {
        "eve_lf280k": CellParameters(
            manufacturer="EVE",
            model="LF280K",
            nominal_capacity=280.0,
            dcr_charge=0.00025,
            dcr_discharge=0.0003,
            max_charge_rate=0.5,
            max_discharge_rate=1.0,
            rated_cycles=6000,
        ),
        "catl_lifepo4_100ah": CellParameters(
            manufacturer="CATL",
            model="LiFePO4-100Ah",
            nominal_capacity=100.0,
            dcr_charge=0.0008,
            dcr_discharge=0.001,
            max_charge_rate=1.0,
            max_discharge_rate=2.0,
            rated_cycles=4000,
        ),
        "byd_blade": CellParameters(
            manufacturer="BYD",
            model="Blade",
            nominal_capacity=138.0,
            nominal_voltage=3.2,
            dcr_charge=0.0005,
            dcr_discharge=0.0006,
            max_charge_rate=1.0,
            max_discharge_rate=1.5,
            rated_cycles=5000,
        ),
        "gotion_lifepo4_200ah": CellParameters(
            manufacturer="Gotion",
            model="LiFePO4-200Ah",
            nominal_capacity=200.0,
            dcr_charge=0.0004,
            dcr_discharge=0.0005,
            max_charge_rate=0.5,
            max_discharge_rate=1.0,
            rated_cycles=6000,
        ),
        "lishen_lifepo4_100ah": CellParameters(
            manufacturer="Lishen",
            model="LF100LA",
            nominal_capacity=100.0,
            dcr_charge=0.0006,
            dcr_discharge=0.0008,
            max_charge_rate=1.0,
            max_discharge_rate=2.0,
            rated_cycles=5000,
        ),
    }

    # Predefined pack configurations
    PACK_LIBRARY = {
        "48v_5kwh": PackConfiguration(
            cells_in_series=16,
            cells_in_parallel=1,
            modules_in_series=1,
            modules_in_parallel=1,
        ),
        "48v_15kwh": PackConfiguration(
            cells_in_series=16,
            cells_in_parallel=3,
            modules_in_series=1,
            modules_in_parallel=1,
        ),
        "400v_industrial": PackConfiguration(
            cells_in_series=128,
            cells_in_parallel=2,
            modules_in_series=8,
            modules_in_parallel=1,
        ),
        "800v_utility": PackConfiguration(
            cells_in_series=256,
            cells_in_parallel=4,
            modules_in_series=16,
            modules_in_parallel=1,
        ),
    }

    @classmethod
    def create_model(
        cls,
        model_id: str,
        name: str,
        cell_type: str = "eve_lf280k",
        pack_type: str = "48v_5kwh",
        custom_cell: Optional[CellParameters] = None,
        custom_pack: Optional[PackConfiguration] = None
    ) -> BatteryModel:
        """
        Create a battery model from predefined or custom parameters

        Args:
            model_id: Unique identifier for the model
            name: Human-readable name
            cell_type: Key from CELL_LIBRARY or 'custom'
            pack_type: Key from PACK_LIBRARY or 'custom'
            custom_cell: Custom cell parameters (if cell_type='custom')
            custom_pack: Custom pack configuration (if pack_type='custom')

        Returns:
            BatteryModel instance
        """
        # Get cell parameters
        if custom_cell:
            cell = custom_cell
        elif cell_type in cls.CELL_LIBRARY:
            cell = cls.CELL_LIBRARY[cell_type]
        else:
            raise ValueError(f"Unknown cell type: {cell_type}")

        # Get pack configuration
        if custom_pack:
            pack = custom_pack
        elif pack_type in cls.PACK_LIBRARY:
            pack = cls.PACK_LIBRARY[pack_type]
        else:
            raise ValueError(f"Unknown pack type: {pack_type}")

        return BatteryModel(
            id=model_id,
            name=name,
            cell=cell,
            pack=pack
        )

    @classmethod
    def create_lifepo4_model(cls, battery_model: BatteryModel) -> LiFePO4Model:
        """Create a LiFePO4 model wrapper for simulation"""
        return LiFePO4Model(battery_model)

    @classmethod
    def list_available_cells(cls) -> List[str]:
        """List available cell types"""
        return list(cls.CELL_LIBRARY.keys())

    @classmethod
    def list_available_packs(cls) -> List[str]:
        """List available pack configurations"""
        return list(cls.PACK_LIBRARY.keys())

    @classmethod
    def get_cell_info(cls, cell_type: str) -> Optional[Dict[str, Any]]:
        """Get cell parameters as dictionary"""
        if cell_type in cls.CELL_LIBRARY:
            return cls.CELL_LIBRARY[cell_type].__dict__
        return None

    @classmethod
    def get_pack_info(cls, pack_type: str) -> Optional[Dict[str, Any]]:
        """Get pack configuration as dictionary"""
        if pack_type in cls.PACK_LIBRARY:
            return cls.PACK_LIBRARY[pack_type].__dict__
        return None
