import pandas as pd
import numpy as np
import plotly.express as px
import random

# Sample DataFrame
csv_file_path = 'voting_data_v1.csv' # If the file is in the same directory as your script
# or 'path/to/your/folder/your_file_name.csv' for a specific path

# Read the CSV file into a DataFrame
df = pd.read_csv(csv_file_path)

df['vertical_jitter'] =  np.random.normal(loc=0, scale=1, size=len(df)) 
df['vertical_position'] = 0
df['adjusted_score'] = df['VOTE_NUMBER'].apply(lambda x: random.uniform(x, x - 1))
df['dot_color'] = df['VOTE_NUMBER'].apply(lambda x: '#1f77b4' if x == 7 else '#2ca02c' if x == 6 else '#98df8a' if x == 5 else '#bcbd22' if x == 4 else '#ffbb78' if x == 3 else '#ff7f0e' if x == 2 else '#d62728')
df['frame'] = df['TARGET_NAME']  # Create a frame column for animation

df.sort_values('CONSENSUS', inplace=True)

# Plotting with Plotly Express
fig = px.scatter(
    df,
    x='adjusted_score',
    y = 'vertical_jitter',  # Use vertical jitter for y-axis
    range_x=[-1,8],
    range_y=[-4, 4],  # Set y range to min and max of vertical jitter
   # size='Size',
    color='dot_color',
    color_discrete_map='identity',
    animation_frame='TARGET_NAME', 
    height=600
)

fig.update_traces(marker=dict(line=dict(width=0)))  # No border
fig.update_layout(
    yaxis_title=' ',
    plot_bgcolor='white',
    showlegend=False
)

fig.update_traces({'marker':{'size': 15}})


##update axes
#update x axis
x_min = 0
x_median = 3.5
x_max = 7

fig.update_layout(
    xaxis=dict(
        showline=True,           # Optional: keep axis line
        showticklabels=True,
        tickvals=[x_min, x_median, x_max],  # Only show these tick positions
        ticktext=[str('Stongly Oppose'), str('Neutral'), str('Strongly Support')],  # Labels for them
        title=''  # Optional: hide title
    )
)

#hide y axis altogether
fig.update_yaxes(showticklabels=False, showgrid=False, zeroline=False, showline=False)



# ##animation controls
# # Set duration and looping
fig.layout.updatemenus[0].buttons[0].args[1]["frame"]["duration"] = 1500   # ms per frame
fig.layout.updatemenus[0].buttons[0].args[1]["transition"]["duration"] = 500  # smoothness

# Update the font size of the animation frame title
fig.update_layout(
    sliders=[{
        'currentvalue': {
            'prefix': '',  # You can add text here if needed
            'font': {
                'size': 24  # <-- Set your desired font size here
            }
        }
    }]
)


# fig.layout.updatemenus[0].buttons[0].args[1]["mode"] = "immediate"
# fig.layout.updatemenus[0].buttons[0].args[1]["fromcurrent"] = True
# #fig.layout.updatemenus[0].buttons[0].args[1]["loop"] = True  # Ensure looping
# # # Rebuild slider steps with repeatable play button logic



fig.show()
