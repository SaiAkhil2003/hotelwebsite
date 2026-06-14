const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydYYh8QKrWgQgCYyLKoeGZB5bijF3eLGzAcVfMgaGzDsU6H9tRuIP0YH-aGRdqoQEy/exec";

const SESSION_EXPIRED_MESSAGE = "Admin session expired. Please login again.";

document.addEventListener("DOMContentLoaded", function () {
  checkSavedAdminAccess();
});

function checkSavedAdminAccess() {
  const isUnlocked = sessionStorage.getItem("adminUnlocked");
  const adminToken = getAdminToken();

  if (isUnlocked === "yes" && adminToken) {
    showAdminContent();
  } else {
    clearAdminSession();
    showPinScreen("");
  }
}

function checkAdminPin(event) {
  event.preventDefault();

  const enteredPin = document.getElementById("adminPin").value.trim();
  const pinError = document.getElementById("pinError");
  const submitButton = event.target.querySelector("button");

  pinError.innerText = "";
  submitButton.disabled = true;
  submitButton.innerText = "Checking...";

  callApi({
    action: "adminLogin",
    pin: enteredPin
  })
    .then(function(response) {
      if (response.status === "success" && response.adminToken) {
        sessionStorage.setItem("adminUnlocked", "yes");
        sessionStorage.setItem("adminToken", response.adminToken);
        document.getElementById("adminPin").value = "";
        pinError.innerText = "";
        showAdminContent();
      } else {
        pinError.innerText = response.message || "Unable to login.";
        document.getElementById("adminPin").value = "";
        document.getElementById("adminPin").focus();
      }
    })
    .catch(function(errorMessage) {
      pinError.innerText = errorMessage;
      document.getElementById("adminPin").focus();
    })
    .finally(function() {
      submitButton.disabled = false;
      submitButton.innerText = "Unlock Admin";
    });
}

function showAdminContent() {
  document.getElementById("pinScreen").classList.add("hidden");
  document.getElementById("adminContent").classList.remove("hidden");
  loadOrders();
}

function logoutAdmin() {
  const adminToken = getAdminToken();

  clearAdminSession();
  showPinScreen("");

  if (adminToken) {
    callApi({
      action: "adminLogout",
      adminToken: adminToken
    }).catch(function() {});
  }
}

function loadOrders() {
  const adminToken = getAdminToken();

  if (!adminToken) {
    handleSessionExpired(SESSION_EXPIRED_MESSAGE);
    return;
  }

  document.getElementById("loadingText").innerText = "Loading orders...";

  callApi({
    action: "getOrders",
    adminToken: adminToken
  })
    .then(function(response) {
      if (response.status !== "success") {
        if (isSessionExpiredResponse(response)) {
          handleSessionExpired(response.message);
          return;
        }

        alert(response.message || "Unable to load orders.");
        return;
      }

      displayOrders(response.orders);
      updateSummary(response.orders);

      document.getElementById("loadingText").innerText =
        response.orders.length + " order(s) found.";
    })
    .catch(function(errorMessage) {
      document.getElementById("loadingText").innerText = "Unable to load orders.";
      alert(errorMessage);
    });
}

function displayOrders(orders) {
  const tableBody = document.getElementById("ordersTableBody");
  const mobileOrders = document.getElementById("mobileOrders");

  tableBody.innerHTML = "";
  mobileOrders.innerHTML = "";

  if (orders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11">No orders found.</td>
      </tr>
    `;

    mobileOrders.innerHTML = `
      <div class="mobile-card">
        <p>No orders found.</p>
      </div>
    `;

    return;
  }

  orders.slice().reverse().forEach(function(order) {
    const statusClass = getStatusClass(order.statusValue);

    tableBody.innerHTML += `
      <tr>
        <td><strong>${order.tokenNo}</strong></td>
        <td>${order.date}</td>
        <td>${order.time}</td>
        <td>${order.customerName}</td>
        <td>${order.mobileNumber}</td>
        <td>${order.orderType}</td>
        <td>${order.items}</td>
        <td>${order.totalAmount}</td>
        <td>${order.specialInstructions || "-"}</td>
        <td>
          <span class="status-badge ${statusClass}">
            ${order.statusValue}
          </span>
        </td>
        <td>
          ${getStatusButtons(order.rowNumber, order.statusValue)}
        </td>
      </tr>
    `;

    mobileOrders.innerHTML += `
      <div class="mobile-card">
        <h3>${order.tokenNo}</h3>

        <p><strong>Date:</strong> ${order.date}</p>
        <p><strong>Time:</strong> ${order.time}</p>
        <p><strong>Customer:</strong> ${order.customerName}</p>
        <p><strong>Mobile:</strong> ${order.mobileNumber}</p>
        <p><strong>Order Type:</strong> ${order.orderType}</p>
        <p><strong>Items:</strong> ${order.items}</p>
        <p><strong>Total:</strong> ${order.totalAmount}</p>
        <p><strong>Instructions:</strong> ${order.specialInstructions || "-"}</p>
        <p>
          <strong>Status:</strong>
          <span class="status-badge ${statusClass}">
            ${order.statusValue}
          </span>
        </p>

        ${getStatusButtons(order.rowNumber, order.statusValue)}
      </div>
    `;
  });
}

function getStatusButtons(rowNumber, currentStatus) {
  return `
    <div class="status-buttons">
      <button
        class="btn-preparing"
        onclick="updateStatus(${rowNumber}, 'Preparing')"
        ${currentStatus === "Preparing" ? "disabled" : ""}
      >
        Preparing
      </button>

      <button
        class="btn-ready"
        onclick="updateStatus(${rowNumber}, 'Ready')"
        ${currentStatus === "Ready" ? "disabled" : ""}
      >
        Ready
      </button>

      <button
        class="btn-delivered"
        onclick="updateStatus(${rowNumber}, 'Delivered')"
        ${currentStatus === "Delivered" ? "disabled" : ""}
      >
        Delivered
      </button>
    </div>
  `;
}

function updateStatus(rowNumber, statusValue) {
  const adminToken = getAdminToken();

  if (!adminToken) {
    handleSessionExpired(SESSION_EXPIRED_MESSAGE);
    return;
  }

  const confirmUpdate = confirm("Change order status to " + statusValue + "?");

  if (!confirmUpdate) {
    return;
  }

  callApi({
    action: "updateStatus",
    rowNumber: rowNumber,
    statusValue: statusValue,
    adminToken: adminToken
  })
    .then(function(response) {
      if (response.status === "success") {
        loadOrders();
      } else {
        if (isSessionExpiredResponse(response)) {
          handleSessionExpired(response.message);
          return;
        }

        alert(response.message || "Unable to update status.");
      }
    })
    .catch(function(errorMessage) {
      alert(errorMessage);
    });
}

function updateSummary(orders) {
  const pending = orders.filter(order => order.statusValue === "Pending").length;
  const preparing = orders.filter(order => order.statusValue === "Preparing").length;
  const ready = orders.filter(order => order.statusValue === "Ready").length;
  const delivered = orders.filter(order => order.statusValue === "Delivered").length;

  document.getElementById("pendingCount").innerText = pending;
  document.getElementById("preparingCount").innerText = preparing;
  document.getElementById("readyCount").innerText = ready;
  document.getElementById("deliveredCount").innerText = delivered;
}

function getStatusClass(statusValue) {
  if (statusValue === "Preparing") {
    return "status-preparing";
  }

  if (statusValue === "Ready") {
    return "status-ready";
  }

  if (statusValue === "Delivered") {
    return "status-delivered";
  }

  return "status-pending";
}

function getAdminToken() {
  return sessionStorage.getItem("adminToken");
}

function clearAdminSession() {
  sessionStorage.removeItem("adminUnlocked");
  sessionStorage.removeItem("adminToken");
}

function showPinScreen(message) {
  document.getElementById("adminContent").classList.add("hidden");
  document.getElementById("pinScreen").classList.remove("hidden");
  document.getElementById("adminPin").value = "";
  document.getElementById("pinError").innerText = message || "";
}

function handleSessionExpired(message) {
  clearAdminSession();
  showPinScreen(message || SESSION_EXPIRED_MESSAGE);
}

function isSessionExpiredResponse(response) {
  return response && response.message === SESSION_EXPIRED_MESSAGE;
}


function callApi(paramsObject) {
  return new Promise(function(resolve, reject) {
    if (!WEB_APP_URL || WEB_APP_URL.includes("PASTE_YOUR")) {
      reject("Please paste your Google Apps Script Web App URL in admin.js.");
      return;
    }

    const callbackName = "adminCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");

    let completed = false;

    const timeout = setTimeout(function() {
      if (!completed) {
        cleanup();
        reject("Could not connect to Google Sheet. Please refresh and try again.");
      }
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);

      if (window[callbackName]) {
        delete window[callbackName];
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function(response) {
      completed = true;
      cleanup();
      resolve(response);
    };

    const params = new URLSearchParams();
    params.append("callback", callbackName);
    params.append("_", Date.now());

    Object.keys(paramsObject).forEach(function(key) {
      params.append(key, paramsObject[key]);
    });

    script.src = WEB_APP_URL + "?" + params.toString();
    script.async = true;

    document.body.appendChild(script);
  });
}
