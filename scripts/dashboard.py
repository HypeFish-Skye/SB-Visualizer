import streamlit as st
import math
import duckdb
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
import concurrent.futures
from smart_behaviors import mocap_core
from fastdtw.fastdtw import fastdtw
from scipy.spatial.distance import euclidean

st.set_page_config(page_title="MoCap Database Explorer", layout="wide")
st.title("🚶‍♂️ Smart Behaviors MoCap Explorer")

@st.cache_data(show_spinner=False)
def fetch_trajectory(file_path):
    """Downloads just the 2D coordinates from S3 and caches them in memory."""
    target_columns = ['PositionX_Leader01_World', 'PositionY_Leader01_World']
    df = pd.read_parquet(file_path, columns=target_columns)
    return np.column_stack((
        df['PositionX_Leader01_World'].dropna(), 
        df['PositionY_Leader01_World'].dropna()
    )).astype(np.float64)

# Cache the DuckDB connection to prevent reloading on every UI interaction
@st.cache_data
def load_data():
    # Connect in read_only mode to prevent database locks
    conn = duckdb.connect("mocap_catalog.duckdb", read_only=True)
    return conn.execute("SELECT * FROM trials").fetchdf()

df = load_data()

# Top-level aggregate metrics
col1, col2, col3 = st.columns(3)
col1.metric("Total Cornering Trials", len(df))
col2.metric("Total Frames", f"{df['total_frames'].sum():,}")
col3.metric("Peak Leader Speed (m/s)", round(df["max_leader_speed"].max(), 2))

# Interactive Filtering
st.subheader("Filter Edge Cases")
min_clearance = st.slider(
    "Minimum Wall Clearance (m)", 
    float(df["min_wall_distance"].min()), 
    float(df["min_wall_distance"].max()), 
    float(df["min_wall_distance"].median())
)

filtered_df = df[df["min_wall_distance"] <= min_clearance]

# Visualizations
st.write(f"Found **{len(filtered_df)}** trials matching criteria:")
st.dataframe(filtered_df, width='stretch')

st.subheader("Velocity vs. Wall Clearance")
st.scatter_chart(filtered_df, x="min_wall_distance", y="max_leader_speed")

st.divider()
st.subheader("Kinematic Playback")

selected_file = st.selectbox("Select a Trial to Visualize", filtered_df['filename'].tolist())

if selected_file:
    st.info(f"Streaming raw kinematics from S3: {selected_file.split('/')[-1]}")
    
    target_columns = [
        'PositionX_Leader01_World', 'PositionY_Leader01_World',
        'PositionX_Follower01_World', 'PositionY_Follower01_World'
    ] 
    
    try:
        trial_data = pd.read_parquet(selected_file, columns=target_columns)
        
        fig = go.Figure()
        
        # Leader Trajectory
        fig.add_trace(go.Scatter(
            x=trial_data['PositionX_Leader01_World'], 
            y=trial_data['PositionY_Leader01_World'], 
            mode='lines', 
            name='Leader'
        ))
        
        # Follower Trajectory
        fig.add_trace(go.Scatter(
            x=trial_data['PositionX_Follower01_World'], 
            y=trial_data['PositionY_Follower01_World'], 
            mode='lines', 
            name='Follower'
        ))
        
        # Lock aspect ratio for accurate real-world scaling
        fig.update_layout(
            title="Top-Down Spatial Playback",
            xaxis_title="World X (meters)",
            yaxis_title="World Y (meters)",
            yaxis=dict(scaleanchor="x", scaleratio=1)
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
    except Exception as e:
        st.error(f"Failed to load coordinates: {e}")


st.divider()
st.subheader("Geometric Search Engine (C++ Accelerated)")

if st.button("Find Similar Trajectories (C++ DTW)"):
    with st.spinner("Fetching coordinates and running constrained DTW..."):
        target_coords = fetch_trajectory(selected_file)
        
        results = []
        comparison_files = filtered_df[filtered_df['filename'] != selected_file]['filename'].tolist()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_file = {
                executor.submit(fetch_trajectory, file_path): file_path
                for file_path in comparison_files
            }
            
            for future in concurrent.futures.as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    comp_coords = future.result()
                    # Pass radius=50 to limit the search space
                    distance = mocap_core.compute_dtw(target_coords, comp_coords, 50)
                    results.append({"filename": file_path.split('/')[-1], "full_path": file_path, "dtw_distance": distance})
                except Exception as e:
                    st.error(f"Error processing {file_path}: {e}")
                    continue


        if results:
            # Get top 5 matches
            results_df = pd.DataFrame(results).sort_values('dtw_distance').head(5)
            st.success(f"Search complete! Processed {len(comparison_files)} trials.")
            st.dataframe(results_df, use_container_width=True)
            
            # Visualize the matches
            st.write("**Top Geometric Matches Overlay**")
            match_fig = go.Figure()
            
            # Plot the original target trajectory
            match_fig.add_trace(go.Scatter(
                x=target_coords[:, 0], 
                y=target_coords[:, 1], 
                mode='lines', 
                name='Target Leader', 
                line=dict(color='black', width=4)
            ))
            
            # Plot the top matches
            for idx, row in results_df.iterrows():
                match_coords = fetch_trajectory(row['full_path'])
                match_fig.add_trace(go.Scatter(
                    x=match_coords[:, 0], 
                    y=match_coords[:, 1], 
                    mode='lines', 
                    name=f"Match (Dist: {row['dtw_distance']:.1f})", 
                    opacity=0.6
                ))
                
            match_fig.update_layout(
                xaxis_title="World X (meters)",
                yaxis_title="World Y (meters)",
                yaxis=dict(scaleanchor="x", scaleratio=1),
                margin=dict(l=0, r=0, t=30, b=0)
            )
            st.plotly_chart(match_fig, use_container_width=True)

st.divider()
st.subheader("🤖 Simulation Injection: Virtual Robot")

# Simulation parameters
col1, col2 = st.columns(2)
target_follow_dist = col1.slider("Target Follow Distance (m)", 0.5, 3.0, 1.5)
robot_max_speed = col2.slider("Robot Max Speed (m/s)", 0.5, 5.0, 2.0)

if st.button("Inject Virtual Robot"):
    with st.spinner("Simulating robot kinematics in C++..."):
        leader_coords = fetch_trajectory(selected_file)
        
        # Execute the C++ simulation engine
        simulated_path = mocap_core.simulate_robot_pursuit(
            leader_coords, 
            target_follow_dist, 
            robot_max_speed
        )
        
        # Visualize the result
        sim_fig = go.Figure()
        
        # 1. Original Leader
        sim_fig.add_trace(go.Scatter(x=leader_coords[:, 0], y=leader_coords[:, 1], mode='lines', name='Leader', line=dict(color='black', width=3)))
        
        # 2. Original Human Follower (for baseline comparison)
        follower_coords = pd.read_parquet(selected_file, columns=['PositionX_Follower01_World', 'PositionY_Follower01_World']).dropna().values
        sim_fig.add_trace(go.Scatter(x=follower_coords[:, 0], y=follower_coords[:, 1], mode='lines', name='Human Follower Baseline', line=dict(color='gray', dash='dash')))
        
        # 3. Virtual Robot
        sim_fig.add_trace(go.Scatter(x=simulated_path[:, 0], y=simulated_path[:, 1], mode='lines', name='Virtual Robot', line=dict(color='#33b5db', width=3)))
        
        sim_fig.update_layout(title="Virtual Pursuit vs. Human Baseline", xaxis_title="X (m)", yaxis_title="Y (m)", yaxis=dict(scaleanchor="x", scaleratio=1))
        st.plotly_chart(sim_fig, use_container_width=True)