import { useMemo, useState } from "react";
import "./ClientPortal.css";

function money(value) {
  return `${Number(value || 0).toFixed(2)} TND`;
}

function badge(value) {
  return String(value || "pending").replaceAll("_", " ");
}

export function PortalLanding({
  users,
  loading,
  request,
  reloadUsers,
  showMessage,
  onAdmin,
  onClient,
}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);

  function connectClient(event) {
    event.preventDefault();

    const user = users.find(
      (item) =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.status === "active"
    );

    if (!user) {
      showMessage(
        "Aucun compte actif ne correspond à cette adresse.",
        "error"
      );
      return;
    }

    onClient(user);
  }

  async function register(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const createdUser = await request("/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          role: "client",
          status: "active",
        }),
      });

      await reloadUsers();
      showMessage("Compte utilisateur créé avec succès.");
      onClient(createdUser);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="portal-entry">
      <section className="portal-entry__visual">
        <div className="portal-brand">
          <span>OM</span>
          <div>
            <strong>Orchestration Academy</strong>
            <small>Formations Cloud AWS & Microsoft</small>
          </div>
        </div>

        <div className="portal-entry__message">
          <span className="portal-kicker">Plateforme Cloud Native</span>
          <h1>Développez vos compétences dans le Cloud.</h1>
          <p>
            Découvrez nos formations, passez vos commandes et suivez vos
            paiements depuis votre espace personnel.
          </p>

          <div className="portal-benefits">
            <span>✓ Formations certifiantes</span>
            <span>✓ Paiement et suivi centralisés</span>
            <span>✓ Infrastructure Amazon EKS</span>
          </div>
        </div>

        <div className="portal-clouds">
          <article>
            <b>AWS</b>
            <span>Amazon Web Services</span>
          </article>

          <article>
            <b>AZ</b>
            <span>Microsoft Azure</span>
          </article>
        </div>
      </section>

      <section className="portal-entry__form">
        <div className="portal-login-card">
          <span className="portal-kicker">Bienvenue</span>
          <h2>
            {mode === "login"
              ? "Accéder à mon espace"
              : "Créer mon compte"}
          </h2>
          <p>
            {mode === "login"
              ? "Utilisez l’adresse email enregistrée dans la plateforme."
              : "Créez gratuitement votre profil apprenant."}
          </p>

          {mode === "login" ? (
            <form onSubmit={connectClient}>
              <label>
                <span>Adresse email</span>
                <input
                  type="email"
                  placeholder="exemple@email.com"
                  value={email}
                  required
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <button
                className="portal-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Chargement..." : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={register}>
              <label>
                <span>Nom complet</span>
                <input
                  type="text"
                  value={form.full_name}
                  required
                  onChange={(event) =>
                    setForm({
                      ...form,
                      full_name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Adresse email</span>
                <input
                  type="email"
                  value={form.email}
                  required
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                />
              </label>

              <button
                className="portal-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Création..." : "Créer mon compte"}
              </button>
            </form>
          )}

          <button
            className="portal-link"
            type="button"
            onClick={() =>
              setMode(mode === "login" ? "register" : "login")
            }
          >
            {mode === "login"
              ? "Je n’ai pas encore de compte"
              : "J’ai déjà un compte"}
          </button>

          <div className="portal-separator">
            <span>Administration</span>
          </div>

          <button
            className="portal-admin-button"
            type="button"
            onClick={onAdmin}
          >
            Accéder au tableau de bord administrateur
          </button>
        </div>
      </section>
    </main>
  );
}

export function ClientPortal({
  user,
  data,
  request,
  loadResource,
  showMessage,
  onLogout,
}) {
  const [page, setPage] = useState("catalogue");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const products = useMemo(
    () =>
      data.products.filter(
        (product) =>
          product.status === "active" &&
          JSON.stringify(product)
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [data.products, search]
  );

  const orders = useMemo(
    () => data.orders.filter((order) => order.user_id === user.id),
    [data.orders, user.id]
  );

  const orderIds = useMemo(
    () => new Set(orders.map((order) => order.id)),
    [orders]
  );

  const payments = useMemo(
    () =>
      data.payments.filter((payment) =>
        orderIds.has(payment.order_id)
      ),
    [data.payments, orderIds]
  );

  const notifications = useMemo(
    () =>
      data.notifications.filter(
        (notification) =>
          notification.user_id === user.id ||
          notification.recipient === user.email
      ),
    [data.notifications, user]
  );

  async function createOrder(product) {
    setBusyId(product.id);

    try {
      await request("/orders", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
          status: "pending",
        }),
      });

      await loadResource("orders");
      showMessage("Formation commandée avec succès.");
      setPage("orders");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function payOrder(order) {
    setBusyId(order.id);

    try {
      await request("/payments", {
        method: "POST",
        body: JSON.stringify({
          order_id: order.id,
          payment_method: "card",
          status: "completed",
        }),
      });

      await Promise.all([
        loadResource("payments"),
        loadResource("orders"),
      ]);

      showMessage("Paiement enregistré avec succès.");
      setPage("payments");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  function productName(productId) {
    return (
      data.products.find((product) => product.id === productId)?.name ||
      "Formation"
    );
  }

  function orderReference(orderId) {
    return (
      data.orders.find((order) => order.id === orderId)?.reference ||
      orderId.slice(0, 8)
    );
  }

  return (
    <div className="client-app">
      <header className="client-header">
        <div className="client-brand">
          <span>OM</span>
          <div>
            <strong>Orchestration Academy</strong>
            <small>Espace apprenant</small>
          </div>
        </div>

        <nav>
          <button
            className={page === "catalogue" ? "active" : ""}
            onClick={() => setPage("catalogue")}
          >
            Formations
          </button>

          <button
            className={page === "orders" ? "active" : ""}
            onClick={() => setPage("orders")}
          >
            Mes commandes
          </button>

          <button
            className={page === "payments" ? "active" : ""}
            onClick={() => setPage("payments")}
          >
            Mes paiements
          </button>

          <button
            className={page === "notifications" ? "active" : ""}
            onClick={() => setPage("notifications")}
          >
            Notifications
          </button>
        </nav>

        <div className="client-user">
          <div>
            <strong>{user.full_name}</strong>
            <span>{user.email}</span>
          </div>

          <button onClick={onLogout}>Déconnexion</button>
        </div>
      </header>

      <main className="client-content">
        {page === "catalogue" && (
          <>
            <section className="client-hero">
              <div>
                <span>Catalogue Cloud 2026</span>
                <h1>Choisissez votre prochaine formation.</h1>
                <p>
                  Formations AWS et Microsoft adaptées à votre niveau
                  et à vos objectifs professionnels.
                </p>
              </div>

              <div className="client-hero__stat">
                <strong>{products.length}</strong>
                <span>formations disponibles</span>
              </div>
            </section>

            <div className="client-toolbar">
              <div>
                <span>Catalogue</span>
                <h2>Nos formations</h2>
              </div>

              <input
                type="search"
                placeholder="Rechercher une formation..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <section className="course-grid">
              {products.map((product) => (
                <article className="course-card" key={product.id}>
                  <div className="course-card__cover">
                    <span>
                      {String(product.provider || product.category || "Cloud")
                        .toUpperCase()
                        .includes("MICROSOFT")
                        ? "AZURE"
                        : "AWS"}
                    </span>
                  </div>

                  <div className="course-card__body">
                    <div className="course-card__meta">
                      <span>{product.category || "Cloud Computing"}</span>
                      <span>{product.level || "Tous niveaux"}</span>
                    </div>

                    <h3>{product.name}</h3>
                    <p>
                      {product.description ||
                        "Formation professionnelle Cloud avec ateliers pratiques."}
                    </p>

                    <div className="course-card__details">
                      <span>⏱ {product.duration_hours || 20} heures</span>
                      <strong>{money(product.price)}</strong>
                    </div>

                    <button
                      onClick={() => createOrder(product)}
                      disabled={busyId === product.id}
                    >
                      {busyId === product.id
                        ? "Commande..."
                        : "Commander la formation"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        {page === "orders" && (
          <section className="client-panel">
            <div className="client-panel__heading">
              <div>
                <span>Suivi</span>
                <h1>Mes commandes</h1>
              </div>

              <button onClick={() => setPage("catalogue")}>
                Voir les formations
              </button>
            </div>

            <div className="client-list">
              {orders.length === 0 ? (
                <p className="client-empty">Aucune commande enregistrée.</p>
              ) : (
                orders.map((order) => {
                  const alreadyPaid = payments.some(
                    (payment) =>
                      payment.order_id === order.id &&
                      payment.status === "completed"
                  );

                  return (
                    <article key={order.id}>
                      <div>
                        <small>{order.reference}</small>
                        <h3>{productName(order.product_id)}</h3>
                        <span className={`client-status ${order.status}`}>
                          {badge(order.status)}
                        </span>
                      </div>

                      <div>
                        <strong>{money(order.total_amount)}</strong>

                        {!alreadyPaid && (
                          <button
                            onClick={() => payOrder(order)}
                            disabled={busyId === order.id}
                          >
                            {busyId === order.id
                              ? "Paiement..."
                              : "Payer"}
                          </button>
                        )}

                        {alreadyPaid && <em>Payée ✓</em>}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}

        {page === "payments" && (
          <section className="client-panel">
            <div className="client-panel__heading">
              <div>
                <span>Historique</span>
                <h1>Mes paiements</h1>
              </div>
            </div>

            <div className="client-list">
              {payments.length === 0 ? (
                <p className="client-empty">Aucun paiement enregistré.</p>
              ) : (
                payments.map((payment) => (
                  <article key={payment.id}>
                    <div>
                      <small>{payment.transaction_reference}</small>
                      <h3>
                        Commande {orderReference(payment.order_id)}
                      </h3>
                      <span className={`client-status ${payment.status}`}>
                        {badge(payment.status)}
                      </span>
                    </div>

                    <strong>{money(payment.amount)}</strong>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {page === "notifications" && (
          <section className="client-panel">
            <div className="client-panel__heading">
              <div>
                <span>Messagerie</span>
                <h1>Mes notifications</h1>
              </div>
            </div>

            <div className="notification-grid">
              {notifications.length === 0 ? (
                <p className="client-empty">
                  Aucune notification pour le moment.
                </p>
              ) : (
                notifications.map((notification) => (
                  <article key={notification.id}>
                    <span>🔔</span>
                    <div>
                      <small>{notification.channel}</small>
                      <h3>{notification.subject}</h3>
                      <p>{notification.message}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}