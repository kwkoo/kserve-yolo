FROM docker.io/bitnami/nginx:latest

COPY --chmod=664 ./html /html
COPY --chown=:0 ./conf/server_block.conf /opt/bitnami/nginx/conf/server_blocks/server_block.conf

USER 0
RUN chmod -R g=u /html /opt/bitnami/nginx/conf
USER 1001
