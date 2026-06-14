const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydYYh8QKrWgQgCYyLKoeGZB5bijF3eLGzAcVfMgaGzDsU6H9tRuIP0YH-aGRdqoQEy/exec";

const ADMIN_PIN = "1234";

document.addEventListener("DOMContentLoaded", function () {
  checkSavedAdminAccess();
});

function checkSavedAdminAccess() {
  const isUnlocked = sessionStorage.getItem("adminUnlocked");

  if (isUnlocked === "yes") {
    showAdminContent();
  } else {
    document.getElementById("pinScreen").classList.remove("hidden");
    document.getElementById("adminContent").classList.add("hidden");
  }
}

function checkAdminPin(event) {
  event.preventDefault();

  const enteredPin = document.getElementById("adminPin").value.trim();
  const pinError = document.getElementById("pinError");

  if (enteredPin === ADMIN_PIN) {
    sessionStorage.setItem("adminUnlocked", "yes");
    pinError.innerText = "";
    showAdminContent();
  } else {
    pinError.innerText = "Incorrect PIN. Please try again.";
    document.getElementById("adminPin").value = "";
    document.getElementById("adminPin").focus();
  }
}

function showAdminContent() {
  document.getElementById("pinScreen").classList.add("hidden");
  document.getElementById("adminContent").classList.remove("hidden");
  loadOrders();
}

function logoutAdmin() {
  sessionStorage.removeItem("adminUnlocked");

  document.getElementById("adminContent").classList.add("hidden");
  document.getElementById("pinScreen").classList.remove("hidden");
  document.getElementById("adminPin").value = "";
  document.getElementById("pinError").innerText = "";
}

function loadOrders() {
  document.getElementById("loadingText").innerText = "Loading orders...";

  callApi({
    action: "getOrders"
  })
    .then(function(response) {
      if (response.status !== "success") {
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

  orders.reverse().forEach(function(order) {
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
  const confirmUpdate = confirm("Change order status to " + statusValue + "?");

  if (!confirmUpdate) {
    return;
  }

  callApi({
    action: "updateStatus",
    rowNumber: rowNumber,
    statusValue: statusValue
  })
    .then(function(response) {
      if (response.status === "success") {
        loadOrders();
      } else {
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


function callApi(paramsObject) {
  return new Promise(function(resolve, reject) {
    if (!WEB_APP_URL || WEB_APP_URL.includes("PASTE_YOUR")) {
      reject("Please paste your Google Apps Script Web App URL in admin.js.");
      return;
    }

    const callbackName = "adminCallback_" + Date.now();
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
