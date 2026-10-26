#include "server.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <thread>
#include <cstring>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <chrono>
#include <ctime>
#include <iomanip>

// JSON helper functions
static std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        switch (c) {
            case '"': o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b"; break;
            case '\f': o << "\\f"; break;
            case '\n': o << "\\n"; break;
            case '\r': o << "\\r"; break;
            case '\t': o << "\\t"; break;
            default:
                if ('\x00' <= c && c <= '\x1f') {
                    o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
                } else {
                    o << c;
                }
        }
    }
    return o.str();
}

static std::string jobToJson(const PrintJob& job) {
    std::ostringstream ss;
    ss << "{"
       << "\"jobId\":\"" << escapeJson(job.jobId) << "\","
       << "\"studentName\":\"" << escapeJson(job.studentName) << "\","
       << "\"documentName\":\"" << escapeJson(job.documentName) << "\","
       << "\"pageCount\":" << job.pageCount << ","
       << "\"arrivalSequence\":" << job.arrivalSequence << ","
       << "\"docType\":\"" << escapeJson(job.docType) << "\","
       << "\"status\":\"" << jobStatusToString(job.status) << "\","
       << "\"submittedTime\":\"" << escapeJson(job.submittedTime) << "\","
       << "\"estimatedPrintTimeSec\":" << job.estimatedPrintTimeSec
       << "}";
    return ss.str();
}

// -----------------------------------------------------------------------------
// SimulationManager Implementation
// -----------------------------------------------------------------------------

SimulationManager::SimulationManager()
    : hasActiveJob(false), currentPrintingPage(0), printerStatus("IDLE"),
      totalSubmittedCount(0), totalCompletedCount(0), totalPagesPrintedCount(0),
      jobSequenceCounter(101) {
    addLogLocked("INITIALIZE", "Simulation manager ready. Queue initialized to empty.");
}

std::string SimulationManager::getQueueSnapshotLocked() const {
    std::vector<PrintJob> jobs = queue.displayQueue();
    if (jobs.empty()) return "[Empty Queue]";
    std::ostringstream ss;
    for (size_t i = 0; i < jobs.size(); ++i) {
        ss << jobs[i].jobId;
        if (i + 1 < jobs.size()) ss << " → ";
    }
    return ss.str();
}

void SimulationManager::addLogLocked(const std::string& op, const std::string& details) {
    auto now = std::chrono::system_clock::now();
    std::time_t now_c = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&now_c), "%H:%M:%S");

    LogEntry entry;
    entry.timestamp = ss.str();
    entry.operation = op;
    entry.details = details;
    entry.queueState = getQueueSnapshotLocked();
    operationLogs.push_back(entry);

    // Limit log size to last 100 entries to prevent memory unbounded growth
    if (operationLogs.size() > 100) {
        operationLogs.erase(operationLogs.begin());
    }
}

PrintJob SimulationManager::enqueueJob(const std::string& student, const std::string& doc,
                                       int pages, const std::string& type, const std::string& customId) {
    std::lock_guard<std::mutex> lock(mtx);

    std::string id = customId;
    if (id.empty()) {
        id = "JOB-" + std::to_string(jobSequenceCounter);
    }
    int seq = totalSubmittedCount + 1;

    PrintJob newJob(id, student, doc, pages, seq, type);
    queue.enqueue(newJob);

    totalSubmittedCount++;
    jobSequenceCounter++;

    std::string detail = "Enqueued " + id + " (" + student + ", " + std::to_string(pages) + " pages) at rear of queue.";
    addLogLocked("ENQUEUE", detail);

    return newJob;
}

PrintJob SimulationManager::dequeueJob() {
    std::lock_guard<std::mutex> lock(mtx);

    if (queue.isEmpty()) {
        addLogLocked("UNDERFLOW_ERROR", "Attempted to dequeue from empty queue.");
        throw QueueUnderflowException();
    }

    PrintJob job = queue.dequeue();
    std::string detail = "Dequeued " + job.jobId + " from front of queue.";
    addLogLocked("DEQUEUE", detail);

    return job;
}

bool SimulationManager::peekFront(PrintJob& outJob) const {
    std::lock_guard<std::mutex> lock(mtx);
    if (queue.isEmpty()) return false;
    outJob = queue.peekFront();
    return true;
}

bool SimulationManager::peekRear(PrintJob& outJob) const {
    std::lock_guard<std::mutex> lock(mtx);
    if (queue.isEmpty()) return false;
    outJob = queue.peekRear();
    return true;
}

void SimulationManager::clearWaitingQueue() {
    std::lock_guard<std::mutex> lock(mtx);
    int clearedCount = queue.size();
    queue.clearQueue();
    addLogLocked("CLEAR_QUEUE", "Cleared " + std::to_string(clearedCount) + " waiting jobs from queue.");
}

void SimulationManager::resetAll() {
    std::lock_guard<std::mutex> lock(mtx);
    queue.clearQueue();
    completedJobs.clear();
    hasActiveJob = false;
    currentPrintingPage = 0;
    printerStatus = "IDLE";
    totalSubmittedCount = 0;
    totalCompletedCount = 0;
    totalPagesPrintedCount = 0;
    jobSequenceCounter = 101;
    operationLogs.clear();
    addLogLocked("RESET", "Simulation completely reset to initial empty state.");
}

bool SimulationManager::startPrintNext(PrintJob& outJob) {
    std::lock_guard<std::mutex> lock(mtx);
    if (hasActiveJob) {
        return false; // Printer busy
    }
    if (queue.isEmpty()) {
        return false; // Nothing to print
    }

    currentPrintingJob = queue.dequeue();
    currentPrintingJob.status = JobStatus::PRINTING;
    hasActiveJob = true;
    currentPrintingPage = 0;
    printerStatus = "PRINTING";

    outJob = currentPrintingJob;
    addLogLocked("PRINT_START", "Moved " + outJob.jobId + " from queue front into printer. Printing started.");
    return true;
}

bool SimulationManager::updatePrintProgress(int page) {
    std::lock_guard<std::mutex> lock(mtx);
    if (!hasActiveJob) return false;
    currentPrintingPage = page;
    return true;
}

bool SimulationManager::completeCurrentJob(PrintJob& outJob) {
    std::lock_guard<std::mutex> lock(mtx);
    if (!hasActiveJob) return false;

    currentPrintingJob.status = JobStatus::COMPLETED;
    totalCompletedCount++;
    totalPagesPrintedCount += currentPrintingJob.pageCount;
    completedJobs.push_back(currentPrintingJob);

    outJob = currentPrintingJob;
    hasActiveJob = false;
    currentPrintingPage = 0;
    printerStatus = "IDLE";

    addLogLocked("PRINT_COMPLETED", "Completed printing " + outJob.jobId + " (" + std::to_string(outJob.pageCount) + " pages).");
    return true;
}

void SimulationManager::pausePrinter() {
    std::lock_guard<std::mutex> lock(mtx);
    if (printerStatus == "PRINTING") {
        printerStatus = "PAUSED";
        addLogLocked("PRINTER_PAUSE", "Printer output paused.");
    }
}

void SimulationManager::resumePrinter() {
    std::lock_guard<std::mutex> lock(mtx);
    if (printerStatus == "PAUSED") {
        printerStatus = hasActiveJob ? "PRINTING" : "IDLE";
        addLogLocked("PRINTER_RESUME", "Printer output resumed.");
    }
}

int SimulationManager::getQueueSize() const {
    std::lock_guard<std::mutex> lock(mtx);
    return queue.size();
}

std::string SimulationManager::getPrinterStatus() const {
    std::lock_guard<std::mutex> lock(mtx);
    return printerStatus;
}

std::string SimulationManager::getStatusJson() const {
    std::lock_guard<std::mutex> lock(mtx);

    std::vector<PrintJob> waiting = queue.displayQueue();
    int estWaitSec = 0;
    if (hasActiveJob) {
        estWaitSec += (currentPrintingJob.pageCount - currentPrintingPage);
    }
    for (const auto& job : waiting) {
        estWaitSec += job.pageCount;
    }

    std::ostringstream ss;
    ss << "{"
       << "\"status\":\"ok\","
       << "\"printerStatus\":\"" << printerStatus << "\","
       << "\"hasActiveJob\":" << (hasActiveJob ? "true" : "false") << ","
       << "\"currentPrintingPage\":" << currentPrintingPage << ","
       << "\"queueSize\":" << queue.size() << ","
       << "\"totalSubmitted\":" << totalSubmittedCount << ","
       << "\"totalCompleted\":" << totalCompletedCount << ","
       << "\"totalPagesPrinted\":" << totalPagesPrintedCount << ","
       << "\"estimatedWaitTimeSec\":" << estWaitSec << ",";

    if (hasActiveJob) {
        ss << "\"currentJob\":" << jobToJson(currentPrintingJob) << ",";
    } else {
        ss << "\"currentJob\":null,";
    }

    if (!queue.isEmpty()) {
        ss << "\"frontJob\":" << jobToJson(queue.peekFront()) << ",";
        ss << "\"rearJob\":" << jobToJson(queue.peekRear()) << ",";
    } else {
        ss << "\"frontJob\":null,";
        ss << "\"rearJob\":null,";
    }

    // Last log entry
    if (!operationLogs.empty()) {
        const auto& l = operationLogs.back();
        ss << "\"lastOperation\":{"
           << "\"time\":\"" << escapeJson(l.timestamp) << "\","
           << "\"op\":\"" << escapeJson(l.operation) << "\","
           << "\"details\":\"" << escapeJson(l.details) << "\","
           << "\"state\":\"" << escapeJson(l.queueState) << "\""
           << "}";
    } else {
        ss << "\"lastOperation\":null";
    }

    ss << "}";
    return ss.str();
}

std::string SimulationManager::getQueueJson() const {
    std::lock_guard<std::mutex> lock(mtx);
    std::vector<PrintJob> jobs = queue.displayQueue();

    std::ostringstream ss;
    ss << "{\"queue\":[";
    for (size_t i = 0; i < jobs.size(); ++i) {
        ss << jobToJson(jobs[i]);
        if (i + 1 < jobs.size()) ss << ",";
    }
    ss << "],\"size\":" << jobs.size() << "}";
    return ss.str();
}

std::string SimulationManager::getHistoryJson() const {
    std::lock_guard<std::mutex> lock(mtx);

    std::ostringstream ss;
    ss << "{\"completed\":[";
    for (size_t i = 0; i < completedJobs.size(); ++i) {
        ss << jobToJson(completedJobs[i]);
        if (i + 1 < completedJobs.size()) ss << ",";
    }
    ss << "],\"logs\":[";
    for (size_t i = 0; i < operationLogs.size(); ++i) {
        ss << "{"
           << "\"time\":\"" << escapeJson(operationLogs[i].timestamp) << "\","
           << "\"operation\":\"" << escapeJson(operationLogs[i].operation) << "\","
           << "\"details\":\"" << escapeJson(operationLogs[i].details) << "\","
           << "\"queueState\":\"" << escapeJson(operationLogs[i].queueState) << "\""
           << "}";
        if (i + 1 < operationLogs.size()) ss << ",";
    }
    ss << "]}";
    return ss.str();
}

std::string SimulationManager::loadDemoScenario() {
    std::lock_guard<std::mutex> lock(mtx);
    // Reset queue
    queue.clearQueue();
    hasActiveJob = false;
    currentPrintingPage = 0;
    printerStatus = "IDLE";

    // Add specified demo jobs:
    // JOB-101: Sayali — DSA_Assignment.pdf — 5 pages.
    // JOB-102: Rahul — OS_Notes.pdf — 10 pages.
    // JOB-103: Priya — DBMS_Project.pdf — 7 pages.
    PrintJob j1("JOB-101", "Sayali", "DSA_Assignment.pdf", 5, 1, "PDF");
    PrintJob j2("JOB-102", "Rahul", "OS_Notes.pdf", 10, 2, "PDF");
    PrintJob j3("JOB-103", "Priya", "DBMS_Project.pdf", 7, 3, "PDF");

    queue.enqueue(j1);
    queue.enqueue(j2);
    queue.enqueue(j3);

    totalSubmittedCount = 3;
    jobSequenceCounter = 104;

    addLogLocked("DEMO_LOAD", "Loaded standard demonstration scenario (JOB-101, JOB-102, JOB-103).");
    return "{\"success\":true,\"message\":\"Loaded demonstration scenario: JOB-101, JOB-102, JOB-103.\"}";
}

// -----------------------------------------------------------------------------
// HttpServer Implementation
// -----------------------------------------------------------------------------

HttpServer::HttpServer(int p) : port(p), serverSocket(-1), isRunning(false) {}

HttpServer::~HttpServer() {
    stop();
}

void HttpServer::start() {
    serverSocket = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSocket < 0) {
        std::cerr << "[-] Error creating socket\n";
        return;
    }

    int opt = 1;
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in serverAddr{};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(port);

    if (bind(serverSocket, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) < 0) {
        std::cerr << "[-] Error binding to port " << port << "\n";
        close(serverSocket);
        serverSocket = -1;
        return;
    }

    if (listen(serverSocket, 20) < 0) {
        std::cerr << "[-] Error listening on socket\n";
        close(serverSocket);
        serverSocket = -1;
        return;
    }

    isRunning = true;
    std::cout << "[+] PrintQueue C++ HTTP Server successfully started.\n";
    std::cout << "[+] Listening on http://localhost:" << port << " / http://127.0.0.1:" << port << "\n";
    std::cout << "[+] Ready to serve frontend and handle C++ FIFO Queue operations!\n";

    while (isRunning) {
        sockaddr_in clientAddr{};
        socklen_t clientLen = sizeof(clientAddr);
        int clientSocket = accept(serverSocket, (struct sockaddr*)&clientAddr, &clientLen);

        if (clientSocket < 0) {
            if (isRunning) {
                std::cerr << "[-] Accept error\n";
            }
            break;
        }

        // Handle client in a detached thread for responsive asynchronous handling
        std::thread([this, clientSocket]() {
            this->handleClient(clientSocket);
        }).detach();
    }
}

void HttpServer::stop() {
    if (isRunning) {
        isRunning = false;
        if (serverSocket >= 0) {
            close(serverSocket);
            serverSocket = -1;
        }
        std::cout << "[*] PrintQueue C++ HTTP Server stopped.\n";
    }
}

void HttpServer::sendResponse(int clientSocket, int statusCode, const std::string& contentType, const std::string& body) {
    std::string statusText = (statusCode == 200) ? "OK" :
                             (statusCode == 404) ? "Not Found" :
                             (statusCode == 400) ? "Bad Request" :
                             (statusCode == 500) ? "Internal Server Error" : "OK";

    std::ostringstream response;
    response << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n";
    response << "Content-Type: " << contentType << "\r\n";
    response << "Content-Length: " << body.size() << "\r\n";
    response << "Access-Control-Allow-Origin: *\r\n";
    response << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
    response << "Access-Control-Allow-Headers: Content-Type\r\n";
    response << "Connection: close\r\n\r\n";
    response << body;

    std::string respStr = response.str();
    send(clientSocket, respStr.c_str(), respStr.size(), 0);
    close(clientSocket);
}

void HttpServer::sendFileResponse(int clientSocket, const std::string& filePath, const std::string& contentType) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        sendResponse(clientSocket, 404, "text/plain", "File not found: " + filePath);
        return;
    }

    std::ostringstream ss;
    ss << file.rdbuf();
    std::string content = ss.str();

    sendResponse(clientSocket, 200, contentType, content);
}

// Simple JSON string parser for flat keys
std::string HttpServer::parseJsonField(const std::string& json, const std::string& key) {
    std::string needle = "\"" + key + "\"";
    size_t pos = json.find(needle);
    if (pos == std::string::npos) return "";

    pos += needle.length();
    // Skip whitespaces and colon
    while (pos < json.length() && (json[pos] == ' ' || json[pos] == ':' || json[pos] == '\t')) {
        pos++;
    }

    if (pos >= json.length()) return "";

    // String value
    if (json[pos] == '"') {
        pos++;
        size_t endPos = json.find('"', pos);
        if (endPos == std::string::npos) return "";
        return json.substr(pos, endPos - pos);
    }

    // Number or boolean
    size_t endPos = json.find_first_of(",}\n\r", pos);
    if (endPos == std::string::npos) endPos = json.length();
    std::string val = json.substr(pos, endPos - pos);
    // Trim whitespace
    val.erase(val.find_last_not_of(" \t\n\r") + 1);
    return val;
}

void HttpServer::handleClient(int clientSocket) {
    char buffer[4096];
    ssize_t bytesRead = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
    if (bytesRead <= 0) {
        close(clientSocket);
        return;
    }
    buffer[bytesRead] = '\0';

    std::string request(buffer, bytesRead);
    std::istringstream reqStream(request);
    std::string method, path, protocol;
    reqStream >> method >> path >> protocol;

    // Handle CORS preflight
    if (method == "OPTIONS") {
        sendResponse(clientSocket, 200, "text/plain", "OK");
        return;
    }

    // Extract body if POST
    std::string body = "";
    size_t headerEnd = request.find("\r\n\r\n");
    if (headerEnd != std::string::npos) {
        body = request.substr(headerEnd + 4);
    }

    // Route API requests
    if (path == "/api/status" && method == "GET") {
        sendResponse(clientSocket, 200, "application/json", manager.getStatusJson());
    }
    else if (path == "/api/queue" && method == "GET") {
        sendResponse(clientSocket, 200, "application/json", manager.getQueueJson());
    }
    else if (path == "/api/history" && method == "GET") {
        sendResponse(clientSocket, 200, "application/json", manager.getHistoryJson());
    }
    else if (path == "/api/enqueue" && method == "POST") {
        std::string student = parseJsonField(body, "studentName");
        std::string doc = parseJsonField(body, "documentName");
        std::string pagesStr = parseJsonField(body, "pageCount");
        std::string type = parseJsonField(body, "docType");
        std::string customId = parseJsonField(body, "jobId");

        int pages = 1;
        try {
            if (!pagesStr.empty()) pages = std::stoi(pagesStr);
        } catch (...) {
            pages = 1;
        }

        if (student.empty() || doc.empty() || pages <= 0) {
            sendResponse(clientSocket, 400, "application/json",
                         "{\"success\":false,\"error\":\"Student name and document name required; pages must be > 0.\"}");
            return;
        }

        if (type.empty()) type = "PDF";

        PrintJob job = manager.enqueueJob(student, doc, pages, type, customId);
        std::ostringstream resp;
        resp << "{\"success\":true,\"message\":\"Enqueued successfully\",\"job\":" << jobToJson(job)
             << ",\"queueSize\":" << manager.getQueueSize() << "}";
        sendResponse(clientSocket, 200, "application/json", resp.str());
    }
    else if (path == "/api/dequeue" && method == "POST") {
        try {
            PrintJob job = manager.dequeueJob();
            std::ostringstream resp;
            resp << "{\"success\":true,\"job\":" << jobToJson(job)
                 << ",\"queueSize\":" << manager.getQueueSize() << "}";
            sendResponse(clientSocket, 200, "application/json", resp.str());
        } catch (const QueueUnderflowException& e) {
            sendResponse(clientSocket, 400, "application/json",
                         std::string("{\"success\":false,\"error\":\"") + e.what() + "\"}");
        }
    }
    else if (path == "/api/peek/front" && method == "GET") {
        PrintJob frontJob;
        if (manager.peekFront(frontJob)) {
            sendResponse(clientSocket, 200, "application/json",
                         "{\"success\":true,\"job\":" + jobToJson(frontJob) + "}");
        } else {
            sendResponse(clientSocket, 400, "application/json",
                         "{\"success\":false,\"error\":\"Queue is empty. Front cannot be inspected.\"}");
        }
    }
    else if (path == "/api/peek/rear" && method == "GET") {
        PrintJob rearJob;
        if (manager.peekRear(rearJob)) {
            sendResponse(clientSocket, 200, "application/json",
                         "{\"success\":true,\"job\":" + jobToJson(rearJob) + "}");
        } else {
            sendResponse(clientSocket, 400, "application/json",
                         "{\"success\":false,\"error\":\"Queue is empty. Rear cannot be inspected.\"}");
        }
    }
    else if (path == "/api/print/next" && method == "POST") {
        PrintJob nextJob;
        if (manager.startPrintNext(nextJob)) {
            sendResponse(clientSocket, 200, "application/json",
                         "{\"success\":true,\"job\":" + jobToJson(nextJob) + "}");
        } else {
            sendResponse(clientSocket, 400, "application/json",
                         "{\"success\":false,\"error\":\"Cannot start printing. Printer may be busy or queue is empty.\"}");
        }
    }
    else if (path == "/api/print/progress" && method == "POST") {
        std::string pageStr = parseJsonField(body, "page");
        int page = 0;
        try { if (!pageStr.empty()) page = std::stoi(pageStr); } catch (...) {}
        manager.updatePrintProgress(page);
        sendResponse(clientSocket, 200, "application/json", "{\"success\":true}");
    }
    else if (path == "/api/print/complete" && method == "POST") {
        PrintJob completed;
        if (manager.completeCurrentJob(completed)) {
            sendResponse(clientSocket, 200, "application/json",
                         "{\"success\":true,\"completedJob\":" + jobToJson(completed) + "}");
        } else {
            sendResponse(clientSocket, 400, "application/json",
                         "{\"success\":false,\"error\":\"No active job to complete.\"}");
        }
    }
    else if (path == "/api/print/pause" && method == "POST") {
        manager.pausePrinter();
        sendResponse(clientSocket, 200, "application/json", "{\"success\":true,\"status\":\"PAUSED\"}");
    }
    else if (path == "/api/print/resume" && method == "POST") {
        manager.resumePrinter();
        sendResponse(clientSocket, 200, "application/json", "{\"success\":true,\"status\":\"RESUMED\"}");
    }
    else if (path == "/api/clear" && method == "POST") {
        manager.clearWaitingQueue();
        sendResponse(clientSocket, 200, "application/json", "{\"success\":true,\"message\":\"Waiting queue cleared.\"}");
    }
    else if (path == "/api/reset" && method == "POST") {
        manager.resetAll();
        sendResponse(clientSocket, 200, "application/json", "{\"success\":true,\"message\":\"Simulation reset.\"}");
    }
    else if (path == "/api/demo" && method == "POST") {
        std::string resp = manager.loadDemoScenario();
        sendResponse(clientSocket, 200, "application/json", resp);
    }
    // Static file serving
    else if (path == "/" || path == "/index.html") {
        sendFileResponse(clientSocket, "index.html", "text/html; charset=utf-8");
    }
    else if (path == "/style.css") {
        sendFileResponse(clientSocket, "style.css", "text/css; charset=utf-8");
    }
    else if (path == "/script.js") {
        sendFileResponse(clientSocket, "script.js", "application/javascript; charset=utf-8");
    }
    else if (path == "/README.md") {
        sendFileResponse(clientSocket, "README.md", "text/plain; charset=utf-8");
    }
    else {
        sendResponse(clientSocket, 404, "text/plain", "404 Not Found");
    }
}
