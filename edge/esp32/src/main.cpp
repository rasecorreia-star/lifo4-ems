/**
 * Lifo4 EMS - ESP32 BMS Gateway
 *
 * Reads BMS data via Modbus/RS485 and publishes to MQTT
 * Receives commands from cloud and controls relays
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>
#include "config.h"

// ============================================
// GLOBAL OBJECTS
// ============================================
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
SoftwareSerial rs485Serial(RS485_RX_PIN, RS485_TX_PIN);

// ============================================
// STATE VARIABLES
// ============================================
struct BMSData {
    float totalVoltage;
    float current;
    float power;
    float soc;
    float soh;
    float cellVoltages[BMS_CELL_COUNT];
    float temperatures[BMS_TEMP_SENSORS];
    float minCellVoltage;
    float maxCellVoltage;
    float avgCellVoltage;
    float cellDelta;
    float minTemp;
    float maxTemp;
    float avgTemp;
    uint32_t cycleCount;
    bool isCharging;
    bool isDischarging;
    bool isBalancing;
    uint8_t alarms;
    uint8_t warnings;
    unsigned long lastUpdate;
};

BMSData bmsData;

struct SystemState {
    bool wifiConnected;
    bool mqttConnected;
    bool bmsOnline;
    bool chargeEnabled;
    bool dischargeEnabled;
    bool emergencyStop;
    String operationMode;  // auto, manual, maintenance
    unsigned long uptime;
};

SystemState systemState;

// Timing
unsigned long lastTelemetry = 0;
unsigned long lastStatus = 0;
unsigned long lastBmsRead = 0;

// ============================================
// FUNCTION DECLARATIONS
// ============================================
void setupWiFi();
void setupMQTT();
void setupRS485();
void setupGPIO();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void readBMS();
void publishTelemetry();
void publishStatus();
void processCommand(JsonDocument& doc);
void setChargeRelay(bool state);
void setDischargeRelay(bool state);
void emergencyShutdown(const char* reason);
void blinkLED(int pin, int times, int delayMs);

// ============================================
// SETUP
// ============================================
void setup() {
    // Initialize serial for debug
    DEBUG_SERIAL.begin(DEBUG_BAUD);
    DEBUG_SERIAL.println("\n\n=== Lifo4 EMS - ESP32 BMS Gateway ===");
    DEBUG_SERIAL.printf("Device ID: %s\n", DEVICE_ID);
    DEBUG_SERIAL.printf("Firmware: %s\n", FIRMWARE_VERSION);

    // Initialize GPIO
    setupGPIO();
    blinkLED(LED_STATUS_PIN, 3, 200);

    // Initialize RS485 for BMS communication
    setupRS485();

    // Connect to WiFi
    setupWiFi();

    // Setup MQTT
    setupMQTT();

    // Initialize state
    systemState.operationMode = "auto";
    systemState.chargeEnabled = true;
    systemState.dischargeEnabled = true;
    systemState.emergencyStop = false;

    DEBUG_SERIAL.println("Setup complete!");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
    unsigned long now = millis();
    systemState.uptime = now / 1000;

    // Check emergency stop button
    if (digitalRead(EMERGENCY_STOP_PIN) == LOW) {
        emergencyShutdown("Emergency button pressed");
    }

    // Maintain WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        systemState.wifiConnected = false;
        setupWiFi();
    }

    // Maintain MQTT connection
    if (!mqtt.connected()) {
        systemState.mqttConnected = false;
        reconnectMQTT();
    }
    mqtt.loop();

    // Read BMS data periodically
    if (now - lastBmsRead >= 1000) {
        readBMS();
        lastBmsRead = now;
    }

    // Determine telemetry interval based on state
    unsigned long telemetryInterval = TELEMETRY_INTERVAL;
    if (bmsData.isCharging || bmsData.isDischarging) {
        telemetryInterval = FAST_TELEMETRY_INTERVAL;
    }

    // Publish telemetry
    if (now - lastTelemetry >= telemetryInterval) {
        publishTelemetry();
        lastTelemetry = now;
    }

    // Publish status periodically
    if (now - lastStatus >= STATUS_INTERVAL) {
        publishStatus();
        lastStatus = now;
    }

    // LED status indication
    if (systemState.emergencyStop) {
        digitalWrite(LED_ERROR_PIN, (now / 200) % 2);  // Fast blink
    } else if (!systemState.bmsOnline) {
        digitalWrite(LED_ERROR_PIN, (now / 500) % 2);  // Slow blink
    } else {
        digitalWrite(LED_ERROR_PIN, LOW);
    }

    if (systemState.wifiConnected && systemState.mqttConnected) {
        digitalWrite(LED_STATUS_PIN, HIGH);
    } else {
        digitalWrite(LED_STATUS_PIN, (now / 1000) % 2);
    }

    delay(10);
}

// ============================================
// WIFI SETUP
// ============================================
void setupWiFi() {
    DEBUG_SERIAL.printf("Connecting to WiFi: %s\n", WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < WIFI_CONNECT_TIMEOUT) {
        delay(500);
        DEBUG_SERIAL.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        systemState.wifiConnected = true;
        DEBUG_SERIAL.println("\nWiFi connected!");
        DEBUG_SERIAL.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        DEBUG_SERIAL.println("\nWiFi connection failed!");
    }
}

// ============================================
// MQTT SETUP
// ============================================
void setupMQTT() {
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    mqtt.setKeepAlive(MQTT_KEEPALIVE);
    mqtt.setBufferSize(1024);
}

void reconnectMQTT() {
    if (!systemState.wifiConnected) return;

    DEBUG_SERIAL.println("Connecting to MQTT...");

    // Create LWT message
    String lwtTopic = String(MQTT_TOPIC_STATUS);
    String lwtMessage = "{\"online\":false}";

    if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD,
                     lwtTopic.c_str(), 0, true, lwtMessage.c_str())) {
        systemState.mqttConnected = true;
        DEBUG_SERIAL.println("MQTT connected!");

        // Subscribe to command topic
        mqtt.subscribe(MQTT_TOPIC_COMMAND);
        mqtt.subscribe(MQTT_TOPIC_CONFIG);
        mqtt.subscribe(MQTT_TOPIC_OTA);

        // Publish online status
        publishStatus();
    } else {
        DEBUG_SERIAL.printf("MQTT failed, rc=%d\n", mqtt.state());
        delay(MQTT_RECONNECT_DELAY);
    }
}

// ============================================
// MQTT CALLBACK
// ============================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    // Null-terminate payload
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';

    DEBUG_SERIAL.printf("MQTT [%s]: %s\n", topic, message);

    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error) {
        DEBUG_SERIAL.printf("JSON parse error: %s\n", error.c_str());
        return;
    }

    // Process based on topic
    if (String(topic) == MQTT_TOPIC_COMMAND) {
        processCommand(doc);
    }
}

// ============================================
// COMMAND PROCESSING
// ============================================
void processCommand(JsonDocument& doc) {
    String command = doc["command"].as<String>();

    DEBUG_SERIAL.printf("Processing command: %s\n", command.c_str());

    if (command == "start_charge") {
        if (!systemState.emergencyStop) {
            setChargeRelay(true);
            bmsData.isCharging = true;
        }
    }
    else if (command == "stop_charge") {
        setChargeRelay(false);
        bmsData.isCharging = false;
    }
    else if (command == "start_discharge") {
        if (!systemState.emergencyStop) {
            setDischargeRelay(true);
            bmsData.isDischarging = true;
        }
    }
    else if (command == "stop_discharge") {
        setDischargeRelay(false);
        bmsData.isDischarging = false;
    }
    else if (command == "emergency_stop") {
        String reason = doc["reason"] | "Remote command";
        emergencyShutdown(reason.c_str());
    }
    else if (command == "reset_emergency") {
        systemState.emergencyStop = false;
        digitalWrite(CONTACTOR_MAIN_PIN, HIGH);
    }
    else if (command == "set_mode") {
        systemState.operationMode = doc["mode"].as<String>();
    }
    else if (command == "reboot") {
        DEBUG_SERIAL.println("Rebooting...");
        delay(1000);
        ESP.restart();
    }
}

// ============================================
// RS485/BMS COMMUNICATION
// ============================================
void setupRS485() {
    rs485Serial.begin(RS485_BAUD);
    pinMode(RS485_DE_PIN, OUTPUT);
    digitalWrite(RS485_DE_PIN, LOW);  // Receive mode
    DEBUG_SERIAL.println("RS485 initialized");
}

void readBMS() {
    // This is a simplified example for DALY BMS
    // Real implementation would depend on specific BMS protocol

    digitalWrite(RS485_DE_PIN, HIGH);  // Enable transmit
    delayMicroseconds(100);

    // Send read command (example for DALY: 0xA5 0x40 0x90 ... checksum)
    uint8_t readCmd[] = {0xA5, 0x40, 0x90, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7D};
    rs485Serial.write(readCmd, sizeof(readCmd));
    rs485Serial.flush();

    digitalWrite(RS485_DE_PIN, LOW);   // Enable receive
    delay(50);

    // Read response
    if (rs485Serial.available() >= 13) {
        uint8_t response[36];
        int bytesRead = rs485Serial.readBytes(response, 36);

        if (bytesRead > 0 && response[0] == 0xA5) {
            // Parse response (simplified example)
            // Real parsing depends on BMS protocol
            systemState.bmsOnline = true;
            bmsData.lastUpdate = millis();

            // Example data extraction (would be protocol-specific)
            // bmsData.totalVoltage = ((response[4] << 8) | response[5]) * 0.1;
            // etc.
        }
    } else {
        // If no response, mark as offline after 10 seconds
        if (millis() - bmsData.lastUpdate > 10000) {
            systemState.bmsOnline = false;
        }
    }

    // Simulation for testing (remove in production)
    #ifndef RELEASE
    bmsData.totalVoltage = 51.2 + (random(-10, 10) * 0.01);
    bmsData.current = bmsData.isCharging ? 45.0 : (bmsData.isDischarging ? -50.0 : 0);
    bmsData.power = bmsData.totalVoltage * bmsData.current;
    bmsData.soc = 75.5 + (random(-5, 5) * 0.1);
    bmsData.soh = 98.5;

    for (int i = 0; i < BMS_CELL_COUNT; i++) {
        bmsData.cellVoltages[i] = 3.2 + (random(0, 20) * 0.001);
    }

    bmsData.minCellVoltage = 3.195;
    bmsData.maxCellVoltage = 3.220;
    bmsData.avgCellVoltage = 3.208;
    bmsData.cellDelta = bmsData.maxCellVoltage - bmsData.minCellVoltage;

    for (int i = 0; i < BMS_TEMP_SENSORS; i++) {
        bmsData.temperatures[i] = 28.0 + random(-3, 3);
    }
    bmsData.minTemp = 25;
    bmsData.maxTemp = 31;
    bmsData.avgTemp = 28;

    bmsData.cycleCount = 152;
    systemState.bmsOnline = true;
    bmsData.lastUpdate = millis();
    #endif
}

// ============================================
// TELEMETRY PUBLISHING
// ============================================
void publishTelemetry() {
    if (!mqtt.connected()) return;

    JsonDocument doc;

    doc["deviceId"] = DEVICE_ID;
    doc["timestamp"] = millis();
    doc["soc"] = bmsData.soc;
    doc["soh"] = bmsData.soh;
    doc["totalVoltage"] = bmsData.totalVoltage;
    doc["current"] = bmsData.current;
    doc["power"] = bmsData.power;
    doc["cycleCount"] = bmsData.cycleCount;
    doc["isCharging"] = bmsData.isCharging;
    doc["isDischarging"] = bmsData.isDischarging;
    doc["isBalancing"] = bmsData.isBalancing;

    // Cells
    JsonArray cells = doc["cells"].to<JsonArray>();
    for (int i = 0; i < BMS_CELL_COUNT; i++) {
        JsonObject cell = cells.add<JsonObject>();
        cell["index"] = i;
        cell["voltage"] = bmsData.cellVoltages[i];
        cell["status"] = "normal";  // Would be calculated from thresholds
    }

    // Temperature
    JsonObject temp = doc["temperature"].to<JsonObject>();
    temp["min"] = bmsData.minTemp;
    temp["max"] = bmsData.maxTemp;
    temp["average"] = bmsData.avgTemp;
    JsonArray sensors = temp["sensors"].to<JsonArray>();
    for (int i = 0; i < BMS_TEMP_SENSORS; i++) {
        sensors.add(bmsData.temperatures[i]);
    }

    // Alarms/warnings
    doc["alarms"] = bmsData.alarms;
    doc["warnings"] = bmsData.warnings;

    // Serialize and publish
    char buffer[1024];
    serializeJson(doc, buffer);
    mqtt.publish(MQTT_TOPIC_TELEMETRY, buffer);
}

// ============================================
// STATUS PUBLISHING
// ============================================
void publishStatus() {
    if (!mqtt.connected()) return;

    JsonDocument doc;

    doc["deviceId"] = DEVICE_ID;
    doc["online"] = true;
    doc["firmware"] = FIRMWARE_VERSION;
    doc["uptime"] = systemState.uptime;
    doc["bmsOnline"] = systemState.bmsOnline;
    doc["wifiRssi"] = WiFi.RSSI();
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["operationMode"] = systemState.operationMode;
    doc["chargeEnabled"] = systemState.chargeEnabled;
    doc["dischargeEnabled"] = systemState.dischargeEnabled;
    doc["emergencyStop"] = systemState.emergencyStop;

    char buffer[512];
    serializeJson(doc, buffer);
    mqtt.publish(MQTT_TOPIC_STATUS, buffer, true);  // Retained
}

// ============================================
// GPIO / RELAY CONTROL
// ============================================
void setupGPIO() {
    pinMode(LED_STATUS_PIN, OUTPUT);
    pinMode(LED_ERROR_PIN, OUTPUT);
    pinMode(RELAY_CHARGE_PIN, OUTPUT);
    pinMode(RELAY_DISCHARGE_PIN, OUTPUT);
    pinMode(CONTACTOR_MAIN_PIN, OUTPUT);
    pinMode(EMERGENCY_STOP_PIN, INPUT_PULLUP);

    // Start with everything off
    digitalWrite(LED_STATUS_PIN, LOW);
    digitalWrite(LED_ERROR_PIN, LOW);
    digitalWrite(RELAY_CHARGE_PIN, LOW);
    digitalWrite(RELAY_DISCHARGE_PIN, LOW);
    digitalWrite(CONTACTOR_MAIN_PIN, LOW);
}

void setChargeRelay(bool state) {
    systemState.chargeEnabled = state;
    digitalWrite(RELAY_CHARGE_PIN, state ? HIGH : LOW);
    DEBUG_SERIAL.printf("Charge relay: %s\n", state ? "ON" : "OFF");
}

void setDischargeRelay(bool state) {
    systemState.dischargeEnabled = state;
    digitalWrite(RELAY_DISCHARGE_PIN, state ? HIGH : LOW);
    DEBUG_SERIAL.printf("Discharge relay: %s\n", state ? "ON" : "OFF");
}

void emergencyShutdown(const char* reason) {
    DEBUG_SERIAL.printf("EMERGENCY SHUTDOWN: %s\n", reason);

    systemState.emergencyStop = true;

    // Disable all outputs
    digitalWrite(RELAY_CHARGE_PIN, LOW);
    digitalWrite(RELAY_DISCHARGE_PIN, LOW);
    digitalWrite(CONTACTOR_MAIN_PIN, LOW);

    bmsData.isCharging = false;
    bmsData.isDischarging = false;

    // Publish emergency status
    if (mqtt.connected()) {
        JsonDocument doc;
        doc["deviceId"] = DEVICE_ID;
        doc["event"] = "emergency_stop";
        doc["reason"] = reason;
        doc["timestamp"] = millis();

        char buffer[256];
        serializeJson(doc, buffer);
        mqtt.publish(MQTT_TOPIC_STATUS, buffer);
    }
}

void blinkLED(int pin, int times, int delayMs) {
    for (int i = 0; i < times; i++) {
        digitalWrite(pin, HIGH);
        delay(delayMs);
        digitalWrite(pin, LOW);
        delay(delayMs);
    }
}
