# Build image locally, push to registry; server only pulls and runs.
# Build args: pass URLs of your server (used at next build time).
ARG NEXT_PUBLIC_API_URL=https://meeting.soict.io
#ARG NEXT_PUBLIC_API_URL=https://meeting.soict.io:8080
ARG NEXT_PUBLIC_VIRTUAL_MIC_WS_URL=

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_VIRTUAL_MIC_WS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_VIRTUAL_MIC_WS_URL=${NEXT_PUBLIC_VIRTUAL_MIC_WS_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
