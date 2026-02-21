/**
 * Ultra Low Power Mode for ESP32
 * Header file for power management functions
 */

#ifndef LOW_POWER_MODE_H
#define LOW_POWER_MODE_H

#include <Arduino.h>
#include <driver/gpio.h>

#ifdef __cplusplus
extern "C" {
#endif

// Power modes
typedef enum {
    POWER_MODE_ACTIVE = 0,      // Full operation (~240mA)
    POWER_MODE_MODEM_SLEEP = 1, // WiFi modem off (~20mA)
    POWER_MODE_LIGHT_SLEEP = 2, // CPU halted (~0.8mA)
    POWER_MODE_DEEP_SLEEP = 3,  // ULP only (~10uA)
    POWER_MODE_HIBERNATION = 4  // RTC off (~5uA)
} power_mode_t;

// Wake sources
typedef enum {
    WAKE_SOURCE_TIMER = 0x01,
    WAKE_SOURCE_EXT0 = 0x02,
    WAKE_SOURCE_EXT1 = 0x04,
    WAKE_SOURCE_TOUCHPAD = 0x08,
    WAKE_SOURCE_ULP = 0x10,
    WAKE_SOURCE_GPIO = 0x20
} wake_source_t;

// Configuration
typedef struct {
    float battery_critical_v;
    float battery_low_v;
    float battery_ok_v;
    uint32_t idle_timeout_ms;
    uint32_t deep_sleep_timeout_ms;
    uint32_t telemetry_interval_ms;
    uint32_t heartbeat_interval_ms;
    gpio_num_t wake_pin;
    gpio_num_t alert_pin;
    bool enable_ulp;
    bool enable_wifi_modem_sleep;
    bool enable_auto_light_sleep;
} power_config_t;

// Initialization
void power_manager_init(power_config_t* config);

// Mode control
bool power_manager_set_mode(power_mode_t mode);
power_mode_t power_manager_get_mode(void);

// Activity tracking
void power_manager_activity(void);

// Telemetry buffering
bool power_manager_buffer_telemetry(uint8_t* data, uint8_t len);
uint8_t power_manager_get_buffered_telemetry(uint8_t* buffer, uint8_t max_len);
void power_manager_clear_buffer(void);

// Alert handling
void power_manager_set_alert(bool alert);
bool power_manager_has_alert(void);

// Main loop processing
void power_manager_process(void);

// Statistics
void power_manager_get_stats(uint32_t* wake_count, float* battery_v,
                              uint32_t* uptime_ms, power_mode_t* mode);
const char* power_manager_get_wake_reason(void);
float power_manager_estimate_current_ma(void);

// Utilities
const char* power_mode_to_string(power_mode_t mode);

#ifdef __cplusplus
}
#endif

#endif // LOW_POWER_MODE_H
