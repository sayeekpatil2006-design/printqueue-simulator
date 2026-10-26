cmake_minimum_required(VERSION 3.12)
project(PrintQueueSimulator CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Server executable
add_executable(printqueue_server
    main.cpp
    server.cpp
    server.h
    queue.cpp
    queue.h
)

find_package(Threads REQUIRED)
target_link_libraries(printqueue_server PRIVATE Threads::Threads)

# Unit test executable
add_executable(test_runner
    test_queue.cpp
    queue.cpp
    queue.h
)
