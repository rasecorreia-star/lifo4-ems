/**
 * Ultra Low Power Mode for ESP32
 * Implements aggressive power saving for BESS edge devices
 *
 * Power Modes:
 * - ACTIVE: Full operation (~240mA)
 * - MODEM_SLEEP: WiFi modem off (~20mA)
 * - LIGHT_SLEEP: CPU halted, peripherals active (~0.8mA)
 * - DEEP_SLEEP: ULP only, RTC memory retained (~10uA)
 * - HIBERNATION: RTC off (~5uA)
 */

#include <Arduino.h>
#include <esp_sleep.h>
#include <esp_wifi.h>
#include <esp_bt.h>
#include <esp_pm.h>
#include <driver/rtc_io.h>
#include <driver/adc.h>
#include <driver/uart.h>
#include <soc/rtc.h>
#include <esp32/ulp.h>

// Power mode definitions
typedef enum {
    POWER_MODE_ACTIVE = 0,
    POWER_MODE_MODEM_SLEEP = 1,
    POWER_MODE_LIGHT_SLEEP = 2,
    POWER_MODE_DEEP_SLEEP = 3,
    POWER_MODE_HIBERNATION = 4
} power_mode_t;

// Wake up sources
typedef enum {
    WAKE_SOURCE_TIMER = 0x01,
    WAKE_SOURCE_EXT0 = 0x02,
    WAKE_SOURCE_EXT1 = 0x04,
    WAKE_SOURCE_TOUCHPAD = 0x08,
    WAKE_SOURCE_ULP = 0x10,
    WAKE_SOURCE_GPIO = 0x20
} wake_source_t;

// Configuration structure stored in RTC memory
RTC_DATA_ATTR struct {
    power_mode_t current_mode;
    uint32_t sleep_duration_ms;
    uint32_t wake_count;
    uint32_t last_active_time;
    float battery_voltage;
    bool critical_alert_pending;
    uint8_t telemetry_buffer[256];
    uint8_t buffer_index;
    uint32_t checksum;
} rtc_state;

// Power manager configuration
typedef struct {
    // Thresholds
    float battery_critical_v;
    float battery_low_v;
    float battery_ok_v;

    // Timing
    uint32_t idle_timeout_ms;
    uint32_t deep_sleep_timeout_ms;
    uint32_t telemetry_interval_ms;
    uint32_t heartbeat_interval_ms;

    // Wake pins
    gpio_num_t wake_pin;
    gpio_num_t alert_pin;

    // Features
    bool enable_ulp;
    bool enable_wifi_modem_sleep;
    bool enable_auto_light_sleep;
} power_config_t;

// Default configuration
static power_config_t config = {
    .battery_critical_v = 3.0,
    .battery_low_v = 3.3,
    .battery_ok_v = 3.7,
    .idle_timeout_ms = 30000,
    .deep_sleep_timeout_ms = 300000,
    .telemetry_interval_ms = 60000,
    .heartbeat_interval_ms = 300000,
    .wake_pin = GPIO_NUM_33,
    .alert_pin = GPIO_NUM_32,
    .enable_ulp = true,
    .enable_wifi_modem_sleep = true,
    .enable_auto_light_sleep = true
};

// Current state
static power_mode_t current_mode = POWER_MODE_ACTIVE;
static uint32_t last_activity_time = 0;
static bool initialized = false;

// Forward declarations
static void configure_gpio_for_sleep();
static void restore_gpio_after_wake();
static void configure_ulp_program();
static float read_battery_voltage();
static uint32_t calculate_checksum();
static void send_minimal_telemetry();

/**
 * Initialize power management
 */
void power_manager_init(power_config_t* user_config) {
    if (user_config != NULL) {
        memcpy(&config, user_config, sizeof(power_config_t));
    }

    // Check if waking from deep sleep
    esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();

    if (wakeup_reason != ESP_SLEEP_WAKEUP_UNDEFINED) {
        // Validate RTC data
        if (calculate_checksum() == rtc_state.checksum) {
            rtc_state.wake_count++;
            Serial.printf("[PWR] Woke up (count: %lu, reason: %d)\n",
                         rtc_state.wake_count, wakeup_reason);
        } else {
            // Corrupted, reset
            memset(&rtc_state, 0, sizeof(rtc_state));
            Serial.println("[PWR] RTC state corrupted, reset");
        }
    } else {
        // Fresh boot
        memset(&rtc_state, 0, sizeof(rtc_state));
        Serial.println("[PWR] Fresh boot, initializing power manager");
    }

    // Configure power management
    esp_pm_config_esp32_t pm_config = {
        .max_freq_mhz = 240,
        .min_freq_mhz = 80,
        .light_sleep_enable = config.enable_auto_light_sleep
    };
    esp_pm_configure(&pm_config);

    // Disable unused peripherals
    adc_power_release();

    // Configure wake pin
    rtc_gpio_init(config.wake_pin);
    rtc_gpio_set_direction(config.wake_pin, RTC_GPIO_MODE_INPUT_ONLY);
    rtc_gpio_pullup_en(config.wake_pin);

    // Initialize ULP if enabled
    if (config.enable_ulp) {
        configure_ulp_program();
    }

    last_activity_time = millis();
    initialized = true;

    Serial.println("[PWR] Power manager initialized");
}

/**
 * Set power mode
 */
bool power_manager_set_mode(power_mode_t mode) {
    if (mode == current_mode) {
        return true;
    }

    Serial.printf("[PWR] Transitioning from mode %d to %d\n", current_mode, mode);

    switch (mode) {
        case POWER_MODE_ACTIVE:
            // Restore full operation
            restore_gpio_after_wake();
            if (config.enable_wifi_modem_sleep) {
                esp_wifi_set_ps(WIFI_PS_NONE);
            }
            break;

        case POWER_MODE_MODEM_SLEEP:
            // Enable WiFi modem sleep
            esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
            break;

        case POWER_MODE_LIGHT_SLEEP:
            // Configure for light sleep
            configure_gpio_for_sleep();
            esp_wifi_set_ps(WIFI_PS_MAX_MODEM);

            // Set wake sources
            esp_sleep_enable_timer_wakeup(config.telemetry_interval_ms * 1000);
            esp_sleep_enable_ext0_wakeup(config.wake_pin, 0);

            // Enter light sleep
            esp_light_sleep_start();

            // Returned from light sleep
            restore_gpio_after_wake();
            last_activity_time = millis();
            break;

        case POWER_MODE_DEEP_SLEEP:
            // Save state before deep sleep
            rtc_state.current_mode = mode;
            rtc_state.last_active_time = millis();
            rtc_state.battery_voltage = read_battery_voltage();
            rtc_state.checksum = calculate_checksum();

            // Send minimal telemetry
            send_minimal_telemetry();

            // Configure for deep sleep
            configure_gpio_for_sleep();

            // Disable WiFi and BT
            esp_wifi_stop();
            esp_bt_controller_disable();

            // Set wake sources
            esp_sleep_enable_timer_wakeup(config.heartbeat_interval_ms * 1000);
            esp_sleep_enable_ext0_wakeup(config.wake_pin, 0);

            if (config.enable_ulp) {
                esp_sleep_enable_ulp_wakeup();
            }

            Serial.println("[PWR] Entering deep sleep...");
            Serial.flush();

            // Enter deep sleep
            esp_deep_sleep_start();
            // Never returns
            break;

        case POWER_MODE_HIBERNATION:
            // Most aggressive power saving
            rtc_state.current_mode = mode;
            rtc_state.checksum = calculate_checksum();

            // Disable all wake sources except timer and ext0
            esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
            esp_sleep_enable_timer_wakeup(config.heartbeat_interval_ms * 1000 * 10);  // 10x longer
            esp_sleep_enable_ext0_wakeup(config.wake_pin, 0);

            // Isolate GPIO to prevent current leakage
            for (int i = 0; i < GPIO_NUM_MAX; i++) {
                if (i != config.wake_pin && rtc_gpio_is_valid_gpio((gpio_num_t)i)) {
                    rtc_gpio_isolate((gpio_num_t)i);
                }
            }

            Serial.println("[PWR] Entering hibernation...");
            Serial.flush();

            esp_deep_sleep_start();
            break;
    }

    current_mode = mode;
    return true;
}

/**
 * Get current power mode
 */
power_mode_t power_manager_get_mode() {
    return current_mode;
}

/**
 * Register activity (resets idle timer)
 */
void power_manager_activity() {
    last_activity_time = millis();

    // If in low power mode, transition to active
    if (current_mode != POWER_MODE_ACTIVE) {
        power_manager_set_mode(POWER_MODE_ACTIVE);
    }
}

/**
 * Buffer telemetry for batch send on wake
 */
bool power_manager_buffer_telemetry(uint8_t* data, uint8_t len) {
    if (rtc_state.buffer_index + len >= sizeof(rtc_state.telemetry_buffer)) {
        return false;  // Buffer full
    }

    memcpy(&rtc_state.telemetry_buffer[rtc_state.buffer_index], data, len);
    rtc_state.buffer_index += len;

    return true;
}

/**
 * Get buffered telemetry
 */
uint8_t power_manager_get_buffered_telemetry(uint8_t* buffer, uint8_t max_len) {
    uint8_t len = min(rtc_state.buffer_index, max_len);
    memcpy(buffer, rtc_state.telemetry_buffer, len);
    return len;
}

/**
 * Clear telemetry buffer
 */
void power_manager_clear_buffer() {
    rtc_state.buffer_index = 0;
    memset(rtc_state.telemetry_buffer, 0, sizeof(rtc_state.telemetry_buffer));
}

/**
 * Set critical alert flag (will wake device)
 */
void power_manager_set_alert(bool alert) {
    rtc_state.critical_alert_pending = alert;

    if (alert && current_mode >= POWER_MODE_LIGHT_SLEEP) {
        // Wake up immediately for critical alerts
        power_manager_set_mode(POWER_MODE_ACTIVE);
    }
}

/**
 * Check if there's a pending alert
 */
bool power_manager_has_alert() {
    return rtc_state.critical_alert_pending;
}

/**
 * Process power management (call from main loop)
 */
void power_manager_process() {
    if (!initialized) {
        return;
    }

    uint32_t idle_time = millis() - last_activity_time;
    float battery_v = read_battery_voltage();

    // Critical battery - hibernate immediately
    if (battery_v < config.battery_critical_v) {
        Serial.printf("[PWR] Critical battery: %.2fV, hibernating!\n", battery_v);
        power_manager_set_mode(POWER_MODE_HIBERNATION);
        return;
    }

    // Low battery - more aggressive power saving
    if (battery_v < config.battery_low_v) {
        if (idle_time > config.idle_timeout_ms / 2) {
            power_manager_set_mode(POWER_MODE_DEEP_SLEEP);
            return;
        }
    }

    // Normal operation - gradual power reduction
    if (current_mode == POWER_MODE_ACTIVE) {
        if (idle_time > config.deep_sleep_timeout_ms) {
            power_manager_set_mode(POWER_MODE_DEEP_SLEEP);
        } else if (idle_time > config.idle_timeout_ms) {
            power_manager_set_mode(POWER_MODE_LIGHT_SLEEP);
        } else if (idle_time > config.idle_timeout_ms / 2) {
            power_manager_set_mode(POWER_MODE_MODEM_SLEEP);
        }
    }
}

/**
 * Get power statistics
 */
void power_manager_get_stats(uint32_t* wake_count, float* battery_v,
                              uint32_t* uptime_ms, power_mode_t* mode) {
    if (wake_count) *wake_count = rtc_state.wake_count;
    if (battery_v) *battery_v = read_battery_voltage();
    if (uptime_ms) *uptime_ms = millis();
    if (mode) *mode = current_mode;
}

/**
 * Get wake reason as string
 */
const char* power_manager_get_wake_reason() {
    esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();

    switch (cause) {
        case ESP_SLEEP_WAKEUP_TIMER: return "timer";
        case ESP_SLEEP_WAKEUP_EXT0: return "ext0_pin";
        case ESP_SLEEP_WAKEUP_EXT1: return "ext1_pins";
        case ESP_SLEEP_WAKEUP_TOUCHPAD: return "touchpad";
        case ESP_SLEEP_WAKEUP_ULP: return "ulp";
        case ESP_SLEEP_WAKEUP_GPIO: return "gpio";
        default: return "power_on";
    }
}

/**
 * Estimate current consumption
 */
float power_manager_estimate_current_ma() {
    switch (current_mode) {
        case POWER_MODE_ACTIVE: return 240.0;
        case POWER_MODE_MODEM_SLEEP: return 20.0;
        case POWER_MODE_LIGHT_SLEEP: return 0.8;
        case POWER_MODE_DEEP_SLEEP: return 0.01;
        case POWER_MODE_HIBERNATION: return 0.005;
        default: return 240.0;
    }
}

// ============== Private functions ==============

static void configure_gpio_for_sleep() {
    // Disable UART during sleep to save power
    uart_driver_delete(UART_NUM_0);

    // Configure unused pins as inputs with pull-down
    // This prevents floating pins from consuming power
    const gpio_num_t unused_pins[] = {
        GPIO_NUM_0, GPIO_NUM_2, GPIO_NUM_4, GPIO_NUM_12, GPIO_NUM_13,
        GPIO_NUM_14, GPIO_NUM_15, GPIO_NUM_25, GPIO_NUM_26, GPIO_NUM_27
    };

    for (int i = 0; i < sizeof(unused_pins)/sizeof(unused_pins[0]); i++) {
        gpio_set_direction(unused_pins[i], GPIO_MODE_INPUT);
        gpio_pulldown_en(unused_pins[i]);
    }
}

static void restore_gpio_after_wake() {
    // Reinitialize UART
    uart_driver_install(UART_NUM_0, 256, 0, 0, NULL, 0);

    // Restore GPIO configurations as needed
    // Application-specific GPIO setup should be called here
}

static void configure_ulp_program() {
    // ULP (Ultra Low Power) coprocessor program
    // This runs while main CPU is in deep sleep
    // Can monitor GPIO, ADC, and wake main CPU

    // Simple program: check alert pin periodically
    const ulp_insn_t ulp_program[] = {
        // Entry point
        I_MOVI(R3, 0),                      // Counter

        // Check GPIO
        M_LABEL(1),
        I_RD_REG(RTC_GPIO_IN_REG,
                 RTC_GPIO_IN_NEXT_S + config.alert_pin,
                 RTC_GPIO_IN_NEXT_S + config.alert_pin),
        M_BGE(2, 1),                         // If high, continue sleeping
        I_WAKE(),                            // If low, wake main CPU
        I_HALT(),

        // Continue sleep
        M_LABEL(2),
        I_ADDI(R3, R3, 1),                  // Increment counter
        M_BL(1, 1000),                      // Loop 1000 times
        I_HALT(),                           // Then halt
    };

    size_t size = sizeof(ulp_program) / sizeof(ulp_insn_t);
    ulp_process_macros_and_load(0, ulp_program, &size);
    ulp_set_wakeup_period(0, 100000);       // 100ms period
}

static float read_battery_voltage() {
    // Read battery voltage via ADC
    // Assuming voltage divider on GPIO34 (ADC1_CH6)
    adc1_config_width(ADC_WIDTH_BIT_12);
    adc1_config_channel_atten(ADC1_CHANNEL_6, ADC_ATTEN_DB_11);

    int raw = adc1_get_raw(ADC1_CHANNEL_6);

    // Convert to voltage (assuming 2:1 voltage divider)
    // Reference voltage: 3.3V, 12-bit ADC: 4096
    float voltage = (raw / 4096.0) * 3.3 * 2.0;

    return voltage;
}

static uint32_t calculate_checksum() {
    // Simple checksum of RTC state
    uint32_t sum = 0;
    uint8_t* ptr = (uint8_t*)&rtc_state;

    // Exclude checksum field itself
    for (int i = 0; i < offsetof(typeof(rtc_state), checksum); i++) {
        sum += ptr[i];
    }

    return sum;
}

static void send_minimal_telemetry() {
    // Send critical data before sleeping
    // This should be implemented based on your communication protocol

    Serial.printf("[PWR] Sending pre-sleep telemetry: battery=%.2fV, mode=%d\n",
                  rtc_state.battery_voltage, rtc_state.current_mode);
    Serial.flush();

    // TODO: Implement actual MQTT/HTTP send if WiFi is available
}

// ============== Power mode strings ==============

const char* power_mode_to_string(power_mode_t mode) {
    switch (mode) {
        case POWER_MODE_ACTIVE: return "ACTIVE";
        case POWER_MODE_MODEM_SLEEP: return "MODEM_SLEEP";
        case POWER_MODE_LIGHT_SLEEP: return "LIGHT_SLEEP";
        case POWER_MODE_DEEP_SLEEP: return "DEEP_SLEEP";
        case POWER_MODE_HIBERNATION: return "HIBERNATION";
        default: return "UNKNOWN";
    }
}
