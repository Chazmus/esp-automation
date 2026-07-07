import sys
import unittest.mock as mock
import timeit

# Mock network, time and secrets modules which are micropython specific
# NOTE: We can't use sys.modules['time'] = mock.MagicMock() because timeit relies on the built-in 'time' module!
# Let's try to mock just 'network' and 'secrets' and perhaps patch what we need.

sys.modules['network'] = mock.MagicMock()
sys.modules['secrets'] = mock.MagicMock()

sys.path.insert(0, 'lib')
import wifi

def run_benchmark():
    wifi.get_status_desc(1000)

if __name__ == '__main__':
    t = timeit.timeit("run_benchmark()", setup="from __main__ import run_benchmark", number=1000000)
    print(f"Time for 1,000,000 calls: {t:.6f} seconds")
