FROM docker.io/pytorch/torchserve-kfs:0.10.0-gpu

ENV HOME=/home/model-server
USER 0
RUN \
  chown -R :0 /home/model-server \
  && \
  chmod -R g=u /home/model-server

USER 1000
