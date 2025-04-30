# cspell:ignore hushlogin
ARG DEBIAN_FRONTEND=noninteractive

FROM ubuntu:noble-20250127

# Install Docker CLI
RUN apt-get update && apt-get install -y sudo curl unzip git \
  # Setup user
  && usermod -l vscode -m -d /home/vscode -c vscode ubuntu \
  && groupmod -n vscode ubuntu \
  && echo "vscode ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/vscode \
  && touch /home/vscode/.hushlogin

# Install Node.js 21.x (includes npm 11)
RUN curl -fsSL https://deb.nodesource.com/setup_21.x | bash - \
    && apt-get install -y nodejs 

USER vscode

ENV DENO_VERSION=2.2.12
ENV PATH="/home/vscode/.deno/bin:${PATH}"

RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s v$DENO_VERSION