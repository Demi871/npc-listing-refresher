let selectedDelay = 5000;



const speedButton = document.getElementById("speedButton");
const speedOptions = document.getElementById("speedOptions");
const refreshButton = document.getElementById("refreshButton");
const stopButton = document.getElementById("stopButton");
const status = document.getElementById("status");


// ------------------------------
// Storage helpers
// ------------------------------

async function saveDelay(delay) {
    await chrome.storage.local.set({
        npcRefreshDelay: delay
    });
}

async function loadSettings() {

    const result = await chrome.storage.local.get([
        "npcRefreshDelay",
        "npcRefreshState"
    ]);

    if (result.npcRefreshDelay) {
        selectedDelay = Number(result.npcRefreshDelay);

        const option = document.querySelector(
            `.speed-option[data-delay="${selectedDelay}"]`
        );

        if (option) {
            speedButton.textContent = option.textContent.trim();
        }
    }

    if (result.npcRefreshState) {
        updateStatus(result.npcRefreshState);
    }
}


// ------------------------------
// Status
// ------------------------------

function updateStatus(state) {

    if (!state) return;

    status.textContent = state.status || "Ready";

    if (state.running) {
        refreshButton.disabled = true;
        stopButton.disabled = false;
    } else {
        refreshButton.disabled = false;
        stopButton.disabled = true;
    }
}


// ------------------------------
// Speed menu
// ------------------------------

speedButton.addEventListener("click", () => {

    speedOptions.classList.toggle("show");

});


document.querySelectorAll(".speed-option").forEach(option => {

    option.addEventListener("click", async () => {

        selectedDelay = Number(option.dataset.delay);

        speedButton.textContent = option.textContent.trim();

        speedOptions.classList.remove("show");

        await saveDelay(selectedDelay);

        status.textContent = `Delay saved: ${option.textContent.trim()}`;

    });

});


// ------------------------------
// Start refresh
// ------------------------------

refreshButton.addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.id) {
        status.textContent = "No active tab.";
        return;
    }

    try {

        await chrome.tabs.sendMessage(tab.id, {
            action: "refreshListing",
            delay: selectedDelay
        });

        status.textContent = "Starting...";

        refreshButton.disabled = true;
        stopButton.disabled = false;

    } catch (error) {

        console.error(error);

        status.textContent =
            "Open a Nigeria Property Centre listings page.";

    }

});


// ------------------------------
// Stop refresh
// ------------------------------

stopButton.addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.id) return;

    try {

        await chrome.tabs.sendMessage(tab.id, {
            action: "stopRefresh"
        });

        status.textContent = "Stopping...";

    } catch (error) {

        console.error(error);

        status.textContent = "Could not contact the page.";

    }

});


// ------------------------------
// Live progress updates
// ------------------------------

chrome.storage.onChanged.addListener((changes, areaName) => {

    if (areaName !== "local") return;

    if (changes.npcRefreshState) {

        updateStatus(
            changes.npcRefreshState.newValue
        );

    }

});


// Load saved settings when popup opens
loadSettings();