// Minimal ESP32-CAM live MJPEG stream test.
//
// Connects to WiFi, brings up the OV2640 camera, and serves an MJPEG stream
// at http://<device-ip>/stream plus a plain HTML page at http://<device-ip>/
// that just embeds it. No Home Assistant / recording — this is only meant
// to confirm the camera and video path work before building anything on top.

#include <Arduino.h>
#include <WiFi.h>
#include <esp_camera.h>
#include <esp_http_server.h>

#include "camera_pins.h"
#include "secrets.h"

static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
static const char *STREAM_BOUNDARY = "\r\n--frame\r\n";
static const char *STREAM_PART_HEADER = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static httpd_handle_t streamServer = NULL;

static esp_err_t indexHandler(httpd_req_t *req) {
  static const char INDEX_HTML[] =
      "<!DOCTYPE html><html><head><title>cam-test</title></head>"
      "<body style=\"margin:0;background:#000\">"
      "<img src=\"/stream\" style=\"width:100%;height:auto;display:block\">"
      "</body></html>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, INDEX_HTML, strlen(INDEX_HTML));
}

static esp_err_t streamHandler(httpd_req_t *req) {
  esp_err_t res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    return res;
  }

  char partHeader[64];
  while (true) {
    camera_fb_t *frame = esp_camera_fb_get();
    if (!frame) {
      Serial.println("Camera capture failed");
      return ESP_FAIL;
    }

    res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (res == ESP_OK) {
      size_t headerLen = snprintf(partHeader, sizeof(partHeader), STREAM_PART_HEADER, frame->len);
      res = httpd_resp_send_chunk(req, partHeader, headerLen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)frame->buf, frame->len);
    }

    esp_camera_fb_return(frame);

    if (res != ESP_OK) {
      break;
    }
  }
  return res;
}

static void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t indexUri = {
      .uri = "/",
      .method = HTTP_GET,
      .handler = indexHandler,
      .user_ctx = NULL,
  };
  httpd_uri_t streamUri = {
      .uri = "/stream",
      .method = HTTP_GET,
      .handler = streamHandler,
      .user_ctx = NULL,
  };

  if (httpd_start(&streamServer, &config) == ESP_OK) {
    httpd_register_uri_handler(streamServer, &indexUri);
    httpd_register_uri_handler(streamServer, &streamUri);
  }
}

static bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Grab a frame straight into a PSRAM double-buffer when available; fall
  // back to a single smaller frame in plain DRAM on boards without PSRAM.
  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);

  if (!initCamera()) {
    return;
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  startCameraServer();

  Serial.print("Live feed ready: http://");
  Serial.println(WiFi.localIP());
}

void loop() {
  delay(10000);
}
