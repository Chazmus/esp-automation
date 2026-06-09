# This file is executed on every boot (including wake-boot from deepsleep)
import gc
import esp

# Disable OS debug info
esp.osdebug(None)

# Run garbage collection
gc.collect()

print("--- boot.py executed successfully ---")
