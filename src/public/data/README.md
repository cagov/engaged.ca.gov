# README

This README file describes the two data files included in this `.zip` archive. It explains the columns in each file.

---

## State_employees_all_comments.csv

This file contains all comments that state employees submitted during the engagement.

### Columns

- **COMMENT_ID**  
  Unique identifier for the comment.

- **REPLY_TO_ID**  
  If the comment is a reply to another comment, this column contains that `COMMENT_ID`. It is blank if it is not a reply.

- **PARTICIPANT_ID**  
  Unique identifier for each commenter. This field contains no personally identifiable information of any state employee.

- **COMMENT**  
  The text of the comment exactly as employees entered it.

- **QUESTION**  
  The question that employees responded to when commenting.

- **POSTED_ON**  
  The date and time that the employee made the comment.

- **LIKE_COUNT**  
  The number of times other employees “liked” the comment.

---

## State_employees_all_ideas.csv

This file contains all ideas that were extracted from the comments that state employees submitted during the engagement.

### Columns

- **IDEA_ID**  
  Unique identifier for the idea.

- **IDEA_COMMENT_ID**  
  The `COMMENT_ID` from which the idea was identified.

- **COMMENT**  
  The text of the comment exactly as employees entered it.

- **IDEA_TEXT**  
  The content of the idea.

- **IDEA_MAIN_THEMES_LIST**  
  The list of themes assigned to the idea.

- **IDEA_SUBTHEMES_LIST**  
  The list of subthemes assigned to the idea.
