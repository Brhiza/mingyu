FROM node:22-alpine AS deps

WORKDIR /app
ENV NODE_ENV=development
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable

COPY --from=build /app /app

EXPOSE 3000
CMD ["pnpm", "exec", "tsx", "--tsconfig", "tsconfig.app.json", "server/docker-server.ts"]
