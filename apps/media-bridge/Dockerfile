FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    python3 python3-pip curl unzip awscli \
    cmake build-essential pkg-config libssl-dev libcurl4-openssl-dev liblog4cplus-dev \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/kvs/build && \
    curl -L https://github.com/awslabs/amazon-kinesis-video-streams-producer-sdk-cpp/archive/refs/tags/v3.4.1.tar.gz \
    | tar -xz -C /opt/kvs --strip-components=1 && \
    cd /opt/kvs/build && \
    cmake .. -DBUILD_GSTREAMER_PLUGIN=ON -DBUILD_DEPENDENCIES=OFF && \
    make -j2 && \
    cp /opt/kvs/build/libgstkvssink.so /usr/lib/*/gstreamer-1.0/

ENV GST_PLUGIN_PATH=/usr/lib/x86_64-linux-gnu/gstreamer-1.0:/usr/lib/aarch64-linux-gnu/gstreamer-1.0

WORKDIR /app
COPY bridge-agent.sh healthcheck.sh ./
RUN chmod +x bridge-agent.sh healthcheck.sh

HEALTHCHECK --interval=20s --timeout=10s --start-period=45s --retries=3 \
  CMD ./healthcheck.sh

ENTRYPOINT ["./bridge-agent.sh"]
