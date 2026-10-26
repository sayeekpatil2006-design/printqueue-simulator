# PrintQueue Simulator — Interactive FIFO Printer Management and Learning Game

[![Language: C++17](https://img.shields.io/badge/C%2B%2B-17-blue.svg)](https://isocpp.org/)
[![Frontend: HTML5/CSS3/JS](https://img.shields.io/badge/Frontend-Vanilla%20JS%2FCSS3-orange.svg)](https://developer.mozilla.org/)
[![Architecture: Native POSIX HTTP](https://img.shields.io/badge/Architecture-Native%20HTTP%20Server-brightgreen.svg)]()
[![License: Educational](https://img.shields.io/badge/License-MIT-purple.svg)]()

> A realistic, interactive printer management system and educational game demonstrating the **Queue data structure** and its **First-In, First-Out (FIFO)** scheduling principle using genuine **C++** backend logic and a modern SaaS dashboard interface.

---

## 1. Project Overview & Problem Statement

In a university computer laboratory, multiple students concurrently submit print requests to a shared network laser printer. Because the printer can physically process only one document at a time, incoming print jobs must be buffered fairly and processed strictly in the order they arrived.

This real-world concurrency problem is modeled using the **Queue Data Structure** governed by the **First-In, First-Out (FIFO)** invariant:
* **The first document submitted is the first document printed.**
* **New incoming requests always enter at the rear (tail) of the queue.**
* **Documents are always removed and serviced from the front (head) of the queue.**

This project unifies three experiences into a single web application:
1. **Printer Management Dashboard**: A modern SaaS dashboard featuring real-time metrics, live horizontal queue visualization with directional flow indicators, a virtual laser printer with page-by-page progress animation, and print controls.
2. **Queue Laboratory (DSA Workbench)**: An interactive learning section where students execute manual queue operations (`enqueue`, `dequeue`, `peekFront`, `peekRear`, `isEmpty`, `clearQueue`), inspect explicit memory pointers (`frontPtr`, `rearPtr`), review state transitions, and observe **Queue Underflow** exception handling.
3. **FIFO Challenge Game**: A gamified 3-level quiz with timed questions, streak multipliers, dynamic queue scenarios, and instant educational explanations.

---

## 2. System Architecture & Technology Stack

The project uses a clean client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB CLIENT (Browser)                     │
│  - HTML5 / CSS3 / Vanilla JavaScript                        │
│  - Modern SaaS Dark UI (Navy/Charcoal with Blue & Violet)   │
│  - Real-time Visualizer & FIFO Game Engine                  │
└──────────────────────────────▲──────────────────────────────┘
                               │
                HTTP / JSON REST API (Port 8080)
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  NATIVE C++ BACKEND SERVER                  │
│  - server.cpp: Zero-dependency POSIX Socket HTTP Server     │
│  - Multi-threaded Request Handler (std::thread, std::mutex) │
│  - Static Asset File Server (index.html, style.css, JS)     │
└──────────────────────────────▲──────────────────────────────┘
                               │
                     Pointer Manipulation
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    CORE C++ QUEUE MODULE                    │
│  - queue.h & queue.cpp                                      │
│  - Custom Linked-List Queue with explicit frontPtr, rearPtr │
│  - O(1) Enqueue, O(1) Dequeue, Safe Underflow Handling      │
└─────────────────────────────────────────────────────────────┘
```

### Dual-Mode Execution Guarantee
* **Full C++ Backend Mode**: When compiled and running (`./printqueue_server`), the web interface communicates directly with the C++ REST API on port 8080. All enqueue, dequeue, peek, and traversal operations are genuinely executed by the C++ queue.
* **Standalone Demonstration Mode**: If a browser opens `index.html` directly before launching the C++ binary, the application detects this immediately, displays a clear status banner, and activates an in-browser fallback engine so the application remains 100% interactive and never presents broken buttons.

---

## 3. C++ Queue Implementation Details

The core data structure is implemented in [`queue.h`](file:///Users/sayee/Downloads/Projects/queue.h) and [`queue.cpp`](file:///Users/sayee/Downloads/Projects/queue.cpp).

### 3.1 Data Structures
```cpp
// Structure representing an individual print request
struct PrintJob {
    std::string jobId;           // Unique identifier (e.g., "JOB-101")
    std::string studentName;     // Student submitting the job
    std::string documentName;    // Filename
    int pageCount;               // Number of pages (> 0)
    int arrivalSequence;         // Arrival order counter (1, 2, 3...)
    std::string docType;         // Document format ("PDF", "DOCX", etc.)
    JobStatus status;            // WAITING, PRINTING, COMPLETED
    std::string submittedTime;   // Submission timestamp
    int estimatedPrintTimeSec;   // Estimated print duration
};

// Node structure for linked-list based queue
struct QueueNode {
    PrintJob data;
    QueueNode* next;
    explicit QueueNode(const PrintJob& job) : data(job), next(nullptr) {}
};
```

### 3.2 Time Complexity & Operations

| Operation | C++ Method | Pointer Mechanism | Time Complexity | STL `std::queue` Equivalent |
|---|---|---|---|---|
| **Enqueue** | `enqueue(job)` | Attaches node to `rearPtr->next`, updates `rearPtr = newNode` | **O(1)** | `push(job)` |
| **Dequeue** | `dequeue()` | Retrieves `frontPtr->data`, advances `frontPtr = frontPtr->next`, frees memory | **O(1)** | `front()` + `pop()` |
| **Peek Front** | `peekFront()` | Inspects `frontPtr->data` without removing | **O(1)** | `front()` |
| **Peek Rear** | `peekRear()` | Inspects `rearPtr->data` without removing | **O(1)** | `back()` |
| **Is Empty** | `isEmpty()` | Evaluates `frontPtr == nullptr` | **O(1)** | `empty()` |
| **Size** | `size()` | Returns `currentSize` tracking variable | **O(1)** | `size()` |
| **Clear Queue** | `clearQueue()` | Deallocates all nodes; sets `frontPtr = rearPtr = nullptr` | **O(n)** | Loop while not empty |
| **Display** | `displayQueue()` | Traverses linked list from `frontPtr` to `nullptr` | **O(n)** | N/A (STL requires copy) |

> **Important DSA Note on `std::queue::pop()`**: In C++ STL, `std::queue::pop()` removes the front element but returns `void` to maintain strong exception safety. In contrast, our custom `PrinterQueue::dequeue()` safely retrieves the element, updates pointers, frees node memory, and returns the data.

---

## 4. File Organization

```
/Users/sayee/Downloads/Projects/
├── CMakeLists.txt        # CMake build configuration
├── Makefile              # Native Makefile (clang++ / g++)
├── README.md             # Complete documentation and viva guide
├── index.html            # Dashboard, Lab, and Game interface
├── main.cpp              # Server entry point & signal handling (SIGINT)
├── queue.cpp             # Implementation of C++ FIFO Queue
├── queue.h               # Data structures, classes & custom exceptions
├── script.js             # Client engine, REST API client, game engine
├── server.cpp            # Zero-dependency POSIX HTTP server & REST API
├── server.h              # Server class & SimulationManager header
├── start.sh              # 1-click build and launch script
├── style.css             # Dark SaaS styling & animation system
└── test_queue.cpp        # 9 automated correctness unit tests
```

---

## 5. Installation & Execution Guide

### 5.1 Prerequisites
* **Operating System**: macOS (Apple Silicon or Intel), Linux, or Windows (WSL / MinGW).
* **Compiler**: Any standard C++17 compiler (`clang++` or `g++`).
  * On macOS: Run `xcode-select --install` if clang is not already installed.
* **Web Browser**: Chrome, Safari, Firefox, or Edge.
* **Code Editor (Optional)**: Visual Studio Code.

### 5.2 Opening in Visual Studio Code
1. Open terminal and navigate to the directory:
   ```bash
   cd /Users/sayee/Downloads/Projects
   ```
2. Open VS Code:
   ```bash
   code .
   ```

### 5.3 Quick Launch (1 Command)
Run the automated start script:
```bash
./start.sh
```
This compiles the code, executes all unit tests, starts the native C++ HTTP server on port 8080, and prints the browser URL.

### 5.4 Manual Compilation & Execution

#### Option A: Using `make` (Recommended)
```bash
# Build the C++ server and test runner
make all

# Run unit tests to verify queue correctness
make test

# Start the server on port 8080
make run
```

#### Option B: Direct compilation with `clang++` or `g++`
```bash
# Compile server
clang++ -std=c++17 -Wall -Wextra -O2 queue.cpp server.cpp main.cpp -o printqueue_server -lpthread

# Run server
./printqueue_server 8080
```

### 5.5 Accessing the Web Application
Open your web browser and navigate to:
```
http://localhost:8080
```
The status pill in the top-right header will display:
🟢 **`C++ Backend Connected (Port 8080)`**

---

## 6. Demonstration Scenario (Lab Viva-Voce Walkthrough)

To demonstrate the First-In, First-Out (FIFO) principle during a lab evaluation, follow this standard scenario:

### Step 1: Submit Initial Print Requests in Arrival Order
Submit the three designated jobs (or click **"⚡ Load Demo Scenario"**):
1. **JOB-101**: Student **Sayali** — `DSA_Assignment.pdf` — **5 pages** (Arrived 1st).
2. **JOB-102**: Student **Rahul** — `OS_Notes.pdf` — **10 pages** (Arrived 2nd).
3. **JOB-103**: Student **Priya** — `DBMS_Project.pdf` — **7 pages** (Arrived 3rd).

#### Resulting Queue State:
```
[FRONT: Next to Print]                            [REAR: Last Arrival]
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│     JOB-101      │───►│     JOB-102      │───►│     JOB-103      │
│  Sayali (5 pages)│    │  Rahul (10 pages)│    │  Priya (7 pages) │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```
* **Front pointer** points to `JOB-101`.
* **Rear pointer** points to `JOB-103`.

### Step 2: Trigger Dequeue (`Print Next`)
1. Click **`Print Next (FIFO Dequeue)`**.
2. **Observation**: `JOB-101` is removed from the front and enters the virtual printer.
3. Paper animation feeds out, and progress indicates page 1 through 5.
4. **Queue state updates**: `JOB-102` (Rahul) immediately advances to become the new **FRONT**.

### Step 3: Add `JOB-104` While `JOB-101` is Printing
1. While `JOB-101` is printing, submit a new document:
   * Student: **Amit**
   * Document: `Network_Security.pdf`
   * Pages: **4 pages**
2. Click **Submit to Queue Rear**.
3. **Observation**: `JOB-104` enters at the **REAR** of the queue, behind `JOB-103`.
4. It does **not** jump in front of `JOB-102` or `JOB-103`, proving the arrival order invariant.

### Step 4: Complete Printing & Observe FIFO Progression
1. When `JOB-101` completes, it transitions to the **Completed Jobs** table with arrival sequence `#1` and completion sequence `#1`.
2. Click **Print Next** again: `JOB-102` is dequeued and printed next, followed by `JOB-103`, and finally `JOB-104`.

#### Conclusion Proving FIFO:
Regardless of page count (even though Amit's document was only 4 pages compared to Rahul's 10 pages), the service order was strictly:
$$\text{JOB-101} \longrightarrow \text{JOB-102} \longrightarrow \text{JOB-103} \longrightarrow \text{JOB-104}$$

---

## 7. Edge Cases & Boundary Handling

1. **Queue Underflow**:
   * Attempting to dequeue an empty queue (`frontPtr == nullptr`) throws `QueueUnderflowException`. The UI captures this in the Queue Laboratory and renders a warning explaining how C++ prevents null pointer dereferencing.
2. **Safe Peek Checks**:
   * Calling `peekFront()` or `peekRear()` on an empty queue throws `EmptyQueueException` rather than returning undefined memory.
3. **Queue Clearing During Active Print**:
   * Clicking **Clear Waiting Queue** deallocates all waiting nodes in the queue, but does **not** interrupt the job actively being printed by the virtual hardware printer.
4. **Form Input Validation**:
   * Empty student names, empty document titles, or non-positive integers ($pages \le 0$) are rejected with inline validation messages.
5. **No Duplicate Processing**:
   * Once a job is dequeued, it cannot be processed twice; completion records are permanently archived in the audit history.

---

## 8. Viva-Voce Examination Questions & Answers

### Q1: What is a Queue, and why is it suitable for printer spooling?
**Answer:** A Queue is a linear data structure following the **First-In, First-Out (FIFO)** discipline. In printer spooling, multiple users share a single sequential resource. A queue guarantees fairness: the job submitted earliest is always serviced first, preventing starvation.

### Q2: Why implement the queue with a linked list rather than a simple array?
**Answer:** A simple array requires $O(n)$ time to shift remaining elements left upon each dequeue, or requires complex wrap-around logic (circular array). A linked list with explicit `frontPtr` and `rearPtr` pointers delivers true **$O(1)$ constant time** for both enqueue and dequeue operations without arbitrary capacity limits.

### Q3: What is the purpose of separate `frontPtr` and `rearPtr` pointers?
**Answer:** `rearPtr` enables inserting a new element at the tail in $O(1)$ time without traversing the entire list. `frontPtr` enables removing the oldest element from the head in $O(1)$ time.

### Q4: What happens if an element is popped from an empty queue?
**Answer:** This condition is known as **Queue Underflow**. In raw C++, dereferencing `nullptr` results in a segmentation fault or undefined behavior. Our implementation guards against this with safe empty checks (`isEmpty()`) and throws `QueueUnderflowException`.
