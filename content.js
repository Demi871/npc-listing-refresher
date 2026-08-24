let refreshRunning = false;

async function sleep(ms) {
    const interval = 250;
    let elapsed = 0;

    while (elapsed < ms) {
        const state = await getState();

        if (state.stopRequested) {
            return false;
        }

        const wait = Math.min(interval, ms - elapsed);
        await new Promise(resolve => setTimeout(resolve, wait));
        elapsed += wait;
    }

    return true;
}


// ------------------------------
// Storage
// ------------------------------

async function setState(state) {
    await chrome.storage.local.set({
        npcRefreshState: state
    });
}


async function getState() {

    const result =
        await chrome.storage.local.get("npcRefreshState");

    return result.npcRefreshState || {
        running: false,
        stopRequested: false,
        refreshed: 0,
        total: 0,
        page: 1,
        status: "Ready"
    };
}


// ------------------------------
// Total listings
// ------------------------------

function getTotalListings() {

    const text = document.body.innerText;

    const match = text.match(
        /Showing\s+\d+[\u2013-]\d+\s+of\s+([\d,]+)\s+listings/i
    );

    if (!match) return 0;

    return Number(
        match[1].replace(/,/g, "")
    );
}


// ------------------------------
// Current page
// ------------------------------

function getCurrentPage() {

    /*
     * NPC marks the current page with a button
     * containing gotoPage(X).
     *
     * The current page button also has
     * aria-current="page" or a distinctive
     * active class.
     */

    const pageButtons = [
        ...document.querySelectorAll(
            'button[wire\\:click^="gotoPage("]'
        )
    ];

    for (const button of pageButtons) {

        const isCurrent =
            button.getAttribute("aria-current") === "page" ||
            button.classList.contains("bg-primary") ||
            button.classList.contains("bg-red-700") ||
            button.classList.contains("text-white");

        if (!isCurrent) continue;

        const action =
            button.getAttribute("wire:click");

        const match =
            action?.match(/^gotoPage\((\d+)\)$/);

        if (match) {
            return Number(match[1]);
        }
    }


    /*
     * Fallback:
     * look for the button whose text matches
     * the current active pagination state.
     */

    for (const button of pageButtons) {

        const action =
            button.getAttribute("wire:click");

        const match =
            action?.match(/^gotoPage\((\d+)\)$/);

        if (!match) continue;

        const number =
            Number(match[1]);

        if (
            button.getAttribute("aria-current") ||
            button.disabled
        ) {
            return number;
        }
    }


    return 1;
}


// ------------------------------
// Refresh buttons
// ------------------------------

function getRefreshButtons() {

    const buttons = [
        ...document.querySelectorAll(
            'button[wire\\:click^="refresh("]'
        )
    ];

    const unique = new Map();

    for (const button of buttons) {

        const action =
            button.getAttribute("wire:click");

        if (!action) continue;

        const match =
            action.match(/^refresh\((\d+)\)$/);

        if (!match) continue;

        const listingId = match[1];

        if (!unique.has(listingId)) {
            unique.set(listingId, button);
        }
    }

    return [...unique.values()];
}


// ------------------------------
// Previous page
// ------------------------------

function getPreviousButton() {

    return document.querySelector(
        'button[wire\\:click="previousPage"]'
    );
}


function isPreviousDisabled(button) {

    return !button ||
        button.disabled ||
        button.hasAttribute("disabled") ||
        button.getAttribute("aria-disabled") === "true";
}


// ------------------------------
// Livewire refresh detection
// ------------------------------

function isButtonLoading(button) {

    if (!button) return false;

    return (
        button.disabled ||
        button.hasAttribute("disabled") ||
        button.getAttribute("aria-disabled") === "true"
    );
}


async function waitForRefreshComplete(button) {

    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < 40; i++) {

        const state = await getState();

        if (state.stopRequested) {
            console.log("Stop requested during refresh wait.");
            return false;
        }

        if (!isButtonLoading(button)) {

            if (i > 0) {
                return true;
            }
        }

        await new Promise(resolve =>
            setTimeout(resolve, 250)
        );
    }

    console.log(
        "Timed out waiting for Livewire refresh."
    );

    return true;
}


// ------------------------------
// Page change detection
// ------------------------------

async function waitForPageChange(oldPage) {

    for (let i = 0; i < 40; i++) {

        await sleep(500);

        const newPage =
            getCurrentPage();

        if (newPage !== oldPage) {
            return true;
        }
    }

    return false;
}


// ------------------------------
// Refresh current page
// ------------------------------

async function refreshCurrentPage(
    delay,
    total,
    page,
    refreshed
) {

    const buttons =
        getRefreshButtons();

    console.log(
        `Page ${page}: found ${buttons.length} unique listings.`
    );


    if (buttons.length === 0) {

        console.log(
            "No listing refresh buttons found."
        );

        return {
            refreshed,
            success: false
        };
    }


    for (let i = 0; i < buttons.length; i++) {

        const state =
            await getState();

        if (state.stopRequested) {

            return {
                refreshed,
                success: false,
                stopped: true
            };
        }


        const button = buttons[i];

        if (!document.contains(button)) {

            console.log(
                "Button disappeared."
            );

            return {
                refreshed,
                success: false
            };
        }


        console.log(
            `Refreshing listing ${refreshed + 1} / ${total}`
        );


        // Click NPC's actual Refresh button.
        button.click();


        // Wait for Livewire to finish.
        const completed =
            await waitForRefreshComplete(button);


        if (!completed) {

            return {
                refreshed,
                success: false,
                stopped: true
            };
        }


        // Only increment after the refresh
        // operation has completed.
        refreshed++;


        await setState({

            running: true,

            stopRequested: false,

            refreshed,

            total,

            page,

            status:
                `Refreshing ${refreshed} / ${total}`

        });


        // User-selected delay.
        const delayCompleted = await sleep(delay);

if (!delayCompleted) {
    return {
        refreshed,
        success: false,
        stopped: true
    };
}
    }


    return {
        refreshed,
        success: true
    };
}


// ------------------------------
// Main refresh process
// ------------------------------

async function startRefresh(delay) {

    if (refreshRunning) {

        console.log(
            "Refresh is already running."
        );

        return;
    }


    refreshRunning = true;


    try {

        const total =
            getTotalListings();


        if (!total) {

            await setState({

                running: false,

                stopRequested: false,

                refreshed: 0,

                total: 0,

                page: 1,

                status:
                    "Could not detect listing count."

            });

            return;
        }


        let refreshed = 0;

        let page =
            getCurrentPage();


        console.log(
            `Starting from page ${page}.`
        );


        await setState({

            running: true,

            stopRequested: false,

            refreshed: 0,

            total,

            page,

            status:
                `Starting on page ${page} — 0 / ${total}`

        });


        // --------------------------
        // Work backwards
        // --------------------------

        while (true) {

            const state =
                await getState();


            if (state.stopRequested) {

                await setState({

                    running: false,

                    stopRequested: false,

                    refreshed,

                    total,

                    page,

                    status:
                        `Stopped — ${refreshed} / ${total}`

                });

                break;
            }


            // Refresh current page.
            const result =
                await refreshCurrentPage(
                    delay,
                    total,
                    page,
                    refreshed
                );


            refreshed =
                result.refreshed;


            if (result.stopped) {

                await setState({

                    running: false,

                    stopRequested: false,

                    refreshed,

                    total,

                    page,

                    status:
                        `Stopped — ${refreshed} / ${total}`

                });

                break;
            }


            // --------------------------
            // Page 1 = finished
            // --------------------------

            if (page <= 1) {

                await setState({

                    running: false,

                    stopRequested: false,

                    refreshed,

                    total,

                    page: 1,

                    status:
                        `Finished — ${refreshed} / ${total}`

                });


                console.log(
                    `Finished! ${refreshed} listings actually refreshed.`
                );

                break;
            }


            // --------------------------
            // Move backwards
            // --------------------------

            const previousButton =
                getPreviousButton();


            if (isPreviousDisabled(previousButton)) {

                await setState({

                    running: false,

                    stopRequested: false,

                    refreshed,

                    total,

                    page,

                    status:
                        `Stopped at page ${page} — ${refreshed} / ${total}`

                });


                console.log(
                    "Previous page button is disabled."
                );

                break;
            }


            const oldPage =
                page;


            page--;


            await setState({

                running: true,

                stopRequested: false,

                refreshed,

                total,

                page,

                status:
                    `Moving to page ${page}...`

            });


            console.log(
                `Moving from page ${oldPage} to page ${page}...`
            );


            previousButton.click();


            const changed =
                await waitForPageChange(oldPage);


            if (!changed) {

                console.log(
                    "Page change was not detected."
                );


                await setState({

                    running: false,

                    stopRequested: false,

                    refreshed,

                    total,

                    page: oldPage,

                    status:
                        `Could not move to page ${page}.`

                });


                break;
            }


            // Allow the new page to settle.
            await sleep(1000);
        }


    } catch (error) {

        console.error(
            "Refresh error:",
            error
        );


        const state =
            await getState();


        await setState({

            ...state,

            running: false,

            stopRequested: false,

            status:
                `Error after ${state.refreshed || 0} listings.`

        });


    } finally {

        refreshRunning = false;
    }
}


// ------------------------------
// Popup messages
// ------------------------------

chrome.runtime.onMessage.addListener(
    (message) => {
        if (
            message.action ===
            "refreshListing"
        ) {

            startRefresh(
                Number(message.delay) || 5000
            );

        }


        if (
            message.action ===
            "stopRefresh"
        ){

            chrome.storage.local
                .get("npcRefreshState")
                .then(result => {

                    console.log(
                        result.npcRefreshState
                    );

                    const state =
                        result.npcRefreshState || {};

                    const newState = {
                        ...state,
                        stopRequested: true,
                        status: "Stopping..."
                    };

                    console.log(
                        newState
                    );

                    return chrome.storage.local.set({
                        npcRefreshState: newState
                    });

    })
    .then(() => {

        console.log(
        );

                })
                .catch(error => {

        console.error(
            error
        );

    });

            chrome.storage.local
                .get("npcRefreshState")
                .then(result => {

                    const state =
                        result.npcRefreshState || {};


                    chrome.storage.local.set({

                        npcRefreshState: {

                            ...state,

                            stopRequested: true,

                            status:
                                "Stopping..."

                        }

                    });

                });

        }

    }
);