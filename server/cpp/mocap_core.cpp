#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <vector>
#include <cmath>
#include <algorithm>
#include <limits>
#include <stdexcept>

namespace py = pybind11;

/**
 * Computes Sakoe-Chiba constrained Dynamic Time Warping (DTW) distance.
 * Supports arbitrary feature dimensions (2D or 3D) using an O(M) two-row rolling DP buffer.
 */
double dtw_sakoe_chiba_3d(
    py::array_t<double, py::array::c_style | py::array::forcecast> trajectory_a,
    py::array_t<double, py::array::c_style | py::array::forcecast> trajectory_b,
    int window = 50
) {
    auto buf_a = trajectory_a.unchecked<2>();
    auto buf_b = trajectory_b.unchecked<2>();

    const ssize_t n = buf_a.shape(0);
    const ssize_t m = buf_b.shape(0);

    if (n == 0 || m == 0) {
        return 0.0;
    }

    const ssize_t dim = std::min(buf_a.shape(1), buf_b.shape(1));
    const int w = std::max(window, static_cast<int>(std::abs(n - m)));
    const double INF = std::numeric_limits<double>::infinity();

    // Two-row rolling DP buffer: keeps memory at O(M) and fits inside L1/L2 CPU cache
    std::vector<double> prev(m + 1, INF);
    std::vector<double> curr(m + 1, INF);
    prev[0] = 0.0;

    for (ssize_t i = 1; i <= n; ++i) {
        std::fill(curr.begin(), curr.end(), INF);

        ssize_t j_start = std::max(static_cast<ssize_t>(1), i - w);
        ssize_t j_end = std::min(m, i + w);

        for (ssize_t j = j_start; j <= j_end; ++j) {
            double sq_dist = 0.0;
            for (ssize_t d = 0; d < dim; ++d) {
                double diff = buf_a(i - 1, d) - buf_b(j - 1, d);
                sq_dist += diff * diff;
            }
            double dist = std::sqrt(sq_dist);

            double min_prev = std::min({prev[j], curr[j - 1], prev[j - 1]});
            curr[j] = dist + min_prev;
        }
        prev = curr;
    }

    return prev[m];
}

/**
 * Computes fast zero-copy spatial metrics over an (N, D) trajectory matrix.
 */
py::array_t<double> compute_batch_kinematics(py::array_t<double> trajectory_matrix) {
    auto buf = trajectory_matrix.unchecked<2>();
    ssize_t num_frames = buf.shape(0);

    auto result = py::array_t<double>(num_frames);
    auto result_buf = result.mutable_unchecked<1>();

    for (ssize_t i = 0; i < num_frames; i++) {
        double x = buf(i, 0);
        double y = buf(i, 1);
        result_buf(i) = std::hypot(x, y);
    }

    return result;
}

/**
 * Simulates virtual pursuit kinematics behind a leader trajectory.
 */
py::array_t<double> simulate_robot_pursuit(
    py::array_t<double> leader_coords,
    double target_follow_dist,
    double robot_max_speed
) {
    auto buf_leader = leader_coords.unchecked<2>();
    ssize_t num_frames = buf_leader.shape(0);

    auto result = py::array_t<double>({num_frames, static_cast<ssize_t>(2)});
    auto buf_result = result.mutable_unchecked<2>();

    if (num_frames == 0) return result;

    double rx = buf_leader(0, 0);
    double ry = buf_leader(0, 1) - target_follow_dist;

    const double kp = 0.8;
    const double dt = 1.0 / 60.0;

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
    m.doc() = "C++ accelerated MoCap core utilities for DTW and robot pursuit kinematics";

    // Primary function invoked by server/smart_behaviors/api/routes/search.py
    m.def(
        "dtw_sakoe_chiba_3d",
        &dtw_sakoe_chiba_3d,
        py::arg("trajectory_a"),
        py::arg("trajectory_b"),
        py::arg("window") = 50,
        "Computes 3D Sakoe-Chiba DTW distance between two (N, D) trajectories"
    );

    // Alias to keep backwards compatibility with previous scripts
    m.def(
        "compute_dtw",
        &dtw_sakoe_chiba_3d,
        py::arg("trajectory_a"),
        py::arg("trajectory_b"),
        py::arg("radius") = 50,
        "Alias for dtw_sakoe_chiba_3d"
    );

    m.def(
        "compute_batch_kinematics",
        &compute_batch_kinematics,
        py::arg("trajectory_matrix"),
        "Run fast spatial kinematics on a zero-copy NumPy matrix"
    );

    m.def(
        "simulate_robot_pursuit",
        &simulate_robot_pursuit,
        py::arg("leader_coords"),
        py::arg("target_follow_dist"),
        py::arg("robot_max_speed"),
        "Simulates virtual robot pursuit trajectory"
    );
}