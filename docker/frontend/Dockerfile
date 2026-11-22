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
