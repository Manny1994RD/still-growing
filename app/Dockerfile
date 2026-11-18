# Builds the web app and serves it with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG EXPO_PUBLIC_API_URL=http://localhost:4000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npx expo export --platform web

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
