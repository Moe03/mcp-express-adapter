FROM node:20-alpine

RUN npm install -g express-mcp-adapter

EXPOSE 8000

ENTRYPOINT ["express-mcp-adapter"]

CMD ["--help"]
