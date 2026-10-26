#include "queue.h"
#include <iostream>

/**
 * Constructor: Initializes an empty queue.
 * Front and rear pointers are set to nullptr, and initial sequence begins at 101.
 */
PrinterQueue::PrinterQueue() 
    : frontPtr(nullptr), rearPtr(nullptr), currentSize(0), nextSequenceNumber(101) {}

/**
 * Destructor: Traverses the linked list and releases all dynamically allocated nodes
 * to prevent memory leaks.
 */
PrinterQueue::~PrinterQueue() {
    clearQueue();
}

/**
 * Enqueue Operation (Push to Rear):
 * Adds a new print job to the rear of the queue.
 * 
 * Algorithm:
 * 1. Allocate a new QueueNode with the incoming PrintJob.
 * 2. If the queue is empty (frontPtr == nullptr):
 *    - Both frontPtr and rearPtr point to the new node.
 * 3. If the queue is not empty:
 *    - Link rearPtr->next to the new node.
 *    - Update rearPtr to point to the new node.
 * 4. Increment currentSize.
 * 
 * Time Complexity: O(1)
 */
void PrinterQueue::enqueue(const PrintJob& job) {
    QueueNode* newNode = new QueueNode(job);

    if (isEmpty()) {
        frontPtr = newNode;
        rearPtr = newNode;
    } else {
        rearPtr->next = newNode;
        rearPtr = newNode;
    }

    currentSize++;
}

/**
 * Dequeue Operation (Pop from Front):
 * Removes and returns the job at the front of the queue.
 * 
 * Algorithm:
 * 1. Check for queue underflow (if isEmpty()). If empty, throw QueueUnderflowException.
 * 2. Store the front node in a temporary pointer `temp`.
 * 3. Extract the PrintJob data from `temp->data`.
 * 4. Advance frontPtr to `frontPtr->next`.
 * 5. If frontPtr becomes nullptr (queue is now empty), set rearPtr to nullptr as well.
 * 6. Delete `temp` to free allocated memory.
 * 7. Decrement currentSize.
 * 8. Return the extracted PrintJob.
 * 
 * Time Complexity: O(1)
 */
PrintJob PrinterQueue::dequeue() {
    if (isEmpty()) {
        throw QueueUnderflowException();
    }

    QueueNode* temp = frontPtr;
    PrintJob frontJob = temp->data;

    frontPtr = frontPtr->next;

    // If the queue has become empty after removing the only node
    if (frontPtr == nullptr) {
        rearPtr = nullptr;
    }

    delete temp;
    currentSize--;

    return frontJob;
}

/**
 * Peek Front Operation:
 * Inspects the element at the front of the queue without removing it.
 * 
 * Time Complexity: O(1)
 */
const PrintJob& PrinterQueue::peekFront() const {
    if (isEmpty()) {
        throw EmptyQueueException("peekFront");
    }
    return frontPtr->data;
}

/**
 * Peek Rear Operation:
 * Inspects the element at the rear of the queue without removing it.
 * 
 * Time Complexity: O(1)
 */
const PrintJob& PrinterQueue::peekRear() const {
    if (isEmpty()) {
        throw EmptyQueueException("peekRear");
    }
    return rearPtr->data;
}

/**
 * IsEmpty Operation:
 * Checks whether the queue has zero elements.
 * 
 * Time Complexity: O(1)
 */
bool PrinterQueue::isEmpty() const {
    return frontPtr == nullptr;
}

/**
 * Size Operation:
 * Returns the current count of elements waiting in the queue.
 * 
 * Time Complexity: O(1)
 */
int PrinterQueue::size() const {
    return currentSize;
}

/**
 * Clear Queue Operation:
 * Deallocates all nodes currently in the queue, resetting it to an empty state.
 * 
 * Time Complexity: O(n) where n is the number of elements.
 */
void PrinterQueue::clearQueue() {
    QueueNode* current = frontPtr;
    while (current != nullptr) {
        QueueNode* nextNode = current->next;
        delete current;
        current = nextNode;
    }
    frontPtr = nullptr;
    rearPtr = nullptr;
    currentSize = 0;
}

/**
 * Display Queue Operation:
 * Traverses the queue from front to rear and collects jobs in a vector in strict FIFO order.
 * 
 * Time Complexity: O(n)
 */
std::vector<PrintJob> PrinterQueue::displayQueue() const {
    std::vector<PrintJob> jobs;
    jobs.reserve(currentSize);

    QueueNode* current = frontPtr;
    while (current != nullptr) {
        jobs.push_back(current->data);
        current = current->next;
    }

    return jobs;
}
