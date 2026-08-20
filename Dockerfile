FROM node:22-alpine AS deps

WORKDIR /app
ENV NODE_ENV=development
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG VITE_ENABLE_DONATION_BOX=false
ENV VITE_ENABLE_DONATION_BOX=$VITE_ENABLE_DONATION_BOX

COPY . .
RUN pnpm build && pnpm build:server

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server-dist ./server-dist

EXPOSE 3000
USER node
CMD ["node", "server-dist/docker-server.mjs"]
