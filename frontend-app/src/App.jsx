import { useEffect, useMemo, useState } from "react";
import "./App.css";

const services = [
  { name: "Frontend", path: "/", icon: "◈", color: "blue" },
  { name: "Backend API", path: "/api", icon: "⌘", color: "violet" },
  { name: "Utilisateurs", path: "/users", icon: "👤", color: "cyan" },
  { name: "Produits", path: "/products", icon: "▦", color: "green" },
  { name: "Commandes", path: "/orders", icon: "🛒", color: "orange" },
  { name: "Paiements", path: "/payments", icon: "💳", color: "pink" },
  { name: "Notifications", path: "/notifications", icon: "🔔", color: "red" },
];

const activity = [
  {
    title: "Déploiement Helm terminé",
    detail: "7 microservices déployés dans le namespace microservices",
    time: "Il y a quelques minutes",
  },
  {
    title: "Application Load Balancer actif",
    detail: "L'application est accessible depuis Internet",
    time: "Aujourd'hui",
  },
  {
    title: "Cluster Autoscaler opérationnel",
    detail: "La capacité des Node Groups est gérée automatiquement",
    time: "Aujourd'hui",
  },
];

function StatusBadge({ online }) {
  return (
    <span className={online ? "badge badge--ok" : "badge badge--down"}>
      <i />
      {online ? "Opérationnel" : "Indisponible"}
    </span>
  );
}

function ServiceCard({ service, status, baseUrl }) {
  return (
    <article className={`service-card service-card--${service.color}`}>
      <div className="service-card__header">
        <div className="service-card__icon">{service.icon}</div>
        <StatusBadge online={status?.online} />
      </div>

      <div>
        <h3>{service.name}</h3>
        <p>{status?.message || "En attente de vérification"}</p>
      </div>

      <div className="service-card__footer">
        <code>{service.path}</code>
        <a href={`${baseUrl}${service.path}`} target="_blank" rel="noreferrer">
          Ouvrir ↗
        </a>
      </div>
    </article>
  );
}

function StatCard({ label, value, caption, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{caption}</span>
      </div>
    </article>
  );
}

async function probe(baseUrl, service) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(`${baseUrl}${service.path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      online: response.ok,
      message: response.ok ? `HTTP ${response.status}` : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      online: false,
      message:
        error.name === "AbortError"
          ? "Délai dépassé"
          : "CORS bloqué ou service indisponible",
    };
  } finally {
    clearTimeout(timer);
  }
}

export default function App() {
  const initialUrl =
    import.meta.env.VITE_API_BASE_URL || window.location.origin;

  const [baseUrl, setBaseUrl] = useState(initialUrl.replace(/\/+$/, ""));
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const onlineCount = useMemo(
    () => Object.values(statuses).filter((item) => item?.online).length,
    [statuses]
  );

  async function refresh() {
    setLoading(true);
    const entries = await Promise.all(
      services.map(async (service) => [
        service.path,
        await probe(baseUrl, service),
      ])
    );

    setStatuses(Object.fromEntries(entries));
    setLastCheck(new Date());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo__mark">OM</div>
          <div>
            <strong>Orchestration</strong>
            <span>Microservices</span>
          </div>
        </div>

        <nav className="nav">
          <a className="nav__item nav__item--active" href="#dashboard">
            <span>◫</span> Tableau de bord
          </a>
          <a className="nav__item" href="#services">
            <span>⬡</span> Microservices
          </a>
          <a className="nav__item" href="#architecture">
            <span>⌘</span> Architecture
          </a>
          <a className="nav__item" href="#activity">
            <span>◷</span> Activité
          </a>
        </nav>

        <div className="sidebar__card">
          <div className="sidebar__card-icon">AWS</div>
          <strong>Amazon EKS</strong>
          <span>Cluster actif</span>
        </div>

        <div className="sidebar__user">
          <div className="avatar">RB</div>
          <div>
            <strong>Roua Ben Amor</strong>
            <span>DevOps Engineer</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Infrastructure Cloud</p>
            <h1>Tableau de bord</h1>
          </div>

          <div className="topbar__actions">
            <div className="cluster-state">
              <i />
              Cluster opérationnel
            </div>
            <button onClick={refresh} disabled={loading}>
              {loading ? "Vérification..." : "Actualiser"}
            </button>
          </div>
        </header>

        <section className="hero" id="dashboard">
          <div className="hero__content">
            <div className="hero__badge">Amazon EKS + Helm</div>
            <h2>Plateforme d'orchestration des microservices</h2>
            <p>
              Infrastructure cloud automatisée, hautement disponible et
              scalable, déployée sur AWS avec Terraform, Docker, Helm et
              Kubernetes.
            </p>

            <div className="hero__meta">
              <div>
                <span>Services actifs</span>
                <strong>{onlineCount}/7</strong>
              </div>
              <div>
                <span>Dernière vérification</span>
                <strong>
                  {lastCheck ? lastCheck.toLocaleTimeString() : "--:--"}
                </strong>
              </div>
            </div>
          </div>

          <div className="hero__visual" aria-hidden="true">
            <div className="cloud cloud--one">AWS</div>
            <div className="cloud cloud--two">EKS</div>
            <div className="cloud cloud--three">ALB</div>
            <div className="kube">K8s</div>
          </div>
        </section>

        <section className="stats">
          <StatCard
            label="Microservices"
            value="7"
            caption="Déployés avec Helm"
            icon="⬡"
          />
          <StatCard
            label="Pods"
            value="14"
            caption="2 réplicas par service"
            icon="◉"
          />
          <StatCard
            label="Node Groups"
            value="2"
            caption="Managed Node Groups"
            icon="▦"
          />
          <StatCard
            label="Accès externe"
            value="ALB"
            caption="Internet-facing"
            icon="↗"
          />
        </section>

        <section className="panel" id="services">
          <div className="panel__heading">
            <div>
              <p className="eyebrow">Supervision</p>
              <h2>État des microservices</h2>
            </div>

            <div className="url-field">
              <label htmlFor="baseUrl">URL de l'ALB</label>
              <input
                id="baseUrl"
                value={baseUrl}
                onChange={(event) =>
                  setBaseUrl(event.target.value.replace(/\/+$/, ""))
                }
              />
            </div>
          </div>

          <div className="services-grid">
            {services.map((service) => (
              <ServiceCard
                key={service.path}
                service={service}
                status={statuses[service.path]}
                baseUrl={baseUrl}
              />
            ))}
          </div>
        </section>

        <section className="bottom-grid">
          <article className="panel" id="architecture">
            <div className="panel__heading">
              <div>
                <p className="eyebrow">Architecture</p>
                <h2>Chaîne de déploiement</h2>
              </div>
            </div>

            <div className="pipeline">
              {[
                ["01", "Code source"],
                ["02", "Docker"],
                ["03", "Amazon ECR"],
                ["04", "Helm"],
                ["05", "Amazon EKS"],
                ["06", "Ingress ALB"],
              ].map(([number, label], index) => (
                <div className="pipeline__item" key={label}>
                  <span>{number}</span>
                  <strong>{label}</strong>
                  {index < 5 && <i>→</i>}
                </div>
              ))}
            </div>
          </article>

          <article className="panel" id="activity">
            <div className="panel__heading">
              <div>
                <p className="eyebrow">Historique</p>
                <h2>Activité récente</h2>
              </div>
            </div>

            <div className="timeline">
              {activity.map((item) => (
                <div className="timeline__item" key={item.title}>
                  <i />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <span>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <footer>
          <span>Orchestration Microservices</span>
          <span>Terraform · Docker · ECR · Helm · EKS · ALB</span>
        </footer>
      </main>
    </div>
  );
}
