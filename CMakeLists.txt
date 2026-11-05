cmake_minimum_required(VERSION 3.15)
project(mocap_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Python 3.8 COMPONENTS Interpreter Development.Module REQUIRED)

if(NOT pybind11_DIR)
  execute_process(
    COMMAND "${Python_EXECUTABLE}" -m pybind11 --cmakedir
    OUTPUT_VARIABLE pybind11_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
    RESULT_VARIABLE PYBIND11_PATH_STATUS
  )
  if(NOT PYBIND11_PATH_STATUS EQUAL 0)
    message(FATAL_ERROR "Failed to locate pybind11. Ensure 'pip install pybind11' is run.")
  endif()
endif()

find_package(pybind11 CONFIG REQUIRED)

# Point directly to server/cpp/mocap_core.cpp
pybind11_add_module(mocap_core
    server/cpp/mocap_core.cpp
)

# Install into the smart_behaviors package namespace alongside mocap_core.pyi
install(TARGETS mocap_core DESTINATION smart_behaviors)