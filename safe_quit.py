import os
import signal

with open('./pid.txt', 'r') as fin:
    pid = int(fin.read().strip())

os.kill(pid, signal.SIGUSR1)
