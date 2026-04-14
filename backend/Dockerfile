FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines

FROM deps AS build
COPY . .
# Prisma charge le schéma au build : `env("DATABASE_URL")` doit exister (pas de connexion réelle ici)
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN yarn prisma generate && yarn build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/yarn.lock ./yarn.lock
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/main.js"]
