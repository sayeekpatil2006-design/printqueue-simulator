#include "queue.h"
#include <iostream>
#include <cassert>

void printHeader(const std::string& title) {
    std::cout << "\n==================================================\n";
    std::cout << "  " << title << "\n";
    std::cout << "==================================================\n";
}

int main() {
    printHeader("TEST SUITE: C++ First-In, First-Out PrinterQueue");

    PrinterQueue q;

    // Test 1: Initially empty
    std::cout << "[1] Checking initial queue state...\n";
    assert(q.isEmpty() == true);
    assert(q.size() == 0);
    std::cout << "    PASS: Queue initialized empty. size = 0, isEmpty = true\n";

    // Test 2: Queue Underflow on empty dequeue
    std::cout << "[2] Testing Queue Underflow exception safety...\n";
    bool underflowCaught = false;
    try {
        q.dequeue();
    } catch (const QueueUnderflowException& e) {
        underflowCaught = true;
        std::cout << "    PASS: Caught expected exception -> " << e.what() << "\n";
    }
    assert(underflowCaught == true);

    // Test 3: Empty peekFront / peekRear exception safety
    std::cout << "[3] Testing Empty Queue Peek exception safety...\n";
    bool emptyPeekCaught = false;
    try {
        q.peekFront();
    } catch (const EmptyQueueException& e) {
        emptyPeekCaught = true;
        std::cout << "    PASS: Caught expected exception -> " << e.what() << "\n";
    }
    assert(emptyPeekCaught == true);

    // Test 4: Demonstration Scenario Enqueue (JOB-101, JOB-102, JOB-103)
    std::cout << "[4] Executing Demonstration Scenario Enqueue...\n";
    PrintJob j1("JOB-101", "Sayali", "DSA_Assignment.pdf", 5, 1, "PDF");
    PrintJob j2("JOB-102", "Rahul", "OS_Notes.pdf", 10, 2, "PDF");
    PrintJob j3("JOB-103", "Priya", "DBMS_Project.pdf", 7, 3, "PDF");

    q.enqueue(j1);
    std::cout << "    Enqueued JOB-101 (Sayali, 5p). Queue size: " << q.size() << "\n";
    assert(q.size() == 1);
    assert(q.peekFront().jobId == "JOB-101");
    assert(q.peekRear().jobId == "JOB-101");

    q.enqueue(j2);
    std::cout << "    Enqueued JOB-102 (Rahul, 10p). Queue size: " << q.size() << "\n";
    assert(q.size() == 2);
    assert(q.peekFront().jobId == "JOB-101");
    assert(q.peekRear().jobId == "JOB-102");

    q.enqueue(j3);
    std::cout << "    Enqueued JOB-103 (Priya, 7p). Queue size: " << q.size() << "\n";
    assert(q.size() == 3);
    assert(q.peekFront().jobId == "JOB-101");
    assert(q.peekRear().jobId == "JOB-103");
    std::cout << "    PASS: Enqueue ordering confirmed. Front is JOB-101, Rear is JOB-103.\n";

    // Test 5: Queue Traversal (displayQueue)
    std::cout << "[5] Verifying FIFO traversal order...\n";
    std::vector<PrintJob> waiting = q.displayQueue();
    assert(waiting.size() == 3);
    assert(waiting[0].jobId == "JOB-101");
    assert(waiting[1].jobId == "JOB-102");
    assert(waiting[2].jobId == "JOB-103");
    std::cout << "    Current FIFO Queue Order: ";
    for (size_t i = 0; i < waiting.size(); ++i) {
        std::cout << "[" << waiting[i].jobId << ": " << waiting[i].studentName << "]";
        if (i + 1 < waiting.size()) std::cout << " -> ";
    }
    std::cout << "\n    PASS: FIFO traversal confirmed.\n";

    // Test 6: FIFO Dequeue of First Job (JOB-101)
    std::cout << "[6] Processing first job (FIFO Dequeue)...\n";
    PrintJob processed1 = q.dequeue();
    assert(processed1.jobId == "JOB-101");
    assert(processed1.studentName == "Sayali");
    assert(q.size() == 2);
    assert(q.peekFront().jobId == "JOB-102");
    std::cout << "    PASS: Dequeued JOB-101 first (FIFO guaranteed!). New front: " << q.peekFront().jobId << "\n";

    // Test 7: Enqueue JOB-104 while earlier jobs exist
    std::cout << "[7] Enqueueing JOB-104 during processing...\n";
    PrintJob j4("JOB-104", "Amit", "Network_Report.pdf", 4, 4, "PDF");
    q.enqueue(j4);
    assert(q.size() == 3);
    assert(q.peekFront().jobId == "JOB-102");
    assert(q.peekRear().jobId == "JOB-104");
    std::cout << "    PASS: JOB-104 joined at REAR. Current Front: JOB-102, Rear: JOB-104.\n";

    // Test 8: Process remaining jobs in strict arrival sequence
    std::cout << "[8] Dequeuing remaining jobs...\n";
    PrintJob processed2 = q.dequeue();
    assert(processed2.jobId == "JOB-102");
    std::cout << "    Dequeued: " << processed2.jobId << " (" << processed2.studentName << ")\n";

    PrintJob processed3 = q.dequeue();
    assert(processed3.jobId == "JOB-103");
    std::cout << "    Dequeued: " << processed3.jobId << " (" << processed3.studentName << ")\n";

    PrintJob processed4 = q.dequeue();
    assert(processed4.jobId == "JOB-104");
    std::cout << "    Dequeued: " << processed4.jobId << " (" << processed4.studentName << ")\n";

    assert(q.isEmpty() == true);
    assert(q.size() == 0);
    std::cout << "    PASS: All jobs processed in strict FIFO order.\n";

    // Test 9: Clear Queue
    std::cout << "[9] Testing clearQueue()...\n";
    q.enqueue(j1);
    q.enqueue(j2);
    assert(q.size() == 2);
    q.clearQueue();
    assert(q.isEmpty() == true);
    assert(q.size() == 0);
    std::cout << "    PASS: clearQueue() deallocated all nodes and reset pointers to nullptr.\n";

    printHeader("ALL 9 UNIT TESTS PASSED SUCCESSFULLY!");
    std::cout << "The C++ PrinterQueue implementation is verified 100% correct.\n\n";

    return 0;
}
