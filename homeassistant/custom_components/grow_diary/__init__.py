"""Grow Diary custom component for Home Assistant."""
import os
import json
import logging
import time
import base64
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "grow_diary"
STORAGE_DIR = "/config/www/grow_wardrobe"
DIARY_FILE = f"{STORAGE_DIR}/diary.json"
PHOTOS_DIR = f"{STORAGE_DIR}/photos"


class GrowDiaryView(HomeAssistantView):
    url = "/api/grow_diary"
    name = "api:grow_diary"
    requires_auth = False

    async def get(self, request):
        hass = request.app["hass"]

        def _read():
            if not os.path.exists(DIARY_FILE):
                return {"runs": [], "activeRunId": None, "entries": []}
            try:
                with open(DIARY_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                _LOGGER.error("Failed to read diary file: %s", e)
                return {"runs": [], "activeRunId": None, "entries": []}

        data = await hass.async_add_executor_job(_read)
        return self.json(data)

    async def post(self, request):
        hass = request.app["hass"]
        try:
            body = await request.json()
        except Exception:
            return self.json({"error": "Invalid JSON"}, status_code=400)

        def _write():
            os.makedirs(STORAGE_DIR, exist_ok=True)
            temp_file = f"{DIARY_FILE}.tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(body, f, indent=2)
            os.replace(temp_file, DIARY_FILE)

        try:
            await hass.async_add_executor_job(_write)
            return self.json({"success": True})
        except Exception as e:
            _LOGGER.error("Failed to write diary: %s", e)
            return self.json({"error": str(e)}, status_code=500)


class GrowDiaryPhotoView(HomeAssistantView):
    url = "/api/grow_diary/photo"
    name = "api:grow_diary:photo"
    requires_auth = False

    async def post(self, request):
        hass = request.app["hass"]
        os.makedirs(PHOTOS_DIR, exist_ok=True)

        filename = f"photo_{int(time.time() * 1000)}"
        content_type = request.content_type

        if "multipart" in content_type:
            reader = await request.multipart()
            field = await reader.next()
            if not field:
                return self.json({"error": "No file field found"}, status_code=400)

            ext = ".jpg"
            if field.filename:
                _, file_ext = os.path.splitext(field.filename)
                if file_ext:
                    ext = file_ext.lower()

            full_filename = f"{filename}{ext}"
            filepath = os.path.join(PHOTOS_DIR, full_filename)

            data_bytes = await field.read()

            def _save_multipart():
                with open(filepath, "wb") as f:
                    f.write(data_bytes)

            await hass.async_add_executor_job(_save_multipart)

            return self.json({
                "success": True,
                "url": f"/local/grow_wardrobe/photos/{full_filename}",
                "filename": full_filename
            })
        else:
            try:
                body = await request.json()
                b64_data = body.get("image", "")
                if "," in b64_data:
                    b64_data = b64_data.split(",", 1)[1]

                raw_bytes = base64.b64decode(b64_data)
                ext = body.get("ext", ".jpg")
                if not ext.startswith("."):
                    ext = f".{ext}"
                full_filename = f"{filename}{ext}"
                filepath = os.path.join(PHOTOS_DIR, full_filename)

                def _save_base64():
                    with open(filepath, "wb") as f:
                        f.write(raw_bytes)

                await hass.async_add_executor_job(_save_base64)

                return self.json({
                    "success": True,
                    "url": f"/local/grow_wardrobe/photos/{full_filename}",
                    "filename": full_filename
                })
            except Exception as e:
                _LOGGER.error("Failed to save base64 photo: %s", e)
                return self.json({"error": str(e)}, status_code=400)


async def async_setup(hass: HomeAssistant, config: dict):
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    hass.http.register_view(GrowDiaryView())
    hass.http.register_view(GrowDiaryPhotoView())
    _LOGGER.info("Grow Diary endpoints registered at /api/grow_diary and /api/grow_diary/photo")
    return True
