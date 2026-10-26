#ifndef QUEUE_H
#define QUEUE_H

#include <string>
#include <vector>
#include <stdexcept>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

// Status enumeration for print requests
enum class JobStatus {
    WAITING,
    PRINTING,
    COMPLETED,
    CANCELLED
};

// Converts JobStatus to string representation
inline std::string jobStatusToString(JobStatus status) {
    switch (status) {
        case JobStatus::WAITING:   return "WAITING";
        case JobStatus::PRINTING:  return "PRINTING";
        case JobStatus::COMPLETED: return "COMPLETED";
        case JobStatus::CANCELLED: return "CANCELLED";
        default:                   return "UNKNOWN";
    }
}

// PrintJob structure representing an individual print request
struct PrintJob {
    std::string jobId;           // Unique identifier (e.g., "JOB-101")
    std::string studentName;     // Name of the student submitting the document
    std::string documentName;    // Title/Filename of the document
    int pageCount;               // Number of pages to print (> 0)
    int arrivalSequence;         // Sequence number based on arrival order (1, 2, 3...)
    std::string docType;         // Document type (e.g., "PDF", "DOCX", "CODE")
    JobStatus status;            // Current status
    std::string submittedTime;   // ISO or readable timestamp of submission
    int estimatedPrintTimeSec;   // Estimated printing duration in seconds

    PrintJob()
        : pageCount(1), arrivalSequence(0), status(JobStatus::WAITING), estimatedPrintTimeSec(2) {}

    PrintJob(std::string id, std::string student, std::string doc, int pages, int seq, std::string type = "PDF")
        : jobId(id), studentName(student), documentName(doc), pageCount(pages),
          arrivalSequence(seq), docType(type), status(JobStatus::WAITING) {
        // Calculate estimated printing time (e.g., ~1.2 seconds per page in simulation)
        estimatedPrintTimeSec = (pages > 0) ? (pages * 1) : 1;
        
        // Generate current timestamp
        auto now = std::chrono::system_clock::now();
        std::time_t now_c = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::localtime(&now_c), "%H:%M:%S");
        submittedTime = ss.str();
    }
};

// Node structure for linked-list based custom queue
struct QueueNode {
    PrintJob data;
    QueueNode* next;

    explicit QueueNode(const PrintJob& job) : data(job), next(nullptr) {}
};

// Custom exception for Queue Underflow
class QueueUnderflowException : public std::runtime_error {
public:
    QueueUnderflowException() : std::runtime_error("Queue Underflow: Attempted to dequeue from an empty queue.") {}
};

// Custom exception for Empty Queue Access
class EmptyQueueException : public std::runtime_error {
public:
    EmptyQueueException(const std::string& op) 
        : std::runtime_error("Empty Queue Access: Cannot perform " + op + " on an empty queue.") {}
};

/**
 * PrinterQueue: Dedicated C++ implementation of a First-In, First-Out (FIFO) Queue.
 *
 * Demonstrates explicit pointer manipulation with:
 * - front pointer: references the oldest waiting job (first to be dequeued/printed).
 * - rear pointer: references the most recently arrived job.
 * 
 * Time Complexities:
 * - enqueue: O(1)
 * - dequeue: O(1)
 * - peekFront: O(1)
 * - peekRear: O(1)
 * - size: O(1)
 * - isEmpty: O(1)
 */
class PrinterQueue {
private:
    QueueNode* frontPtr;    // Points to the front node (FIFO head)
    QueueNode* rearPtr;     // Points to the rear node (FIFO tail)
    int currentSize;        // Number of jobs currently waiting
    int nextSequenceNumber; // Auto-incrementing arrival sequence counter

public:
    PrinterQueue();
    ~PrinterQueue();

    // Prevent inadvertent shallow copy
    PrinterQueue(const PrinterQueue& other) = delete;
    PrinterQueue& operator=(const PrinterQueue& other) = delete;

    // Core FIFO Queue Operations
    void enqueue(const PrintJob& job);
    PrintJob dequeue();
    const PrintJob& peekFront() const;
    const PrintJob& peekRear() const;
    bool isEmpty() const;
    int size() const;
    void clearQueue();

    // Inspection & Traversal
    std::vector<PrintJob> displayQueue() const;

    // Helpers
    int getNextSequenceNumber() const { return nextSequenceNumber; }
    void incrementSequenceNumber() { nextSequenceNumber++; }
    void resetSequenceCounter() { nextSequenceNumber = 101; }
};

#endif // QUEUE_H
