# State Employees Report - File Relationships

This document explains how the files work together to create the State Employees Efficiency Report page, with a focus on the **comment-explorer** functionality.

## File Overview

### 1. `site/en/stateemployees/efficiency.mmmd`
**Purpose**: Content/data source file using a custom `.mmmd` (Multi-Module Markdown) format.

**Contains**:
- Page metadata (title, description, layout reference)
- Section definitions with unique IDs (hero, themes, comment explorer, etc.)
- Theme data (10 themes with properties like colors, quotes, solution counts)
- UI text labels and configuration values
- Content for each section of the report

**Key sections for comment-explorer**:
- `comment_explorer` section: Defines the title and intro text
- `comment_explorer_ui` section: Contains all UI labels (search placeholder, sort options, button text, etc.)
- `theme_navigation` section: Navigation widget labels
- Individual `theme_X` sections: Theme-specific data used for filtering

### 2. `site/_includes/mmmd-stateemployees-report.njk`
**Purpose**: Main Nunjucks template that renders the HTML structure for the entire report page.

**Responsibilities**:
- Extends the base layout (`layout.njk`)
- Links CSS files (`state-employees.css` and `state-employees-report.css`)
- Renders all HTML sections (hero, themes, comment explorer, etc.)
- Generates the SVG bubble chart for theme visualization
- Creates the comment explorer UI structure:
  - Theme selector dropdown (both native `<select>` and custom styled version)
  - Search input with clear button
  - Sort selector dropdown
  - Sub-theme filter container
  - Comments container (where comments are dynamically inserted)
- Includes `e3-theme-navigation.njk` at the bottom
- Passes theme color data to JavaScript via `window.themeColors`

**Key HTML structure for comment-explorer**:
```html
<section id="comment-explorer">
  <!-- Controls: theme selector, search, sort -->
  <!-- Sub-theme filter (initially hidden) -->
  <!-- Comment count display -->
  <!-- Comments container (populated by JavaScript) -->
</section>
```

### 3. `site/_includes/e3-theme-navigation.njk`
**Purpose**: JavaScript file that provides all interactivity for the comment explorer and theme navigation.

**Core Functionality**:

#### Data Loading
- Fetches comment data from `/public/data/E3_data_v2.json` (line 844)
- Builds maps for subthemes and theme colors
- Stores data in `global_comment_data` variable

#### Comment Filtering & Display (`populate_comments()` function)
- Filters comments by theme (1-10, "all", or "other")
- Applies sub-theme filtering when sub-themes are selected
- Applies search term filtering (2+ characters)
- Sorts comments by: date, alpha, theme, likes, or replies
- Handles comment threading (parent comments and replies)
- Generates HTML markup with:
  - Highlighted search terms
  - Formatted dates
  - Like counts
  - Sub-theme tags with theme-colored backgrounds
- Updates the comment count display

#### Theme Navigation (`switch_theme()` function)
- Switches between themes (1-10, "all", "other")
- Updates SVG bubble chart highlighting
- Shows/hides theme content sections
- Updates navigation widget (prev/next buttons, dots)
- Resets comment container scroll position
- Populates sub-theme filter for selected theme

#### Search Functionality
- Auto-switches to "all" theme when search term is 2+ characters
- Highlights matching text in comments
- Clears search and restores previous theme when search is cleared

#### Sort Functionality
- Supports sorting by: date, alpha, theme, likes, replies
- Maintains sort order when filtering changes

#### Sub-theme Filtering
- Dynamically populates sub-theme tags based on selected theme
- Allows multiple sub-themes to be selected/deselected
- Filters comments to show only those matching selected sub-themes

#### Custom Dropdowns
- Creates styled custom dropdowns for theme and sort selectors
- Maintains accessibility with keyboard navigation
- Syncs with native `<select>` elements for form submission

### 4. `src/css/state-employees-report.css`
**Purpose**: Stylesheet containing all visual styling for the report page.

**Key CSS Classes for Comment Explorer**:

#### Controls (lines 518-819)
- `.comment-explorer-controls`: Flex container for theme selector, search, and sort
- `.theme-selector-wrapper`, `.search-input-wrapper`, `.sort-selector-wrapper`: Individual control containers
- `.theme-selector-custom`, `.sort-selector-custom`: Custom styled dropdowns
- `.search-input`: Search input field styling
- `.search-clear`: Clear button styling

#### Sub-theme Filter (lines 821-871)
- `.subtheme-filter`: Container for sub-theme filter section
- `.subtheme-filter-tags`: Flex container for tag buttons
- `.subtheme-filter-tag`: Individual tag styling (opacity changes for selected/unselected)

#### Comments Display (lines 873-1012)
- `.comments-container`: Scrollable container for comments (max-height: 800px)
- `.comment-item-container`: Container for each comment (background alternates for replies)
- `.comment-item`: Individual comment styling with left border
- `.comment-item.indent-reply`: Reply comments with left margin and different border color
- `.comment-content`: Comment text styling with search highlighting
- `.comment-tags`: Container for sub-theme tags
- `.comment-tag`: Individual sub-theme tag styling (colored backgrounds)
- `.comment-meta`: Date and likes display
- `.no-comments`: Message when no comments match filters

## Data Flow

1. **Content Definition** (`efficiency.mmmd`)
   - Defines all text, labels, and theme data
   - Processed by Eleventy to extract module data

2. **HTML Generation** (`mmmd-stateemployees-report.njk`)
   - Reads module data from `.mmmd` file
   - Generates HTML structure with data attributes
   - Creates empty containers for dynamic content

3. **Data Loading** (`e3-theme-navigation.njk`)
   - Fetches JSON data from `/public/data/E3_data_v2.json`
   - Builds internal data structures (maps, arrays)

4. **User Interaction** (`e3-theme-navigation.njk`)
   - User selects theme, searches, sorts, or filters
   - JavaScript filters and sorts comment data
   - Generates HTML markup and inserts into DOM

5. **Styling** (`state-employees-report.css`)
   - CSS rules style the generated HTML
   - Provides visual feedback for interactions
   - Handles responsive design

## Comment Explorer Workflow

1. **Initialization**:
   - Page loads → JavaScript fetches JSON data
   - Default theme (1) is selected
   - Comments for theme 1 are displayed
   - Sub-theme filter is populated for theme 1

2. **Theme Selection**:
   - User selects theme from dropdown or clicks SVG circle
   - `switch_theme()` is called
   - Theme content section is shown
   - SVG circle is highlighted
   - Sub-theme filter is updated
   - Comments are filtered and displayed

3. **Search**:
   - User types in search box (2+ characters)
   - Automatically switches to "all" theme
   - `populate_comments()` filters by search term
   - Matching text is highlighted in results

4. **Sort**:
   - User selects sort option
   - `current_sort` variable is updated
   - Comments are re-sorted and re-displayed

5. **Sub-theme Filter**:
   - User clicks sub-theme tags to select/deselect
   - `selectedSubthemes` Set is updated
   - Comments are filtered to match selected sub-themes
   - Visual state of tags is updated (opacity)

## Key Variables (JavaScript)

- `global_comment_data`: Complete comment dataset from JSON
- `current_theme_index`: Currently selected theme (1-10, "all", "other")
- `current_search_term`: Current search query
- `current_sort`: Current sort method ("date", "alpha", "theme", "likes", "replies")
- `selectedSubthemes`: Set of selected sub-theme IDs
- `subthemeMap`: Maps sub-theme ID → {name, parent_theme_id}
- `themeColorMap`: Maps theme ID → {stroke, light} colors

## Integration Points

- **Eleventy**: Processes `.mmmd` files and `.njk` templates to generate HTML
- **JSON Data**: Comment data is loaded from `/public/data/E3_data_v2.json` (will be updated to `E3_data_v3.json` to include solutions)
- **CSS**: Styles are applied via class names generated in JavaScript
- **Accessibility**: ARIA attributes and keyboard navigation are handled in JavaScript

## Future Integration (E3_data_v3.json)

The comment explorer currently uses `E3_data_v2.json`. When integrating `E3_data_v3.json`:
- Update the fetch URL (line 844 in `e3-theme-navigation.njk`)
- The new JSON includes a `solutions` array that can be integrated into the comment explorer
- Solutions have similar structure to comments (cid, text, tids, stids) and can be filtered/displayed similarly

