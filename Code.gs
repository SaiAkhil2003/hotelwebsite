const SHEET_NAME = "Token_Orders";
const ADMIN_SESSION_SECONDS = 6 * 60 * 60;

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || "createToken";
  let response;

  try {
    if (action === "adminLogin") {
      response = adminLogin_(params.pin);
    } else if (action === "adminLogout") {
      response = adminLogout_(params.adminToken);
    } else if (action === "getOrders") {
      response = getOrders_(params.adminToken);
    } else if (action === "updateStatus") {
      response = updateStatus_(params.adminToken, params.rowNumber, params.statusValue);
    } else {
      response = createToken_(params);
    }
  } catch (error) {
    response = {
      status: "error",
      message: error.message || "Unable to process request."
    };
  }

  return jsonpResponse_(params.callback, response);
}

function setupAdminPin() {
  // Restaurant owner can change "1234" later in Script Properties.
  PropertiesService.getScriptProperties().setProperty("ADMIN_PIN", "1234");
}

function adminLogin_(enteredPin) {
  const adminPin = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");

  if (!adminPin) {
    return {
      status: "error",
      message: "Admin PIN is not configured in Script Properties."
    };
  }

  if (String(enteredPin || "") !== String(adminPin)) {
    return {
      status: "error",
      message: "Incorrect admin PIN."
    };
  }

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put("admin_token_" + token, "valid", ADMIN_SESSION_SECONDS);

  return {
    status: "success",
    adminToken: token,
    message: "Admin login successful"
  };
}

function validateAdminToken_(adminToken) {
  if (!adminToken) {
    return false;
  }

  return CacheService.getScriptCache().get("admin_token_" + adminToken) === "valid";
}

function adminLogout_(adminToken) {
  if (adminToken) {
    CacheService.getScriptCache().remove("admin_token_" + adminToken);
  }

  return {
    status: "success",
    message: "Admin logged out"
  };
}

function createToken_(params) {
  const sheet = getOrdersSheet_();
  const now = new Date();
  const timeZone = Session.getScriptTimeZone();
  const tokenNo = generateTokenNo_(sheet);
  const items = formatItems_(params.items);

  sheet.appendRow([
    tokenNo,
    Utilities.formatDate(now, timeZone, "MM/dd/yyyy"),
    Utilities.formatDate(now, timeZone, "h:mm a"),
    params.customerName || "",
    params.mobileNumber || "",
    params.orderType || "",
    items,
    params.totalAmount || "",
    params.instructions || "",
    "Pending"
  ]);

  return {
    status: "success",
    tokenNumber: tokenNo,
    message: "Token created successfully"
  };
}

function getOrders_(adminToken) {
  if (!validateAdminToken_(adminToken)) {
    return adminSessionExpired_();
  }

  const sheet = getOrdersSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      status: "success",
      orders: []
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const orders = values.map(function(row, index) {
    return {
      rowNumber: index + 2,
      tokenNo: row[0],
      date: formatDateValue_(row[1]),
      time: formatTimeValue_(row[2]),
      customerName: row[3],
      mobileNumber: row[4],
      orderType: row[5],
      items: row[6],
      totalAmount: row[7],
      specialInstructions: row[8],
      statusValue: row[9] || "Pending"
    };
  });

  return {
    status: "success",
    orders: orders
  };
}

function updateStatus_(adminToken, rowNumber, statusValue) {
  if (!validateAdminToken_(adminToken)) {
    return adminSessionExpired_();
  }

  const allowedStatuses = ["Pending", "Preparing", "Ready", "Delivered"];

  if (allowedStatuses.indexOf(statusValue) === -1) {
    return {
      status: "error",
      message: "Invalid status value."
    };
  }

  const targetRow = Number(rowNumber);

  if (!targetRow || targetRow < 2) {
    return {
      status: "error",
      message: "Invalid row number."
    };
  }

  const sheet = getOrdersSheet_();

  if (targetRow > sheet.getLastRow()) {
    return {
      status: "error",
      message: "Order row was not found."
    };
  }

  sheet.getRange(targetRow, 10).setValue(statusValue);

  return {
    status: "success",
    message: "Order status updated successfully."
  };
}

function adminSessionExpired_() {
  return {
    status: "error",
    message: "Admin session expired. Please login again."
  };
}

function getOrdersSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Spreadsheet not found. If this is a standalone Apps Script, set SPREADSHEET_ID in Script Properties.");
  }

  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error("Sheet tab not found: " + SHEET_NAME);
  }

  return sheet;
}

function generateTokenNo_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return "A001";
  }

  const tokenValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let index = tokenValues.length - 1; index >= 0; index -= 1) {
    const token = String(tokenValues[index][0] || "");
    const match = token.match(/^A(\d+)$/);

    if (match) {
      return "A" + String(Number(match[1]) + 1).padStart(3, "0");
    }
  }

  return "A" + String(lastRow).padStart(3, "0");
}

function formatItems_(itemsJson) {
  if (!itemsJson) {
    return "";
  }

  try {
    const items = JSON.parse(itemsJson);

    if (!Array.isArray(items)) {
      return String(itemsJson);
    }

    return items.map(function(item) {
      return item.name + " x " + item.quantity;
    }).join(", ");
  } catch (error) {
    return String(itemsJson);
  }
}

function formatDateValue_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }

  return value || "";
}

function formatTimeValue_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "h:mm a");
  }

  return value || "";
}

function jsonpResponse_(callback, response) {
  const safeCallback = isValidCallbackName_(callback) ? callback : "callback";

  return ContentService
    .createTextOutput(safeCallback + "(" + JSON.stringify(response) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function isValidCallbackName_(callback) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(String(callback || ""));
}
