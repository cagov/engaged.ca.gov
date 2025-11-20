README for “voting data.csv”

This file can be used to create all of the voting scatterplot data visualizations for the final report.

Column definitions:
    PARTICIPANT_ID = unique, anonymous identifier for each person
    VOTE_OPTION = shorthand title for each of the 19 options people could vote on
    TARGET_NAME = long title for each of the 19 options people could vote on
    VOTE = text value for what likert scale option the participant voted for that topic
    VOTE_NUMBER = numeric value for what likert scale option the participant voted for that topic
    CONSENSUS = this indicates the 'ethelo consensus score' that each of the options received. can be used to order the results from low to high
    COMMENT_ID = if the person who voted for the option also left a comment on that option, the unique id of that comment is here
    COMMENT_CONTENT = the content of the participant's comment (see above)
    LIKE_COUNT = how many likes did this comment get
    REPLY_COUNT = how many replies did this comment get
    _FIVETRAN_SYNCED = when was this data last loaded into Snowflake