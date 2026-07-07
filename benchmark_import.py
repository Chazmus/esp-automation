import time

def benchmark_inside():
    start = time.perf_counter()
    for _ in range(100000):
        import math
    end = time.perf_counter()
    return end - start

import math
def benchmark_outside():
    start = time.perf_counter()
    for _ in range(100000):
        pass
    end = time.perf_counter()
    return end - start

print(f"Inside loop: {benchmark_inside():.6f} seconds")
print(f"Outside loop: {benchmark_outside():.6f} seconds")
