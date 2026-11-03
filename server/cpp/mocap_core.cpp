#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <cmath>

namespace py = pybind11;

// Accepts a zero-copy 2D NumPy array and computes a metric
py::array_t<double> compute_batch_kinematics(py::array_t<double> trajectory_matrix) {
    // unchecked<2>() grants direct, zero-copy pointer access to a 2D array
    auto buf = trajectory_matrix.unchecked<2>();
    
    ssize_t num_frames = buf.shape(0);
    ssize_t num_features = buf.shape(1);

    // Allocate an output array for results (e.g., smoothed velocity or clearances)
    auto result = py::array_t<double>(num_frames);
    auto result_buf = result.mutable_unchecked<1>();

    for (ssize_t i = 0; i < num_frames; i++) {
        // Example: Read X and Y from the buffer instantly
        double x = buf(i, 0); 
        double y = buf(i, 1);
        
        // Execute heavy C++ spatial math here...
        result_buf(i) = std::sqrt(x*x + y*y); // Dummy calculation
    }

    return result;
}

double compute_dtw(py::array_t<double> trajectory_a, py::array_t<double> trajectory_b, int radius = 50) {
    auto buf_a = trajectory_a.unchecked<2>();
    auto buf_b = trajectory_b.unchecked<2>();

    int num_frames_a = buf_a.shape(0);
    int num_frames_b = buf_b.shape(0);

    // Initialize with infinity as before
    std::vector<std::vector<double>> dtw(num_frames_a + 1, std::vector<double>(num_frames_b + 1, std::numeric_limits<double>::infinity()));
    dtw[0][0] = 0.0;

    // The window must be at least the difference in sequence lengths to ensure a valid path exists
    int window = std::max(radius, std::abs(num_frames_a - num_frames_b));

    for (int i = 1; i <= num_frames_a; ++i) {
        // Constrain the j-loop to the Sakoe-Chiba band
        int j_start = std::max(1, i - window);
        int j_end = std::min(num_frames_b, i + window);
        
        for (int j = j_start; j <= j_end; ++j) {
            double dx = buf_a(i - 1, 0) - buf_b(j - 1, 0);
            double dy = buf_a(i - 1, 1) - buf_b(j - 1, 1);
            double cost = std::sqrt(dx * dx + dy * dy);
            dtw[i][j] = cost + std::min({dtw[i-1][j], dtw[i][j-1], dtw[i-1][j-1]});
        }
    }
    return dtw[num_frames_a][num_frames_b];
}

// Add this function above your PYBIND11_MODULE block
py::array_t<double> simulate_robot_pursuit(py::array_t<double> leader_coords, double target_follow_dist, double robot_max_speed) {
    auto buf_leader = leader_coords.unchecked<2>();
    ssize_t num_frames = buf_leader.shape(0);

    // Allocate an N x 2 array for the simulated trajectory
    auto result = py::array_t<double>({num_frames, (ssize_t)2});
    auto buf_result = result.mutable_unchecked<2>();

    if (num_frames == 0) return result;

    // Initial position
    double rx = buf_leader(0, 0);
    double ry = buf_leader(0, 1) - target_follow_dist;
    
    double kp = 0.8;
    double dt = 1.0 / 60.0;

    for (ssize_t i = 0; i < num_frames; ++i) {
        double lx = buf_leader(i, 0);
        double ly = buf_leader(i, 1);

        double dist = std::hypot(lx - rx, ly - ry);
        double angle = std::atan2(ly - ry, lx - rx);
        double error = dist - target_follow_dist;

        double speed = std::max(0.0, std::min(robot_max_speed, error * kp * 60.0));

        rx += speed * std::cos(angle) * dt;
        ry += speed * std::sin(angle) * dt;

        buf_result(i, 0) = rx;
        buf_result(i, 1) = ry;
    }

    return result;
}

PYBIND11_MODULE(mocap_core, m) {
    m.doc() = "C++ Core for Smart Behaviors Kinematics";
    m.def("compute_batch_kinematics", &compute_batch_kinematics, "Run fast C++ math on a zero-copy NumPy matrix");
    // Add py::arg("radius") so we can set it from Python
    m.def("compute_dtw", &compute_dtw, "Compute DTW distance", py::arg("trajectory_a"), py::arg("trajectory_b"), py::arg("radius") = 50);
    m.def("simulate_robot_pursuit", &simulate_robot_pursuit, "Simulate virtual robot pursuit", py::arg("leader_coords"), py::arg("target_follow_dist"), py::arg("robot_max_speed"));
}