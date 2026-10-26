CXX = clang++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
LDFLAGS = -lpthread

TARGET = printqueue_server
TEST_TARGET = test_runner
SRCS = queue.cpp server.cpp main.cpp
OBJS = $(SRCS:.cpp=.o)

all: $(TARGET) $(TEST_TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJS) $(LDFLAGS)

$(TEST_TARGET): queue.cpp test_queue.cpp
	$(CXX) $(CXXFLAGS) queue.cpp test_queue.cpp -o $(TEST_TARGET)

test: $(TEST_TARGET)
	./$(TEST_TARGET)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

run: $(TARGET)
	./$(TARGET) 8080

clean:
	rm -f $(OBJS) $(TARGET) $(TEST_TARGET)

.PHONY: all run test clean
