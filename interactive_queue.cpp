#include <iostream>
#include <queue>
#include <string>

using namespace std;

// Function to print the queue elements without destroying the original queue
void displayQueue(queue<string> q) {
    if (q.empty()) {
        cout << "\n[Queue is Empty] No documents waiting.\n";
        return;
    }

    cout << "\nCurrent Queue (FRONT to REAR):\n";
    cout << "-------------------------------------------\n";
    cout << " [FRONT] -> ";
    while (!q.empty()) {
        cout << "[" << q.front() << "]";
        q.pop(); // Remove from copy to show next
        if (!q.empty()) {
            cout << " -> ";
        }
    }
    cout << " <- [REAR]\n";
    cout << "-------------------------------------------\n";
}

int main() {
    queue<string> printerQueue;
    int choice;
    string documentName;

    cout << "====================================================\n";
    cout << "    SIMPLE PRINTER QUEUE (FIFO DEMONSTRATION)       \n";
    cout << "====================================================\n";
    cout << "A Queue is like a line of people at a ticket counter.\n";
    cout << "RULE: First document to enter is the first to print!\n";
    cout << "      New documents always join at the back (REAR).\n";
    cout << "====================================================\n";

    while (true) {
        cout << "\n--- MENU ---\n";
        cout << "1. Add a Document (Enqueue / push)\n";
        cout << "2. Print Next Document (Dequeue / pop)\n";
        cout << "3. Look at Front Document (front)\n";
        cout << "4. Show All Documents in Line (display)\n";
        cout << "5. Check Total Waiting Count (size)\n";
        cout << "6. Exit\n";
        cout << "Enter your choice (1-6): ";
        
        if (!(cin >> choice)) {
            cout << "Invalid input! Please enter a number from 1 to 6.\n";
            cin.clear();
            cin.ignore(1000, '\n');
            continue;
        }

        switch (choice) {
            case 1: {
                // ENQUEUE: User enters input
                cout << "\nEnter document name (e.g., Assignment1.pdf): ";
                cin >> documentName;

                printerQueue.push(documentName);

                cout << "\n>>> RESULT:";
                cout << "\n'" << documentName << "' was added to the REAR of the queue.";
                cout << "\nConcept: New items always go to the back of the line.\n";
                break;
            }

            case 2: {
                // DEQUEUE: Check if empty first, then remove
                if (printerQueue.empty()) {
                    cout << "\n>>> QUEUE UNDERFLOW!";
                    cout << "\nCannot print because the queue is empty.\n";
                } else {
                    string nextDoc = printerQueue.front(); // 1. Read front
                    printerQueue.pop();                    // 2. Remove front

                    cout << "\n>>> RESULT:";
                    cout << "\nPrinted and removed: '" << nextDoc << "' from the FRONT.";
                    cout << "\nConcept: First-In, First-Out (FIFO).";
                    cout << "\nThe oldest document prints first!\n";
                }
                break;
            }

            case 3: {
                // PEEK: Check front without removing
                if (printerQueue.empty()) {
                    cout << "\n>>> The queue is empty. No document is at the front.\n";
                } else {
                    cout << "\n>>> FRONT DOCUMENT (Next in line): " << printerQueue.front();
                    cout << "\nConcept: Looking at the front does NOT remove the item.\n";
                }
                break;
            }

            case 4: {
                // DISPLAY
                displayQueue(printerQueue);
                break;
            }

            case 5: {
                // SIZE
                cout << "\n>>> Total documents currently waiting: " << printerQueue.size() << "\n";
                break;
            }

            case 6: {
                cout << "\nExiting Printer Queue Simulator. Goodbye!\n";
                return 0;
            }

            default:
                cout << "\nInvalid choice! Please choose a number between 1 and 6.\n";
                break;
        }
    }

    return 0;
}
