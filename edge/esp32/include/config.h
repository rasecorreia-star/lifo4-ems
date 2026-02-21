/**
 * Lifo4 EMS - ESP32 BMS Gateway Configuration
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// DEVICE IDENTIFICATION
// ============================================
#define DEVICE_ID "esp32-bms-001"
#define FIRMWARE_VERSION "1.0.0"
#define DEVICE_TYPE "bms_gateway"

// ============================================
// WIFI CONFIGURATION
// ============================================
#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"
#define WIFI_CONNECT_TIMEOUT 30000  // 30 seconds

// ============================================
// MQTT CONFIGURATION
// ============================================
#define MQTT_SERVER "mqtt.lifo4.com.br"
#define MQTT_PORT 1883
#define MQTT_USER "device"
#define MQTT_PASSWORD "device-password"
#define MQTT_CLIENT_ID DEVICE_ID
#define MQTT_KEEPALIVE 60
#define MQTT_RECONNECT_DELAY 5000

// MQTT Topics
#define MQTT_TOPIC_TELEMETRY "lifo4/bms/" DEVICE_ID "/telemetry"
#define MQTT_TOPIC_STATUS "lifo4/bms/" DEVICE_ID "/status"
#define MQTT_TOPIC_COMMAND "lifo4/bms/" DEVICE_ID "/command"
#define MQTT_TOPIC_CONFIG "lifo4/bms/" DEVICE_ID "/config"
#define MQTT_TOPIC_OTA "lifo4/bms/" DEVICE_ID "/ota"

// ============================================
// MODBUS/RS485 CONFIGURATION
// ============================================
#define RS485_RX_PIN 16
#define RS485_TX_PIN 17
#define RS485_DE_PIN 4  // Driver Enable
#define RS485_BAUD 9600
#define MODBUS_SLAVE_ID 1
#define MODBUS_TIMEOUT 1000

// ============================================
// BMS PROTOCOL
// ============================================
// Supported: "daly", "jbd", "seplos", "pylontech", "custom"
#define BMS_PROTOCOL "daly"
#define BMS_CELL_COUNT 16
#define BMS_TEMP_SENSORS 4

// ============================================
// TELEMETRY SETTINGS
// ============================================
#define TELEMETRY_INTERVAL 5000      // 5 seconds
#define FAST_TELEMETRY_INTERVAL 1000 // 1 second during charge/discharge
#define STATUS_INTERVAL 60000        // 1 minute

// ============================================
// PROTECTION THRESHOLDS
// ============================================
// Cell voltage (LiFePO4)
#define CELL_OVP 3.65f       // Overvoltage protection
#define CELL_OVP_RECOVER 3.55f
#define CELL_UVP 2.5f        // Undervoltage protection
#define CELL_UVP_RECOVER 2.8f

// Temperature
#define CHARGE_OTP 45.0f     // Charge over-temperature
#define CHARGE_UTP 0.0f      // Charge under-temperature
#define DISCHARGE_OTP 55.0f  // Discharge over-temperature
#define DISCHARGE_UTP -20.0f // Discharge under-temperature

// Current (in Amps)
#define MAX_CHARGE_CURRENT 100.0f
#define MAX_DISCHARGE_CURRENT 150.0f

// ============================================
// GPIO PINS
// ============================================
#define LED_STATUS_PIN 2
#define LED_ERROR_PIN 15
#define RELAY_CHARGE_PIN 25
#define RELAY_DISCHARGE_PIN 26
#define CONTACTOR_MAIN_PIN 27
#define EMERGENCY_STOP_PIN 33  // Input, active LOW

// ============================================
// DEBUG
// ============================================
#define DEBUG_SERIAL Serial
#define DEBUG_BAUD 115200
#define DEBUG_ENABLED true

#endif // CONFIG_H
