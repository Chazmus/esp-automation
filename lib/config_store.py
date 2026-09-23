import json

DEFAULT_CONFIG = {
    "medium": "COCO",  # "COCO" or "SOIL"
    "coco_interval_hours": 4,
    "coco_duration_secs": 15,
    "coco_agitate_mins": 5,
    "coco_drain_wait_mins": 10,
    "coco_drain_secs": 60,
    "soil_trigger_pct": 28.0,
    "soil_target_pct": 45.0,
    "soil_max_water_secs": 60,
    "soil_soak_wait_mins": 60,
    "light_preset": "18/6",
    "light_start_time": "06:00",
}


class ConfigStore:
    def __init__(self, filename="grow_config.json"):
        self.filename = filename
        self.config = dict(DEFAULT_CONFIG)
        self.load()

    def load(self):
        """Loads configuration from JSON file on flash, falling back to defaults."""
        try:
            with open(self.filename, "r") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    self.config.update(saved)
                    print(f"📁 Loaded grow config from {self.filename}")
        except OSError:
            # File doesn't exist yet on flash
            print(f"📁 No existing {self.filename} found. Using default config.")
        except Exception as e:
            print(f"⚠️ Error reading {self.filename}: {e}. Using default config.")
        return self.config

    def save(self, updates=None):
        """Saves current configuration to JSON file on flash."""
        if updates:
            self.config.update(updates)
        try:
            with open(self.filename, "w") as f:
                json.dump(self.config, f)
            print(f"💾 Saved grow config to {self.filename}")
            return True
        except Exception as e:
            print(f"❌ Failed to save {self.filename}: {e}")
            return False

    def get(self, key, default=None):
        return self.config.get(key, default)

    def set(self, key, value):
        self.config[key] = value
        self.save()
