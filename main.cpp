#include "server.h"
#include <iostream>
#include <csignal>
#include <cstdlib>

static HttpServer* globalServerPtr = nullptr;

void signalHandler(int signum) {
    std::cout << "\n[!] Signal (" << signum << ") received. Gracefully shutting down PrintQueue server...\n";
    if (globalServerPtr) {
        globalServerPtr->stop();
    }
    std::exit(signum);
}

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) {
        try {
            port = std::stoi(argv[1]);
        } catch (...) {
            std::cerr << "[!] Invalid port provided. Defaulting to 8080.\n";
            port = 8080;
        }
    }

    std::cout << "=========================================================\n";
    std::cout << "  PrintQueue Simulator — FIFO Queue & Learning Platform   \n";
    std::cout << "  Core Data Structure: C++ First-In, First-Out Queue     \n";
    std::cout << "=========================================================\n";

    HttpServer server(port);
    globalServerPtr = &server;

    // Register signal handlers for clean exit (Ctrl+C)
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    std::cout << "[*] Starting native C++ HTTP server on port " << port << "...\n";
    server.start();

    return 0;
}
