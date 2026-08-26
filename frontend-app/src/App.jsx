import { useEffect, useMemo, useState } from "react";
import "./App.css";

const isLocal =
  window.location.hostname === "localhost" &&
  window.location.port === "5173";

const resources = {
  users: {
    title: "Utilisateurs",
    singular: "Utilisateur",
    icon: "👥",
    color: "blue",
    endpoint: isLocal ? "http://localhost:3001" : "/users",
    columns: [
      ["full_name", "Nom complet"],
      ["email", "Adresse email"],
      ["role", "Rôle"],
      ["status", "Statut"],
    ],
    fields: [
      {
        name: "full_name",
        label: "Nom complet",
        type: "text",
        required: true,
      },
      {
        name: "email",
        label: "Adresse email",
        type: "email",
        required: true,
      },
      {
        name: "role",
        label: "Rôle",
        type: "select",
        options: ["client", "manager", "admin"],
        required: true,
      },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["active", "inactive"],
        required: true,
      },
    ],
  },

  products: {
    title: "Produits",
    singular: "Produit",
    icon: "📦",
    color: "green",
    endpoint: isLocal ? "http://localhost:3002" : "/products",
    columns: [
      ["name", "Produit"],
      ["category", "Catégorie"],
      ["price", "Prix"],
      ["stock", "Stock"],
      ["status", "Statut"],
    ],
    fields: [
      {
        name: "name",
        label: "Nom du produit",
        type: "text",
        required: true,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
      },
      {
        name: "category",
        label: "Catégorie",
        type: "text",
        required: true,
      },
      {
        name: "price",
        label: "Prix",
        type: "number",
        step: "0.01",
        required: true,
      },
      {
        name: "stock",
        label: "Stock",
        type: "number",
        required: true,
      },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["active", "inactive"],
        required: true,
      },
    ],
  },

  orders: {
    title: "Commandes",
    singular: "Commande",
    icon: "🛒",
    color: "orange",
    endpoint: isLocal ? "http://localhost:3003" : "/orders",
    columns: [
      ["reference", "Référence"],
      ["user_id", "Utilisateur"],
      ["product_id", "Produit"],
      ["quantity", "Quantité"],
      ["total_amount", "Total"],
      ["status", "Statut"],
    ],
    fields: [
      {
        name: "user_id",
        label: "Utilisateur",
        type: "relation",
        resource: "users",
        value: "id",
        display: "full_name",
        required: true,
      },
      {
        name: "product_id",
        label: "Produit",
        type: "relation",
        resource: "products",
        value: "id",
        display: "name",
        required: true,
      },
      {
        name: "quantity",
        label: "Quantité",
        type: "number",
        required: true,
      },

      {
        name: "status",
        label: "Statut",
        type: "select",
        options: [
          "pending",
          "confirmed",
          "paid",
          "shipped",
          "completed",
          "cancelled",
        ],
        required: true,
      },
    ],
  },

  payments: {
    title: "Paiements",
    singular: "Paiement",
    icon: "💳",
    color: "violet",
    endpoint: isLocal ? "http://localhost:3004" : "/payments",
    columns: [
      ["transaction_reference", "Transaction"],
      ["order_id", "Commande"],
      ["amount", "Montant"],
      ["payment_method", "Méthode"],
      ["status", "Statut"],
    ],
    fields: [
      {
        name: "order_id",
        label: "Commande",
        type: "relation",
        resource: "orders",
        value: "id",
        display: "reference",
        required: true,
      },

      {
        name: "payment_method",
        label: "Méthode",
        type: "select",
        options: ["card", "bank_transfer", "cash"],
        required: true,
      },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: [
          "pending",
          "processing",
          "completed",
          "failed",
          "refunded",
        ],
        required: true,
      },
    ],
  },

  notifications: {
    title: "Notifications",
    singular: "Notification",
    icon: "🔔",
    color: "red",
    endpoint: isLocal ? "http://localhost:3005" : "/notifications",
    columns: [
      ["recipient", "Destinataire"],
      ["channel", "Canal"],
      ["subject", "Sujet"],
      ["status", "Statut"],
      ["created_at", "Créée le"],
    ],
    fields: [
      {
        name: "user_id",
        label: "Utilisateur",
        type: "relation",
        resource: "users",
        value: "id",
        display: "full_name",
      },
      {
        name: "recipient",
        label: "Destinataire",
        type: "text",
        required: true,
      },
      {
        name: "channel",
        label: "Canal",
        type: "select",
        options: ["email", "sms", "push"],
        required: true,
      },
      {
        name: "subject",
        label: "Sujet",
        type: "text",
        required: true,
      },
      {
        name: "message",
        label: "Message",
        type: "textarea",
        required: true,
      },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["pending", "sent", "failed", "read"],
        required: true,
      },
    ],
  },
};

const defaultValues = {
  users: {
    role: "client",
    status: "active",
  },
  products: {
    provider: "AWS",
    category: "Cloud Computing",
    level: "Débutant",
    duration_hours: 20,
    price: 0,
    status: "active",
  },
  orders: {
    quantity: 1,
    status: "pending",
  },
  payments: {
    payment_method: "card",
    status: "pending",
  },
  notifications: {
    channel: "email",
    status: "pending",
  },
};

function formatValue(resourceKey, field, value, data) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (field === "price" || field === "total_amount" || field === "amount") {
    return `${Number(value).toFixed(2)} TND`;
  }

  if (field === "duration_hours") {
    return `${value} h`;
  }

  if (field === "created_at" || field === "updated_at") {
    return new Date(value).toLocaleString("fr-FR");
  }

  if (field === "user_id") {
    const user = data.users?.find((item) => item.id === value);
    return user?.full_name || value.slice(0, 8);
  }

  if (field === "product_id") {
    const product = data.products?.find((item) => item.id === value);
    return product?.name || value.slice(0, 8);
  }

  if (field === "order_id") {
    const order = data.orders?.find((item) => item.id === value);
    return order?.reference || value.slice(0, 8);
  }

  return String(value).replaceAll("_", " ");
}

function StatusBadge({ value }) {
  const positive = [
    "active",
    "completed",
    "sent",
    "paid",
    "shipped",
    "healthy",
  ].includes(value);

  const negative = [
    "inactive",
    "failed",
    "cancelled",
    "refunded",
  ].includes(value);

  return (
    <span
      className={`status-badge ${
        positive
          ? "status-badge--positive"
          : negative
            ? "status-badge--negative"
            : "status-badge--pending"
      }`}
    >
      {String(value).replaceAll("_", " ")}
    </span>
  );
}

function Dashboard({ data, health, onNavigate }) {
  const totalRevenue = data.payments
    .filter((payment) => payment.status === "completed")
    .reduce((total, payment) => total + Number(payment.amount), 0);

  return (
    <>
      <section className="welcome-card">
        <div>
          <span className="welcome-card__label">
            Amazon EKS + Helm
          </span>

          <h2>Plateforme de gestion microservices</h2>

          <p>
            Gérez les utilisateurs, produits, commandes, paiements
            et notifications depuis une interface centralisée.
          </p>
        </div>

        <div className="welcome-card__visual">
          <span>AWS</span>
          <strong>EKS</strong>
        </div>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <div className="stat-card__icon blue">👥</div>
          <div>
            <span>Utilisateurs</span>
            <strong>{data.users.length}</strong>
            <small>Comptes enregistrés</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card__icon green">📦</div>
          <div>
            <span>Formations</span>
            <strong>{data.products.length}</strong>
            <small>Cours disponibles</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card__icon orange">🛒</div>
          <div>
            <span>Commandes</span>
            <strong>{data.orders.length}</strong>
            <small>Commandes créées</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card__icon violet">💰</div>
          <div>
            <span>Chiffre d'affaires</span>
            <strong>{totalRevenue.toFixed(2)}</strong>
            <small>TND encaissés</small>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Infrastructure</span>
              <h3>État des microservices</h3>
            </div>

            <span className="global-status">
              {Object.values(health).every(Boolean)
                ? "Tout est opérationnel"
                : "Vérification nécessaire"}
            </span>
          </div>

          <div className="health-list">
            {Object.entries(resources).map(([key, resource]) => (
              <div className="health-row" key={key}>
                <div className={`health-icon ${resource.color}`}>
                  {resource.icon}
                </div>

                <div>
                  <strong>{resource.title}</strong>
                  <span>{resource.endpoint}</span>
                </div>

                <StatusBadge
                  value={health[key] ? "healthy" : "failed"}
                />
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Accès rapide</span>
              <h3>Gestion de la plateforme</h3>
            </div>
          </div>

          <div className="quick-actions">
            {Object.entries(resources).map(([key, resource]) => (
              <button
                key={key}
                onClick={() => onNavigate(key)}
              >
                <span className={resource.color}>{resource.icon}</span>
                <div>
                  <strong>{resource.title}</strong>
                  <small>Consulter et gérer</small>
                </div>
                <b>›</b>
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function ResourcePage({
  resourceKey,
  data,
  allData,
  loading,
  onCreate,
  onEdit,
  onDelete,
}) {
  const resource = resources[resourceKey];
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return data.filter((item) =>
      JSON.stringify(item)
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [data, search]);

  return (
    <section className="panel resource-panel">
      <div className="resource-header">
        <div>
          <span className="eyebrow">Gestion</span>
          <h2>{resource.title}</h2>
          <p>
            {data.length} élément{data.length !== 1 ? "s" : ""} enregistré
            {data.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          className="primary-button"
          onClick={onCreate}
        >
          <span>＋</span>
          Ajouter
        </button>
      </div>

      <div className="table-toolbar">
        <label className="search-field">
          <span>⌕</span>
          <input
            type="search"
            placeholder={`Rechercher dans ${resource.title.toLowerCase()}...`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {resource.columns.map(([, label]) => (
                <th key={label}>{label}</th>
              ))}

              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  className="empty-cell"
                  colSpan={resource.columns.length + 1}
                >
                  Chargement...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  className="empty-cell"
                  colSpan={resource.columns.length + 1}
                >
                  Aucun élément trouvé.
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.id}>
                  {resource.columns.map(([field]) => (
                    <td key={field}>
                      {field === "status" ? (
                        <StatusBadge value={item[field]} />
                      ) : (
                        formatValue(
                          resourceKey,
                          field,
                          item[field],
                          allData
                        )
                      )}
                    </td>
                  ))}

                  <td>
                    <div className="row-actions">
                      <button
                        className="edit-button"
                        onClick={() => onEdit(item)}
                        title="Modifier"
                      >
                        ✎
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => onDelete(item)}
                        title="Supprimer"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResourceModal({
  resourceKey,
  item,
  allData,
  onClose,
  onSubmit,
}) {
  const resource = resources[resourceKey];
  const [form, setForm] = useState(
    item || defaultValues[resourceKey] || {}
  );
  const [saving, setSaving] = useState(false);

  function changeField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <span className="eyebrow">
              {item ? "Modification" : "Création"}
            </span>

            <h2>
              {item ? "Modifier" : "Ajouter"} {resource.singular.toLowerCase()}
            </h2>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="form-grid">
          {resource.fields.map((field) => {
            const fieldValue = form[field.name] ?? "";

            if (field.type === "textarea") {
              return (
                <label className="form-field form-field--full" key={field.name}>
                  <span>{field.label}</span>

                  <textarea
                    value={fieldValue}
                    required={field.required}
                    rows="4"
                    onChange={(event) =>
                      changeField(field.name, event.target.value)
                    }
                  />
                </label>
              );
            }

            if (field.type === "select") {
              return (
                <label className="form-field" key={field.name}>
                  <span>{field.label}</span>

                  <select
                    value={fieldValue}
                    required={field.required}
                    onChange={(event) =>
                      changeField(field.name, event.target.value)
                    }
                  >
                    <option value="">Sélectionner</option>

                    {field.options.map((option) => (
                      <option value={option} key={option}>
                        {option.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            if (field.type === "relation") {
              const options = allData[field.resource] || [];

              return (
                <label className="form-field" key={field.name}>
                  <span>{field.label}</span>

                  <select
                    value={fieldValue}
                    required={field.required}
                    onChange={(event) =>
                      changeField(field.name, event.target.value)
                    }
                  >
                    <option value="">Sélectionner</option>

                    {options.map((option) => (
                      <option
                        value={option[field.value]}
                        key={option[field.value]}
                      >
                        {option[field.display]}
                        {field.resource === "products"
                          ? ` - ${Number(option.price).toFixed(2)} TND`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return (
              <label className="form-field" key={field.name}>
                <span>{field.label}</span>

                <input
                  type={field.type}
                  step={field.step}
                  required={field.required}
                  value={fieldValue}
                  onChange={(event) =>
                    changeField(
                      field.name,
                      field.type === "number"
                        ? Number(event.target.value)
                        : event.target.value
                    )
                  }
                />
              </label>
            );
          })}
        </div>

        <div className="modal__footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Annuler
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const emptyData = {
    users: [],
    products: [],
    orders: [],
    payments: [],
    notifications: [],
  };

  const [activePage, setActivePage] = useState("dashboard");
  const [data, setData] = useState(emptyData);
  const [health, setHealth] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(null);

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        errorBody.message || `Erreur HTTP ${response.status}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async function loadResource(key) {
    const resource = resources[key];

    try {
      const [items, healthResponse] = await Promise.all([
        request(resource.endpoint),
        request(`${resource.endpoint}/health`),
      ]);

      setData((current) => ({
        ...current,
        [key]: items,
      }));

      setHealth((current) => ({
        ...current,
        [key]: healthResponse.status === "healthy",
      }));
    } catch (error) {
      setHealth((current) => ({
        ...current,
        [key]: false,
      }));
    }
  }

  async function loadAll() {
    setLoading(true);

    await Promise.all(
      Object.keys(resources).map((key) => loadResource(key))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function showMessage(text, type = "success") {
    setMessage({ text, type });

    window.setTimeout(() => {
      setMessage(null);
    }, 3500);
  }

  async function saveItem(form) {
    const resourceKey = modal.resourceKey;
    const resource = resources[resourceKey];
    const editingItem = modal.item;

    try {
      await request(
        editingItem
          ? `${resource.endpoint}/${editingItem.id}`
          : resource.endpoint,
        {
          method: editingItem ? "PUT" : "POST",
          body: JSON.stringify(form),
        }
      );

      await loadResource(resourceKey);
      setModal(null);

      showMessage(
        `${resource.singular} ${
          editingItem ? "modifié" : "ajouté"
        } avec succès.`
      );
    } catch (error) {
      showMessage(error.message, "error");
      throw error;
    }
  }

  async function deleteItem(resourceKey, item) {
    const resource = resources[resourceKey];

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer cet élément ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await request(`${resource.endpoint}/${item.id}`, {
        method: "DELETE",
      });

      await loadResource(resourceKey);
      showMessage(`${resource.singular} supprimé avec succès.`);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  const activeTitle =
    activePage === "dashboard"
      ? "Tableau de bord"
      : resources[activePage].title;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__logo">OM</div>

          <div>
            <strong>Orchestration</strong>
            <span>Microservices</span>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={activePage === "dashboard" ? "active" : ""}
            onClick={() => setActivePage("dashboard")}
          >
            <span>▦</span>
            Tableau de bord
          </button>

          <p>GESTION</p>

          {Object.entries(resources).map(([key, resource]) => (
            <button
              key={key}
              className={activePage === key ? "active" : ""}
              onClick={() => setActivePage(key)}
            >
              <span>{resource.icon}</span>
              {resource.title}

              <i className={health[key] ? "online" : "offline"} />
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="aws-card">
            <span>AWS</span>

            <div>
              <strong>Amazon EKS</strong>
              <small>Cluster opérationnel</small>
            </div>
          </div>

          <div className="profile">
            <div className="profile__avatar">RB</div>

            <div>
              <strong>Roua Ben Amor</strong>
              <span>DevOps Engineer</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Plateforme cloud</span>
            <h1>{activeTitle}</h1>
          </div>

          <div className="topbar__actions">
            <span className="cluster-badge">
              <i />
              Cluster opérationnel
            </span>

            <button
              className="refresh-button"
              onClick={loadAll}
              disabled={loading}
            >
              ↻ {loading ? "Actualisation..." : "Actualiser"}
            </button>
          </div>
        </header>

        {activePage === "dashboard" ? (
          <Dashboard
            data={data}
            health={health}
            onNavigate={setActivePage}
          />
        ) : (
          <ResourcePage
            resourceKey={activePage}
            data={data[activePage]}
            allData={data}
            loading={loading}
            onCreate={() =>
              setModal({
                resourceKey: activePage,
                item: null,
              })
            }
            onEdit={(item) =>
              setModal({
                resourceKey: activePage,
                item,
              })
            }
            onDelete={(item) =>
              deleteItem(activePage, item)
            }
          />
        )}
      </main>

      {modal && (
        <ResourceModal
          resourceKey={modal.resourceKey}
          item={modal.item}
          allData={data}
          onClose={() => setModal(null)}
          onSubmit={saveItem}
        />
      )}

      {message && (
        <div className={`toast toast--${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}