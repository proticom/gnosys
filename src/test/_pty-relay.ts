export const PTY_RELAY = `
import errno, os, pty, select, signal, sys
pid, master = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
def terminate(signum, frame):
    os.killpg(pid, signal.SIGKILL)
signal.signal(signal.SIGTERM, terminate)
inputs = [master, sys.stdin.fileno()]
while master in inputs:
    ready, _, _ = select.select(inputs, [], [], 1)
    for fd in ready:
        try:
            data = os.read(fd, 4096)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            data = b''
        if not data:
            inputs.remove(fd)
        elif fd == master:
            os.write(sys.stdout.fileno(), data)
        else:
            os.write(master, data)
os.close(master)
_, status = os.waitpid(pid, 0)
code = os.waitstatus_to_exitcode(status)
sys.exit(code if code >= 0 else 128 - code)
`;
