import time

def is_usb_connected():
    """
    Detects if an active USB host is connected (USB CDC/JTAG).
    On ESP32-C3, this reads the USB_SERIAL_JTAG_FRAM_NUM_REG register
    which automatically increments when SOF (Start of Frame) packets are
    received from an active USB host.
    
    Returns:
        bool: True if an active USB host is detected, False otherwise.
    """
    try:
        from machine import mem32
        
        # 0x60043024 is the USB_SERIAL_JTAG_FRAM_NUM_REG address on ESP32-C3
        REG_ADDR = 0x60043024
        
        # Take two readings with a 10ms delay
        frame_start = mem32[REG_ADDR] & 0x7FF
        time.sleep_ms(10)
        frame_end = mem32[REG_ADDR] & 0x7FF
        
        # If the frame index is changing, there is active USB bus traffic (host is connected)
        return frame_start != frame_end
    except Exception as e:
        print(f"⚠️ Error checking USB connection: {e}")
        return False
