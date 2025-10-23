[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/yOwut1-r)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=21246323&assignment_repo_type=AssignmentRepo)

# Neurosynth Frontend

This project is a web-based frontend for Neurosynth, a platform for large-scale, automated synthesis of functional magnetic resonance imaging (fMRI) data. It provides a user-friendly interface to search for neuroscience terms and studies.

## Key Features

*   **Complex Query Search**: A main search bar that supports complex queries using boolean operators (`AND`, `OR`, `NOT`), exact phrases in quotes, and parentheses for grouping.
*   **As-you-type Suggestions**: The main query input provides real-time suggestions to autocomplete terms as you type, streamlining the search process.
*   **Single Term Analysis**: A dedicated panel on the left allows users to search for a single term and view a list of related terms.
*   **Related Terms Visualization**: For a given term, the application displays a list of related terms, which can be sorted by `co_count` (co-occurrence count) or `jaccard` similarity. Users can also select the number of top results to display (Top 10, 20, or 50).
*   **Study Results**: The interface presents a list of studies matching the search query, showing the title, authors, journal, and year. Results can be sorted by year or title.
*   **Infinite Scroll**: The study results list automatically loads more entries as the user scrolls down, providing a seamless browsing experience for large result sets.
*   **Interactive UI**: The application features a responsive design with interactive elements like hover-to-view details, clickable result items to expand information, and toast notifications for user feedback.

## How to Use

1.  Open `index.html` in a web browser.
2.  Use the **Complex Query** search bar on the right to enter your search terms (e.g., `"emotional faces" AND amygdala`).
3.  Use the **Search by Term** input on the left to explore terms related to a single concept (e.g., `emotion`).
4.  Browse the results and related terms that appear.

## Technical Details

The application is built with vanilla HTML, CSS, and JavaScript, organized into three main files:
*   `index.html`: The main structure of the web page.
*   `style.css`: Contains all the styles for the user interface.
*   `index.js`: Implements all the application logic, including API calls, state management, and DOM manipulation.

The application interacts with a backend API to fetch terms, related terms, and study data.

---

## Additional Documentation

This project was developed utilizing several AI assistants. A notable observation from the development process was the time investment in creating a detailed specification file (`SPEC.md`). The process of defining and confirming the project specifications with the assistance of Github Copilot and Gemini CLI took approximately 3 hours. However, once this detailed `SPEC.md` was finalized, the Claude Haiku 4.5 model was able to generate the initial core application code from the specification in just 3 minutes.

I found that Claude perfectly implemented my spec, but the requirements I initially gave were flawed. Therefore, the project went through two major updates ([UPDATE-1.md](UPDATE-1.md), [UPDATE-2.md](UPDATE-2.md)) and several smaller fixes to arrive at the current version. The lesson learned is that while a perfect initial specification is valuable, seeing an early demo is crucial for validating the requirements and iterating effectively.

*   **[SPEC.md](SPEC.md)**: Details the "original" technical specifications for the frontend, including API contracts, UI/UX behavior, and interaction details. It served as the primary guide for the initial implementation.
*   **[QA.md](QA.md)**: Outlines the Quality Assurance and testing plan for the application. It includes detailed test cases for all features to ensure functionality and adherence to the specifications.
*   **[UPDATE-1.md](UPDATE-1.md)**: Describes the first round of UI/UX improvements based on user feedback. This includes changes like a Google-style suggestion box, a redesigned operator chooser, and a single-column layout for related terms.
*   **[UPDATE-2.md](UPDATE-2.md)**: Details a second round of fine-tuning and corrections based on the `UPDATE-1` implementation. This includes minor UI text changes, improved hover information, and other small adjustments to perfect the user experience.