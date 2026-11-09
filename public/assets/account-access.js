(() => {
  "use strict";
  const dialog = document.getElementById("lg"),
    form = document.getElementById("lf");
  if (!dialog || !form) return;
  const roles = document.getElementById("roles"),
    dashboard = document.getElementById("dash"),
    error = document.getElementById("account-error");
  let selected = "customer",
    user = null,
    busy = false;
  const names = {
    customer: "Customer",
    architect: "Architect",
    builder: "Builder",
  };
  const identifier = form.querySelector('[name="username"]'),
    password = form.querySelector('[name="password"]');
  async function api(path, body) {
    const response = await fetch("/api/auth/" + path, {
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Please sign in again.");
    return data;
  }
  function paint() {
    roles.replaceChildren();
    Object.entries(names).forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(selected === value));
      button.disabled = busy;
      button.onclick = () => {
        selected = value;
        password.value = "";
        error.textContent = "";
        paint();
      };
      roles.append(button);
    });
    const admin = document.createElement("a");
    admin.className = "chip";
    admin.href = "/admin";
    admin.target = "_top";
    admin.textContent = "Admin";
    roles.append(admin);
    const signed = user && user.role === selected;
    form.hidden = !!signed;
    dashboard.replaceChildren();
    if (signed) {
      const title = document.createElement("h3");
      title.textContent = "Welcome, " + user.name;
      const description = document.createElement("p");
      description.textContent =
        "Signed in as " + names[user.role] + " · " + user.username;
      const note = document.createElement("p");
      note.className = "note";
      note.textContent =
        "Your account is active. Explore our products, colours and painting tools.";
      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "btn btn-line";
      logout.textContent = "Logout";
      logout.disabled = busy;
      logout.onclick = async () => {
        if (busy) return;
        busy = true;
        paint();
        try {
          await api("logout", {});
          user = null;
          identifier.value = "";
          password.value = "";
        } catch (e) {
          error.textContent = e.message;
        } finally {
          busy = false;
          paint();
        }
      };
      dashboard.append(title, description, note, logout);
    }
    form.querySelector('button[type="submit"]').disabled = busy;
    form.querySelector('button[type="submit"]').textContent = busy
      ? "Signing in…"
      : "Sign in";
    document.querySelectorAll(".ref-nav-actions [data-r]").forEach((button) => {
      button.textContent = user ? "My account" : "Login";
      button.dataset.r = user ? names[user.role] : "Customer";
    });
  }
  window.arevaOpenAccount = (role = "Customer") => {
    if (role === "Admin") {
      window.top.location.href = "/admin";
      return;
    }
    // A top-level backend page allows first-party session cookies on split deployments.
    if (
      window.top !== window &&
      document.referrer &&
      new URL(document.referrer).origin !== location.origin
    ) {
      const url = new URL("/attached-page", location.origin);
      url.searchParams.set("account", role);
      window.top.location.href = url.href;
      return;
    }
    selected =
      Object.keys(names).find((key) => names[key] === role) ||
      user?.role ||
      "customer";
    error.textContent = "";
    password.value = "";
    paint();
    if (!dialog.open) dialog.showModal();
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    error.textContent = "";
    paint();
    try {
      await api("login", {
        username: identifier.value,
        password: password.value,
        role: selected,
      });
      user = (await api("session")).user;
      password.value = "";
    } catch (e) {
      error.textContent = e.message;
    } finally {
      busy = false;
      paint();
    }
  });
  dialog.addEventListener("close", () => {
    password.value = "";
    error.textContent = "";
  });
  document.getElementById("lx").onclick = () => dialog.close();
  paint();
  void api("session")
    .then((data) => {
      user = data.user;
      selected = user.role;
      paint();
    })
    .catch(() => {})
    .finally(() => {
      const role = new URLSearchParams(location.search).get("account");
      if (role && Object.values(names).includes(role))
        window.arevaOpenAccount(role);
    });
})();
