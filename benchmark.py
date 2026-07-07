import timeit
import gc
import sys

setup = """
class DummyADC:
    def read_uv(self):
        return 1000

adc = DummyADC()
class DummyTime:
    def sleep_ms(self, ms):
        pass

time = DummyTime()
"""

test_list = """
readings = []
for _ in range(5):
    readings.append(adc.read_uv())
    time.sleep_ms(10)
avg_uv = sum(readings) / len(readings)
"""

test_int = """
total_uv = 0
num_readings = 5
for _ in range(num_readings):
    total_uv += adc.read_uv()
    time.sleep_ms(10)
avg_uv = total_uv / num_readings
"""

t1 = timeit.timeit(test_list, setup=setup, number=100000)
t2 = timeit.timeit(test_int, setup=setup, number=100000)

print(f"List allocation: {t1:.6f} seconds")
print(f"Integer sum: {t2:.6f} seconds")
print(f"Improvement: {(t1-t2)/t1*100:.2f}%")
