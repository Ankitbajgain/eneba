ARG NODE_IMAGE=node:slim
FROM ${NODE_IMAGE} AS development
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN chown -R node:node /workspace/frontend
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM development AS build
RUN npm run build

FROM nginx:stable-alpine AS production
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
COPY docker/nginx/production.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080 PHP_FPM_UPSTREAM=backend:9000
ENV NGINX_ENVSUBST_FILTER="^(PORT|PHP_FPM_UPSTREAM)$"
EXPOSE 8080
