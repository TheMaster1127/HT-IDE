#include <algorithm>
#include <any>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <thread>
#include <type_traits>
#include <vector>

// Print function for const char* specifically
void print(const char* value) {
    std::cout << std::string(value) << std::endl;  // Convert const char* to std::string
}
// Print function that converts all types to string if needed
template <typename T>
void print(const T& value) {
    std::cout << value << std::endl;
}

// Convert std::string to int
int INT(const std::string& str) {
    std::istringstream iss(str);
    int value;
    iss >> value;
    return value;
}

// Function to sleep for a specified number of milliseconds
void Sleep(int milliseconds) {
    std::this_thread::sleep_for(std::chrono::milliseconds(milliseconds));
}

// Function to get input from the user, similar to Python's input() function
std::string input(const std::string& prompt) {
    std::string userInput;
    std::cout << prompt; // Display the prompt to the user
    std::getline(std::cin, userInput); // Get the entire line of input
    return userInput;
}


int main(int argc, char* argv[]) {
    //B:
    //MsgBox, hi
    //subout
    //
    //main
    //gui pid:"gui1" x50% y50% w50% h50%
    //gui pid:"gui1" fB button x50% y20%;
    int num = INT(input("how mnay loops: "));
    for (int A_Index1 = 0; A_Index1 < num + 0; A_Index1++) {
        Sleep(100);
        print(A_Index1);
    }
    

    return 0;
}