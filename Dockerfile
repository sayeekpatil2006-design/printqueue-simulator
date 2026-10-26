# Multi-stage Dockerfile for PrintQueue Simulator
# Stage 1: Build the C++ Server and Test Suite
FROM gcc:12-bullseye AS builder

WORKDIR /app
COPY . .

# Compile server and test runner
RUN make all && ./test_runner

# Stage 2: Minimal Runtime Container
FROM debian:bullseye-slim

WORKDIR /app

# Copy compiled binary and web assets from builder
COPY --from=builder /app/printqueue_server .
COPY --from=builder /app/index.html .
COPY --from=builder /app/style.css .
COPY --from=builder /app/script.js .
COPY --from=builder /app/README.md .

# Expose HTTP port
EXPOSE 8080

# Run the server
CMD ["./printqueue_server", "8080"]
