cmake_minimum_required(VERSION 3.20)
project(mocap_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(pybind11 CONFIG REQUIRED)

pybind11_add_module(mocap_core server/cpp/mocap_core.cpp)
install(TARGETS mocap_core DESTINATION smart_behaviors)