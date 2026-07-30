FROM denoland/deno:2.9.4

# Run as a non-root user.
RUN useradd -m -s /bin/bash app
WORKDIR /app
ENV DENO_DIR=/home/app/.cache/deno

# Copy dependency manifests and source first to leverage layer caching.
COPY --chown=app:app deno.json deno.lock ./
COPY --chown=app:app src ./src
COPY --chown=app:app scripts ./scripts

USER app
RUN deno cache src/main.ts scripts/deploy-commands.ts

# Secrets are supplied at runtime via -e/--env-file; do not bake them in.
CMD ["deno", "task", "start"]
