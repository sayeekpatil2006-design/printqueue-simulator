/**
 * ============================================================================
 * QUEUE BASICS IN C++: BEGINNER'S GUIDE & CORE CONCEPTS
 * ============================================================================
 * 
 * WHAT IS A QUEUE?
 * A Queue is a linear data structure that operates on the First-In, First-Out
 * (FIFO) principle.
 * 
 * REAL-LIFE ANALOGY:
 * Think of a queue at a movie ticket counter or a supermarket checkout line:
 * - The first person to stand in line is the first person to buy a ticket and leave.
 * - New people always join at the back (rear) of the line.
 * - Nobody cuts the line in the middle.
 * 
 * IN PRINTER MANAGEMENT:
 * - Document A arrives at 10:00 AM -> Enqueued at Rear.
 * - Document B arrives at 10:01 AM -> Enqueued at Rear.
 * - Document A is printed first because it is at the Front (FIFO).
 */

#include <iostream>
#include <queue>       // C++ Standard Library Queue
#include <string>

// ============================================================================
// PART 1: USING C++ STL std::queue (Standard Template Library)
// ============================================================================
void demonstrateSTLQueue() {
    std::cout << "\n--- PART 1: C++ STL std::queue Demonstration ---\n";

    // 1. Declaration: std::queue<DataType> queueName;
    std::queue<std::string> printLine;

    // 2. push() / enqueue: Adds an element to the REAR of the queue. O(1)
    std::cout << "[1] Students submit documents to the queue...\n";
    printLine.push("Document_1_Sayali.pdf");
    printLine.push("Document_2_Rahul.pdf");
    printLine.push("Document_3_Priya.pdf");

    // 3. size(): Returns the total number of waiting elements. O(1)
    std::cout << "    Total waiting documents: " << printLine.size() << "\n";

    // 4. front(): Inspects the element at the FRONT (oldest arrival). O(1)
    std::cout << "    Front document (next to print): " << printLine.front() << "\n";

    // 5. back(): Inspects the element at the REAR (newest arrival). O(1)
    std::cout << "    Rear document (last to arrive):  " << printLine.back() << "\n";

    // 6. empty(): Returns true if size == 0, false otherwise. O(1)
    std::cout << "    Is queue empty? " << (printLine.empty() ? "Yes" : "No") << "\n";

    // 7. pop() / dequeue: Removes the element at the FRONT. O(1)
    // NOTE: In C++, pop() removes the element but does NOT return it.
    // Always call front() first to read the data, then call pop().
    std::cout << "\n[2] Processing documents in strict FIFO order:\n";
    int step = 1;
    while (!printLine.empty()) {
        std::string currentDoc = printLine.front(); // Read front
        std::cout << "    Step " << step++ << ": Printing -> " << currentDoc << "\n";
        printLine.pop();                            // Remove front
    }

    std::cout << "    Queue size after printing all: " << printLine.size() << "\n";
    std::cout << "    Is queue empty now? " << (printLine.empty() ? "Yes" : "No") << "\n";
}

// ============================================================================
// PART 2: HOW A QUEUE WORKS UNDER THE HOOD (POINTERS & LINKED LIST)
// ============================================================================
/*
 * In memory, a custom queue maintains two pointers:
 * 
 * 1. frontPtr: Points to the first node (oldest element).
 * 2. rearPtr:  Points to the last node (newest element).
 * 
 * Visual Representation:
 * 
 *  frontPtr                                          rearPtr
 *     │                                                 │
 *     ▼                                                 ▼
 *  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 *  │ Data: Sayali │───► │ Data: Rahul  │───► │ Data: Priya  │───► nullptr
 *  └──────────────┘     └──────────────┘     └──────────────┘
 * 
 * Operations Breakdown:
 * - ENQUEUE(NewNode):
 *     rearPtr->next = NewNode;
 *     rearPtr = NewNode;
 *     (Time Complexity: O(1) constant time)
 * 
 * - DEQUEUE():
 *     temp = frontPtr;
 *     frontPtr = frontPtr->next;
 *     delete temp;
 *     (Time Complexity: O(1) constant time)
 * 
 * - UNDERFLOW:
 *     Attempting to dequeue when frontPtr == nullptr causes UNDERFLOW!
 *     Safe code must always check isEmpty() before dequeuing.
 */

struct SimpleNode {
    std::string documentName;
    SimpleNode* next;
    explicit SimpleNode(const std::string& name) : documentName(name), next(nullptr) {}
};

class SimpleQueue {
private:
    SimpleNode* frontPtr;
    SimpleNode* rearPtr;
    int count;

public:
    SimpleQueue() : frontPtr(nullptr), rearPtr(nullptr), count(0) {}

    ~SimpleQueue() {
        while (!isEmpty()) {
            dequeue();
        }
    }

    // Insert at REAR - O(1)
    void enqueue(const std::string& name) {
        SimpleNode* newNode = new SimpleNode(name);
        if (isEmpty()) {
            frontPtr = newNode;
            rearPtr = newNode;
        } else {
            rearPtr->next = newNode;
            rearPtr = newNode;
        }
        count++;
        std::cout << "    [+] Enqueued: " << name << " at REAR\n";
    }

    // Remove from FRONT - O(1)
    std::string dequeue() {
        if (isEmpty()) {
            std::cout << "    [!] Queue Underflow: Cannot dequeue an empty queue!\n";
            return "";
        }
        SimpleNode* temp = frontPtr;
        std::string name = temp->documentName;
        frontPtr = frontPtr->next;
        if (frontPtr == nullptr) {
            rearPtr = nullptr;
        }
        delete temp;
        count--;
        std::cout << "    [-] Dequeued: " << name << " from FRONT\n";
        return name;
    }

    bool isEmpty() const { return frontPtr == nullptr; }
    int size() const { return count; }
};

void demonstrateCustomQueue() {
    std::cout << "\n--- PART 2: Custom Pointer-Based Queue Demonstration ---\n";
    SimpleQueue q;

    q.enqueue("Lab_Report_1.pdf");
    q.enqueue("Lab_Report_2.pdf");

    std::cout << "    Current size: " << q.size() << "\n";

    q.dequeue(); // Removes Lab_Report_1.pdf
    q.enqueue("Lab_Report_3.pdf"); // Joins rear

    q.dequeue(); // Removes Lab_Report_2.pdf
    q.dequeue(); // Removes Lab_Report_3.pdf

    // Intentionally test underflow
    std::cout << "\nTesting Underflow on empty queue:\n";
    q.dequeue();
}

int main() {
    std::cout << "========================================================\n";
    std::cout << "   C++ QUEUE DATA STRUCTURE: BASIC CONCEPTS TUTORIAL    \n";
    std::cout << "========================================================\n";

    demonstrateSTLQueue();
    demonstrateCustomQueue();

    std::cout << "\n========================================================\n";
    std::cout << "   TUTORIAL COMPLETE: FIFO MECHANISM VERIFIED           \n";
    std::cout << "========================================================\n";
    return 0;
}
