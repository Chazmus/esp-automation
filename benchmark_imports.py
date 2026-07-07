import time
import sys

# Create dummy modules
for name in ["battery", "network", "usb"]:
    module = type(sys)(name)
    sys.modules[name] = module

def with_imports():
    start = time.perf_counter()
    for _ in range(1000000):
        import battery
        import network
        import usb
    end = time.perf_counter()
    return end - start

def without_imports():
    import battery
    import network
    import usb
    start = time.perf_counter()
    for _ in range(1000000):
        pass
    end = time.perf_counter()
    return end - start

t1 = with_imports()
t2 = without_imports()

print(f"Time with imports in loop: {t1:.4f} seconds")
print(f"Time without imports in loop: {t2:.4f} seconds")
print(f"Improvement: {(t1 - t2) / t1 * 100:.2f}%")
