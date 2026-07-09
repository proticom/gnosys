# Isolated environment for gnosys setup UI tests.
#
# The gnosys CLI under test is installed from a locally packed tarball
# (gnosys.tgz, produced by run.sh via `npm pack`), exactly as an end user
# would get it from npm. Everything runs as a non-root user inside the
# container: no host filesystem, no host ~/.gnosys, no host config can be
# touched. Network is not required by any test (run.sh passes --network=none).
FROM node:22-slim

# expect drives the interactive wizard; procps for ps in debug sessions.
RUN apt-get update \
  && apt-get install -y --no-install-recommends expect procps \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash tester
WORKDIR /home/tester

# Install the packed CLI globally (as npm would for a real user).
COPY gnosys.tgz /tmp/gnosys.tgz
RUN npm install -g /tmp/gnosys.tgz && rm /tmp/gnosys.tgz

COPY tests/ /home/tester/tests/
RUN chown -R tester:tester /home/tester

USER tester
ENV HOME=/home/tester \
    TERM=xterm-256color \
    NO_COLOR=0

CMD ["bash", "/home/tester/tests/run-all.sh"]
