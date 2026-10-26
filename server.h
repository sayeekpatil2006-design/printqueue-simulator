#ifndef SERVER_H
#define SERVER_H

#include "queue.h"
#include <string>
#include <vector>
#include <mutex>
#include <memory>
#include <atomic>

struct LogEntry {
    std::string timestamp;
    std::string operation;   // e.g. "ENQUEUE", "DEQUEUE", "PEEK_FRONT", "CLEAR"
    std::string details;
    std::string queueState;   // Visual snapshot (e.g. "JOB-101 -> JOB-102")
};

class SimulationManager {
private:
    PrinterQueue queue;
    std::vector<PrintJob> completedJobs;
    std::vector<LogEntry> operationLogs;
    
    // Active printing state
    bool hasActiveJob;
    PrintJob currentPrintingJob;
    int currentPrintingPage;
    std::string printerStatus; // "IDLE", "PRINTING", "PAUSED"
    
    // Counters
    int totalSubmittedCount;
    int totalCompletedCount;
    int totalPagesPrintedCount;
    int jobSequenceCounter;

    mutable std::mutex mtx;

    std::string getQueueSnapshotLocked() const;
    void addLogLocked(const std::string& op, const std::string& details);

public:
    SimulationManager();

    // Queue Operations with Thread Safety
    PrintJob enqueueJob(const std::string& student, const std::string& doc, int pages, const std::string& type, const std::string& customId = "");
    PrintJob dequeueJob();
    bool peekFront(PrintJob& outJob) const;
    bool peekRear(PrintJob& outJob) const;
    void clearWaitingQueue();
    void resetAll();

    // Printer Lifecycle
    bool startPrintNext(PrintJob& outJob);
    bool updatePrintProgress(int page);
    bool completeCurrentJob(PrintJob& outJob);
    void pausePrinter();
    void resumePrinter();

    // State Inspection
    std::string getStatusJson() const;
    std::string getQueueJson() const;
    std::string getHistoryJson() const;
    std::string loadDemoScenario();

    int getQueueSize() const;
    std::string getPrinterStatus() const;
};

class HttpServer {
private:
    int port;
    int serverSocket;
    std::atomic<bool> isRunning;
    SimulationManager manager;

    void handleClient(int clientSocket);
    void sendResponse(int clientSocket, int statusCode, const std::string& contentType, const std::string& body);
    void sendFileResponse(int clientSocket, const std::string& filePath, const std::string& contentType);
    std::string parseJsonField(const std::string& json, const std::string& key);

public:
    explicit HttpServer(int port = 8080);
    ~HttpServer();

    void start();
    void stop();
};

#endif // SERVER_H
