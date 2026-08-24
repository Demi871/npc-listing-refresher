NPC LISTING REFRESHER: 
A Chrome extension that automates refreshing property listings on Nigeria Property Centre.


Demo Video📽️
https://github.com/user-attachments/assets/7e21d4d2-8330-4142-a040-72a3339f0ccb

Features
- Refreshes property listings automatically
- Works through the site's existing Refresh buttons
- Processes listings across multiple pages
- Supports configurable delays between refreshes
- Displays refresh progress
- Includes a Stop button
- Uses Chrome Extension Manifest V3



How It Works: The extension uses a popup interface to control a content script running on Nigeria Property Centre's listings page.

The content script:
1. Detects listing Refresh buttons on the page
2. Extracts listing IDs from the page
3. Clicks the site's existing Refresh buttons
4. Waits for the page's Livewire actions to complete
5. Tracks progress using Chrome's local storage
6. Moves backwards through pagination until the process is complete



Technologies
- JavaScript
- HTML
- Chrome Extensions API
- Manifest V3
- Chrome Storage API
- DOM manipulation



Project Status
Working prototype.



Installation
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable Developer mode.
4. Select Load unpacked.
5. Select the project folder.
6. Open the extension on a Nigeria Property Centre listings page.
7. Let hours of work get done in minutes!😹



Disclaimer!!!

This project is intended for personal automation and experimentation. Use it responsibly and in accordance with the website's terms and policies please.

