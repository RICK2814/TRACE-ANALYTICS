(function () {
  var CART_KEY = "trailCoCart";
  var toast = document.querySelector(".toast");
  var toastTimer;

  function readCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (item) {
        return item && typeof item.name === "string" &&
          Number.isFinite(Number(item.price)) && Number(item.price) > 0 &&
          Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0;
      }).map(function (item) {
        return {
          id: String(item.id || item.name),
          name: String(item.name),
          price: Math.round(Number(item.price)),
          image: typeof item.image === "string" ? item.image : "",
          quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity))))
        };
      });
    } catch (_) {
      return [];
    }
  }

  function cartCount(cart) {
    return cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }

  function renderCount(cart) {
    var count = cartCount(cart);
    document.querySelectorAll("[data-cart-count]").forEach(function (node) {
      node.textContent = String(count);
    });
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {}
  }

  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function parseRupees(text) {
    var amount = Number(String(text || "").replace(/[^\d]/g, ""));
    return Number.isFinite(amount) ? amount : 0;
  }

  var cart = readCart();
  renderCount(cart);

  document.querySelectorAll("[data-add], .add-to-bag").forEach(function (button) {
    button.addEventListener("click", function () {
      var card = button.closest(".product-card, .product-tile");
      if (!card) {
        say("This product could not be added. Please try again.");
        return;
      }
      var title = card.querySelector(".product-name, .product-info h3, .product-details h2");
      var priceNode = card.querySelector(".product-price, .price");
      var imageNode = card.querySelector(".product-picture img, .product-photo img");
      var name = title ? title.textContent.trim() : String(button.getAttribute("data-product") || "Trail Co. item");
      var price = parseRupees(priceNode ? priceNode.textContent : "");
      if (!name || price < 1) {
        say("This item is missing product details. Please try another item.");
        return;
      }
      var id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      var image = imageNode ? imageNode.getAttribute("src") || "" : "";
      var existing = cart.find(function (item) { return item.id === id; });
      if (existing) {
        existing.quantity = Math.min(99, existing.quantity + 1);
      } else {
        cart.push({ id: id, name: name, price: price, image: image, quantity: 1 });
      }
      renderCount(cart);
      var oldText = button.textContent.trim();
      button.textContent = "Added ✓";
      button.setAttribute("aria-label", name + " added to your pack");
      say(name + " added to your pack. " + cartCount(cart) + (cartCount(cart) === 1 ? " item in total." : " items in total."));
      window.setTimeout(function () {
        button.textContent = oldText;
        button.removeAttribute("aria-label");
      }, 1400);
    });
  });

  document.querySelectorAll("[data-open-bag]").forEach(function (button) {
    button.addEventListener("click", function () {
      window.location.href = "/checkout.html";
    });
  });

  var menu = document.querySelector(".menu-toggle");
  var nav = document.querySelector(".site-nav");
  if (menu && nav) {
    menu.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menu.textContent = open ? "Close ×" : "Menu +";
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        menu.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-label", "Open navigation");
        menu.textContent = "Menu +";
      });
    });
  }

  var filters = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-category]"));
  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      var filter = button.getAttribute("data-filter");
      var shown = 0;
      filters.forEach(function (item) {
        item.setAttribute("aria-pressed", String(item === button));
      });
      cards.forEach(function (card) {
        var visible = filter === "all" || card.getAttribute("data-category") === filter;
        card.hidden = !visible;
        if (visible) shown += 1;
      });
      var count = document.querySelector("[data-result-count]");
      if (count) count.textContent = shown + (shown === 1 ? " piece" : " pieces");
    });
  });

  document.querySelectorAll("[data-newsletter]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var message = form.querySelector(".form-message");
      if (!input || !input.checkValidity()) {
        if (input) input.reportValidity();
        return;
      }
      if (message) message.textContent = "You're on the list. Keep an eye out for the next field note.";
      form.reset();
      say("Thanks for joining Trail Co.");
    });
  });
})();