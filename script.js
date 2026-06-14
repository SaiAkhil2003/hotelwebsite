const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydYYh8QKrWgQgCYyLKoeGZB5bijF3eLGzAcVfMgaGzDsU6H9tRuIP0YH-aGRdqoQEy/exec";

const menuItems = [
  {
    name: "Veg Meals",
    description: "Rice, curry, dal and yogurt",
    category: "Veg",
    price: 9.99
  },
  {
    name: "Chicken Biryani",
    description: "Spicy biryani served with raita and gravy",
    category: "Non Veg",
    price: 13.99
  },
  {
    name: "Paneer Fried Rice",
    description: "Fried rice with paneer and vegetables",
    category: "Veg",
    price: 10.99
  },
  {
    name: "Chicken Noodles",
    description: "Noodles cooked with chicken and sauces",
    category: "Non Veg",
    price: 11.99
  },
  {
    name: "Tea",
    description: "Fresh hot tea",
    category: "Veg",
    price: 2.49
  },
  {
    name: "Cold Drink",
    description: "Chilled soft drink",
    category: "Veg",
    price: 3.49
  }
];

let cart = [];
let total = 0;
let lastReceiptData = null;

document.addEventListener("DOMContentLoaded", function () {
  displayMenuItems();
  updateCart();
});

function toggleMenu() {
  document.getElementById("navbar").classList.toggle("active");
}

function closeMenu() {
  document.getElementById("navbar").classList.remove("active");
}

function formatMoney(amount) {
  return "$" + Number(amount).toFixed(2);
}

function displayMenuItems() {
  const menuGrid = document.getElementById("menuGrid");

  menuGrid.innerHTML = "";

  menuItems.forEach(function (item) {
    const badgeClass = item.category === "Veg" ? "veg" : "nonveg";

    menuGrid.innerHTML += `
      <div class="menu-card">
        <div>
          <h3>${item.name}</h3>
          <p>${item.description}</p>
          <span class="${badgeClass}">${item.category}</span>
        </div>

        <div class="price-box">
          <strong>${formatMoney(item.price)}</strong>
          <button onclick="addItem('${item.name}')">Add</button>
        </div>
      </div>
    `;
  });
}

function addItem(name) {
  const selectedMenuItem = menuItems.find(function (item) {
    return item.name === name;
  });

  if (!selectedMenuItem) {
    alert("Item not found.");
    return;
  }

  const existingItem = cart.find(function (item) {
    return item.name === name;
  });

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      name: selectedMenuItem.name,
      price: selectedMenuItem.price,
      quantity: 1
    });
  }

  updateCart();

  document.getElementById("token").scrollIntoView({
    behavior: "smooth"
  });
}

function increaseQuantity(name) {
  const item = cart.find(function (cartItem) {
    return cartItem.name === name;
  });

  if (item) {
    item.quantity += 1;
  }

  updateCart();
}

function decreaseQuantity(name) {
  const item = cart.find(function (cartItem) {
    return cartItem.name === name;
  });

  if (!item) {
    return;
  }

  item.quantity -= 1;

  if (item.quantity <= 0) {
    cart = cart.filter(function (cartItem) {
      return cartItem.name !== name;
    });
  }

  updateCart();
}

function updateCart() {
  const cartItems = document.getElementById("cartItems");
  const totalAmount = document.getElementById("totalAmount");

  cartItems.innerHTML = "";
  total = 0;

  if (cart.length === 0) {
    cartItems.innerHTML = `<p class="empty-cart">No items selected yet.</p>`;
    totalAmount.innerText = "$0.00";
    return;
  }

  cart.forEach(function (item) {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    cartItems.innerHTML += `
      <div class="cart-item">
        <div>
          <span>${item.name} x ${item.quantity}</span>

          <div class="quantity-controls">
            <button onclick="decreaseQuantity('${item.name}')">−</button>
            <span>${item.quantity}</span>
            <button onclick="increaseQuantity('${item.name}')">+</button>
          </div>
        </div>

        <strong>${formatMoney(itemTotal)}</strong>
      </div>
    `;
  });

  totalAmount.innerText = formatMoney(total);
}

function createToken(event) {
  event.preventDefault();

  if (cart.length === 0) {
    alert("Please select at least one food item.");
    return;
  }

  const customerName = document.getElementById("customerName").value.trim();
  const mobileNumber = document.getElementById("mobileNumber").value.trim();
  const orderType = document.getElementById("orderType").value;
  const instructions = document.getElementById("instructions").value.trim();

  if (customerName.length < 2) {
    alert("Please enter a valid customer name.");
    return;
  }

  if (mobileNumber.length < 10) {
    alert("Please enter a valid mobile number.");
    return;
  }

  const submitButton = event.target.querySelector(".submit-btn");
  submitButton.disabled = true;
  submitButton.innerText = "Creating Token...";

  const orderData = {
    customerName: customerName,
    mobileNumber: mobileNumber,
    orderType: orderType,
    instructions: instructions,
    items: cart.map(function(item) {
      return {
        name: item.name,
        price: item.price,
        quantity: item.quantity
      };
    }),
    totalAmount: formatMoney(total)
  };

  sendOrderToGoogleSheet(orderData)
    .then(function (response) {
      lastReceiptData = {
        tokenNumber: response.tokenNumber,
        customerName: customerName,
        mobileNumber: mobileNumber,
        orderType: orderType,
        instructions: instructions || "None",
        items: orderData.items,
        totalAmount: formatMoney(total),
        estimatedTime: "20 minutes"
      };

      showReceipt(lastReceiptData);
    })
    .catch(function (errorMessage) {
      alert(errorMessage);
    })
    .finally(function () {
      submitButton.disabled = false;
      submitButton.innerText = "Create Token";
    });
}

function showReceipt(receiptData) {
  document.getElementById("tokenNumber").innerText = receiptData.tokenNumber;
  document.getElementById("resultName").innerText = receiptData.customerName;
  document.getElementById("resultMobile").innerText = receiptData.mobileNumber;
  document.getElementById("resultOrderType").innerText = receiptData.orderType;
  document.getElementById("resultTotal").innerText = receiptData.totalAmount;
  document.getElementById("resultInstructions").innerText = receiptData.instructions;

  const resultItems = document.getElementById("resultItems");
  resultItems.innerHTML = "";

  receiptData.items.forEach(function(item) {
    const itemTotal = item.price * item.quantity;

    resultItems.innerHTML += `
      <div class="receipt-item-row">
        <span>${item.name} x ${item.quantity}</span>
        <strong>${formatMoney(itemTotal)}</strong>
      </div>
    `;
  });

  document.getElementById("successBox").style.display = "block";

  document.getElementById("successBox").scrollIntoView({
    behavior: "smooth"
  });
}

function sendOrderToGoogleSheet(orderData) {
  return new Promise(function (resolve, reject) {
    if (!WEB_APP_URL || WEB_APP_URL.includes("PASTE_YOUR")) {
      reject("Please paste your Google Apps Script Web App URL in script.js.");
      return;
    }

    const callbackName = "restaurantTokenCallback_" + Date.now();
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

    window[callbackName] = function (response) {
      completed = true;
      cleanup();

      if (response.status === "success") {
        resolve(response);
      } else {
        reject(response.message || "Unable to create token.");
      }
    };

    const params = new URLSearchParams();
    params.append("callback", callbackName);
    params.append("_", Date.now());
    params.append("customerName", orderData.customerName);
    params.append("mobileNumber", orderData.mobileNumber);
    params.append("orderType", orderData.orderType);
    params.append("instructions", orderData.instructions);
    params.append("items", JSON.stringify(orderData.items));
    params.append("totalAmount", orderData.totalAmount);

    script.src = WEB_APP_URL + "?" + params.toString();
    script.async = true;

    document.body.appendChild(script);
  });
}

function printToken() {
  window.print();
}

function shareOnWhatsApp() {
  if (!lastReceiptData) {
    alert("No token available to share.");
    return;
  }

  const itemText = lastReceiptData.items
    .map(function(item) {
      return item.name + " x " + item.quantity;
    })
    .join(", ");

  const message =
    "Smart Restaurant Token%0A" +
    "Token No: " + lastReceiptData.tokenNumber + "%0A" +
    "Name: " + lastReceiptData.customerName + "%0A" +
    "Mobile: " + lastReceiptData.mobileNumber + "%0A" +
    "Order Type: " + lastReceiptData.orderType + "%0A" +
    "Items: " + itemText + "%0A" +
    "Total: " + lastReceiptData.totalAmount + "%0A" +
    "Estimated Time: " + lastReceiptData.estimatedTime;

  const whatsappUrl = "https://wa.me/?text=" + message;

  window.open(whatsappUrl, "_blank");
}

function newToken() {
  cart = [];
  total = 0;
  lastReceiptData = null;

  document.getElementById("customerName").value = "";
  document.getElementById("mobileNumber").value = "";
  document.getElementById("orderType").value = "";
  document.getElementById("instructions").value = "";

  updateCart();

  document.getElementById("successBox").style.display = "none";

  document.getElementById("home").scrollIntoView({
    behavior: "smooth"
  });
}
