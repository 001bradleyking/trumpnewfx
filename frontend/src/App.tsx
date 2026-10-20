import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type User = { id: number; name: string; email: string }
type Stats = { target_usd: number; raised_usd: number; founders_count: number; campaign_end_at: string | null; verified: boolean; status: string }
type AuthView = 'login' | 'register' | 'verify' | 'forgot' | 'reset'
type ApiResult = { message?: string; user?: User | null; requires_2fa?: boolean; csrf_token?: string; errors?: Record<string, string[]> }

const emptyStats: Stats = { target_usd: 100000, raised_usd: 0, founders_count: 0, campaign_end_at: null, verified: false, status: 'preproduction' }

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [authView, setAuthView] = useState<AuthView | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [code, setCode] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const csrf = useRef('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (window.location.pathname === '/reset-password' && params.has('token')) {
      setAuthView('reset')
      setAuthEmail(params.get('email') ?? '')
    }

    void (async () => {
      try {
        const csrfResponse = await fetch('/api/csrf', { credentials: 'include' })
        csrf.current = ((await csrfResponse.json()) as ApiResult).csrf_token ?? ''
        const me = await fetch('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } })
        setUser(((await me.json()) as ApiResult).user ?? null)
        const publicStats = await fetch('/api/public/stats', { headers: { Accept: 'application/json' } })
        if (publicStats.ok) setStats((await publicStats.json()) as Stats)
      } catch {
        // The public landing page remains usable while the API is unavailable.
      }
    })()

    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    }), { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  async function request(url: string, payload?: Record<string, string>): Promise<ApiResult> {
    if (!csrf.current) {
      const csrfResponse = await fetch('/api/csrf', { credentials: 'include', headers: { Accept: 'application/json' } })
      csrf.current = ((await csrfResponse.json()) as ApiResult).csrf_token ?? ''
    }

    const response = await fetch(url, {
      method: payload ? 'POST' : 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf.current } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    })
    const data = (await response.json().catch(() => ({}))) as ApiResult
    if (!response.ok) {
      const firstError = data.errors ? Object.values(data.errors)[0]?.[0] : undefined
      throw new Error(firstError ?? data.message ?? 'Une erreur est survenue. Réessayez.')
    }
    return data
  }

  function openAuth(view: AuthView) {
    setMessage('')
    setCode('')
    setAuthView(view)
    setMobileMenu(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (field: string) => String(form.get(field) ?? '').trim()
    setBusy(true)
    setMessage('')
    try {
      if (authView === 'register') {
        await request('/api/auth/register', { name: value('name'), email: value('email'), password: value('password'), password_confirmation: value('password_confirmation') })
        setAuthEmail(value('email'))
        setAuthView('verify')
        setMessage('Votre compte est prêt. Saisissez le code envoyé par e-mail pour valider la session.')
      } else if (authView === 'login') {
        await request('/api/auth/login', { email: value('email'), password: value('password') })
        setAuthEmail(value('email'))
        setAuthView('verify')
        setMessage('Saisissez le code envoyé à votre adresse e-mail pour terminer la connexion.')
      } else if (authView === 'verify') {
        const result = await request('/api/auth/verify', { code })
        setUser(result.user ?? null)
        setAuthView(null)
        setCode('')
        setMessage('')
        window.setTimeout(() => document.querySelector('#member-space')?.scrollIntoView({ behavior: 'smooth' }), 80)
      } else if (authView === 'forgot') {
        const result = await request('/api/auth/forgot-password', { email: value('email') })
        setMessage(result.message ?? 'Si cette adresse correspond à un compte, un lien a été envoyé.')
      } else if (authView === 'reset') {
        const params = new URLSearchParams(window.location.search)
        const result = await request('/api/auth/reset-password', { token: params.get('token') ?? '', email: authEmail || value('email'), password: value('password'), password_confirmation: value('password_confirmation') })
        setMessage(result.message ?? 'Mot de passe mis à jour. Vous pouvez vous connecter.')
        window.history.replaceState({}, '', '/')
        setAuthView('login')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    setBusy(true)
    setMessage('')
    try {
      const result = await request('/api/auth/resend-code', {})
      setMessage(result.message ?? 'Un nouveau code a été envoyé.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de renvoyer le code.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    try {
      await request('/api/auth/logout', {})
      setUser(null)
      setMessage('Vous êtes déconnecté.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La déconnexion a échoué.')
    } finally {
      setBusy(false)
    }
  }

  const progress = Math.max(0, Math.min(100, (stats.raised_usd / (stats.target_usd || 100000)) * 100))
  const scrollTo = (id: string) => {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="site-header">
        <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); scrollTo('top') }} aria-label="NEWS FX accueil"><img src="/news-fx-logo.jpeg" alt="NEWS FX — Informer, analyser, anticiper" /></a>
        <button className="menu-button" aria-label="Ouvrir le menu" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><span /><span /></button>
        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'} aria-label="Navigation principale">
          <button onClick={() => scrollTo('project')}>Le projet</button><button onClick={() => scrollTo('objective')}>Objectif</button><button onClick={() => scrollTo('offers')}>Offres</button><button onClick={() => scrollTo('faq')}>FAQ</button>
        </nav>
        <div className="nav-actions">{user ? <button className="button button-quiet" onClick={() => scrollTo('member-space')}>Mon espace</button> : <button className="button button-quiet" onClick={() => openAuth('login')}>Connexion</button>}<button className="button button-gold button-small" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>{user ? 'Espace membre' : 'Devenir fondateur'}<span aria-hidden="true">↗</span></button></div>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> EN PRÉPARATION <span className="eyebrow-divider" /> NEWS FX</div>
            <h1>L’information qui éclaire.<br /><span>Le contexte qui compte.</span></h1>
            <p className="hero-lead">Une veille structurée sur les annonces politiques et économiques, avec sources, horodatages et analyses mesurées. Pensée pour les traders qui veulent mieux comprendre l’actualité.</p>
            <div className="hero-actions"><button className="button button-gold button-large" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>Rejoindre les fondateurs <span aria-hidden="true">↗</span></button><button className="button button-outline button-large" onClick={() => scrollTo('project')}><span className="play-icon">▶</span> Découvrir le projet</button></div>
            <div className="hero-proof"><div className="proof-mark">✳</div><p><b>La transparence avant tout.</b><br /><span>Pas de promesse de gains. Des sources et du contexte.</span></p></div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="signal-card glass-card">
              <div className="signal-top"><span className="signal-label"><span className="live-dot" /> PROJET EN PRÉPARATION</span><span className="signal-time">NEWS FX</span></div>
              <img className="hero-logo" src="/news-fx-logo.jpeg" alt="Logo NEWS FX" />
              <div className="signal-rule" />
              <div className="signal-bottom"><div><span className="mini-label">OBJECTIF D’ACCÈS API</span><b>100 000 <small>USD*</small></b></div><div className="signal-orbit"><span>FX</span></div></div>
              <p className="signal-note">*Estimation de travail à confirmer auprès du fournisseur.</p>
            </div>
            <div className="float-chip chip-top"><span className="chip-icon">◉</span><div><b>Sources identifiées</b><small>Quand elles sont autorisées</small></div></div>
            <div className="float-chip chip-bottom"><span className="chip-icon gold-icon">↗</span><div><b>Du contexte, pas des certitudes</b><small>Information générale · marché à risque</small></div></div>
            <div className="hero-grid-lines" />
          </div>
        </section>

        <section className="trust-strip section-wrap" aria-label="Principes du projet"><div><span>01</span><b>Sources transparentes</b></div><i /><div><span>02</span><b>Analyse avec contexte</b></div><i /><div><span>03</span><b>Aucune promesse de profit</b></div></section>

        <section className="section-wrap project-section" id="project">
          <div className="section-heading reveal"><div><div className="eyebrow">NOTRE AMBITION</div><h2>Du signal à la compréhension.</h2></div><p>NEWS FX construit un service d’information financière qui distingue clairement les faits, les sources et les interprétations.</p></div>
          <div className="feature-grid">
            <article className="feature-card reveal"><span className="feature-number">01 / SOURCES</span><div className="feature-icon">⌁</div><h3>Une veille structurée</h3><p>Suivre les annonces politiques et économiques susceptibles de compter pour les marchés, avec lien vers la source lorsque les droits le permettent.</p></article>
            <article className="feature-card reveal delay-one"><span className="feature-number">02 / CONTEXTE</span><div className="feature-icon">◌</div><h3>Un contexte lisible</h3><p>Résumé en français, catégorie et horodatage. Les analyses sont présentées comme des analyses, jamais comme des faits confirmés.</p></article>
            <article className="feature-card reveal delay-two"><span className="feature-number">03 / COMMUNAUTÉ</span><div className="feature-icon">↗</div><h3>Un espace membre privé</h3><p>Les alertes et l’accès communautaire seront réservés aux membres actifs, après validation technique et confirmation du service.</p></article>
          </div>
        </section>

        <section className="objective-section" id="objective"><div className="section-wrap objective-grid">
          <div className="objective-copy reveal"><div className="eyebrow">UNE ÉTAPE À LA FOIS</div><h2>Préparer l’accès.<br /><span>Construire la confiance.</span></h2><p>L’accès à Truth API n’est pas encore confirmé. Le montant de 100 000 USD est une estimation de travail : il devra être confirmé par une proposition officielle et une autorisation écrite de redistribution.</p><div className="objective-footnote"><span>↗</span> Aucun fonds n’est collecté par cette page.</div></div>
          <div className="progress-card glass-card reveal delay-one"><div className="progress-head"><div><span className="mini-label">MOBILISATION VÉRIFIÉE</span><h3>État de l’objectif</h3></div><span className="status-pill"><span className="live-dot" /> PRÉPARATION</span></div><div className="progress-values"><strong>{stats.raised_usd.toLocaleString('fr-FR')} <small>USD</small></strong><span>sur {stats.target_usd.toLocaleString('fr-FR')} USD</span></div><div className="progress-track" role="progressbar" aria-label="Progression vérifiée vers l’objectif" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><div className="progress-meta"><span>{progress.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de l’objectif</span><span>{stats.founders_count} membres fondateurs</span></div><div className="progress-divider" /><div className="countdown-row"><div><span className="mini-label">FIN DE CAMPAGNE</span><b>{stats.campaign_end_at ? new Date(stats.campaign_end_at).toLocaleDateString('fr-FR') : 'Calendrier à définir'}</b></div><span className="calendar-icon">▦</span></div><p className="progress-disclaimer">Le montant et le nombre de membres restent à zéro tant que des données vérifiées ne sont pas connectées.</p></div>
        </div></section>

        <section className="section-wrap referral-section"><div className="referral-panel reveal"><div className="referral-copy"><div className="eyebrow">FAIRE GRANDIR LA COMMUNAUTÉ</div><h2>Vous connaissez le projet.<br /><span>Faites-le découvrir.</span></h2><p>Un programme de parrainage fondateur est à l’étude. Des bonus ou réductions sur les offres futures pourront être proposés après validation de règles claires.</p><button className="button button-outline" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>Être informé du programme <span>↗</span></button></div><div className="referral-board"><div className="board-head"><span>CLASSEMENT FONDATEURS</span><span>À VENIR</span></div><div className="board-empty"><div className="board-circles"><span>✳</span><span>✳</span><span>✳</span></div><b>Les premiers membres écriront l’histoire.</b><p>Le classement apparaîtra lorsque le programme et ses règles seront validés.</p></div><div className="board-footer"><span>RÉCOMPENSES NON ACTIVÉES</span><span>•••</span></div></div></div></section>

        <section className="section-wrap offers-section" id="offers"><div className="section-heading reveal"><div><div className="eyebrow">OFFRES ENVISAGÉES</div><h2>Un accès pensé pour durer.</h2></div><p>Tarifs indicatifs du cahier des charges. La vente reste fermée tant que les modalités de service et de remboursement ne sont pas validées.</p></div><div className="offer-grid">
          <article className="offer-card offer-featured reveal"><div className="offer-top"><span className="offer-label">OFFRE DE LANCEMENT</span><span className="offer-spark">✳</span></div><h3>Membre fondateur</h3><p>Pour accompagner la phase de préparation.</p><div className="offer-price">100 <small>USD*</small></div><div className="offer-period">Période envisagée : quatre mois</div><div className="offer-line" /><ul><li>Accès aux alertes privées, si le service démarre</li><li>Un mois offert envisagé au lancement effectif</li><li>Accès Discord après paiement confirmé</li></ul><button className="button button-gold offer-button" onClick={() => openAuth('register')}>Préinscription bientôt <span>↗</span></button><small className="offer-legal">*Prix et modalités à confirmer. Aucun paiement disponible.</small></article>
          <article className="offer-card reveal delay-one"><div className="offer-top"><span className="offer-label">OFFRE ENVISAGÉE</span><span className="offer-spark muted-spark">◌</span></div><h3>Membre standard</h3><p>La continuité de la veille après lancement.</p><div className="offer-price">1 000 <small>USD*</small></div><div className="offer-period">Durée et renouvellement à définir</div><div className="offer-line" /><ul><li>Accès aux alertes et analyses privées</li><li>Communauté membre sécurisée</li><li>Contenu définitif à publier avant ouverture</li></ul><button className="button button-outline offer-button" onClick={() => openAuth('register')}>Être informé <span>↗</span></button><small className="offer-legal">*Prix indicatif, non activé à la vente.</small></article>
        </div></section>

        <section className="section-wrap process-section"><div className="section-heading reveal"><div><div className="eyebrow">COMMENT ÇA MARCHE</div><h2>Simple, clair, vérifiable.</h2></div></div><div className="process-list"><div className="process-item reveal"><span>01</span><div><h3>Le fournisseur, sous conditions</h3><p>Demander un devis officiel, vérifier le prix, les limites techniques et les droits de redistribution commerciale.</p></div><i>↘</i></div><div className="process-item reveal"><span>02</span><div><h3>Les informations, avec leur source</h3><p>Contrôler l’origine, horodater et séparer le fait rapporté du résumé et de l’analyse.</p></div><i>↘</i></div><div className="process-item reveal"><span>03</span><div><h3>La diffusion, après validation</h3><p>Les alertes destinées aux membres seront diffusées dans l’espace privé lorsque le service sera opérationnel.</p></div><i>↗</i></div></div><div className="notice-card reveal"><span className="notice-mark">i</span><p><b>Une étape préalable importante.</b> Tant que Truth API, son coût et ses droits ne sont pas confirmés, NEWS FX ne garantit ni vitesse de transmission ni accès anticipé aux annonces.</p></div></section>

        <section className="section-wrap faq-section" id="faq"><div className="section-heading reveal"><div><div className="eyebrow">QUESTIONS FRÉQUENTES</div><h2>Les réponses sans détour.</h2></div></div><div className="faq-list"><details className="faq-item reveal"><summary>NEWS FX est-il déjà opérationnel ?<span>＋</span></summary><p>Non. Le projet est en préparation. L’accès à Truth API, les droits de diffusion et le calendrier restent à confirmer.</p></details><details className="faq-item reveal"><summary>La progression et le nombre de membres sont-ils réels ?<span>＋</span></summary><p>Les statistiques affichées proviennent du service et restent à zéro tant qu’aucune donnée de paiement vérifiée n’est reliée. Aucun chiffre d’audience n’est inventé.</p></details><details className="faq-item reveal"><summary>Comment seront confirmés les paiements ?<span>＋</span></summary><p>Le cahier des charges prévoit USDT TRC20. Une solution compatible pour carte bancaire ou virement devra être étudiée séparément. Aucun moyen de paiement n’est activé à ce stade.</p></details><details className="faq-item reveal"><summary>Les alertes donnent-elles des conseils de trading ?<span>＋</span></summary><p>Non. NEWS FX proposera des informations générales et du contexte, sans conseil personnalisé, garantie de résultat ou recommandation d’exécution d’ordres.</p></details><details className="faq-item reveal"><summary>Quand l’accès Discord sera-t-il ouvert ?<span>＋</span></summary><p>Uniquement après le lancement du service, confirmation fiable du paiement et activation d’un abonnement. Les salons privés devront être protégés par des rôles.</p></details></div></section>

        <section className="final-cta section-wrap"><div className="cta-inner reveal"><img src="/news-fx-logo.jpeg" alt="" /><div><div className="eyebrow">NEWS FX · EN PRÉPARATION</div><h2>Suivre l’actualité avec plus de clarté.</h2><p>Inscrivez-vous pour suivre les prochaines étapes du projet.</p></div><button className="button button-gold button-large" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>Créer mon compte <span>↗</span></button></div></section>

        {user && <section className="section-wrap member-section" id="member-space"><div className="member-card glass-card"><div><div className="eyebrow">ESPACE PERSONNEL</div><h2>Bonjour, {user.name.split(' ')[0]}.</h2><p>Connecté avec {user.email}. Votre session a été validée par code e-mail.</p><div className="member-status"><span className="live-dot" /> COMPTE VÉRIFIÉ · ABONNEMENT NON ACTIVÉ</div><p className="member-note">Les paiements et l’accès Discord ne sont pas ouverts en préproduction. Le bouton Discord apparaîtra dans cet espace uniquement après confirmation d’un abonnement actif.</p></div><button className="button button-outline" onClick={() => void logout()} disabled={busy}>{busy ? 'Déconnexion…' : 'Se déconnecter'}</button></div></section>}
      </main>

      <footer className="site-footer"><div className="footer-top section-wrap"><a className="footer-logo" href="#top" onClick={(event) => { event.preventDefault(); scrollTo('top') }}><img src="/news-fx-logo.jpeg" alt="NEWS FX" /></a><p>Informer. Analyser. Anticiper.<br /><span>L’information financière avec contexte et transparence.</span></p><div className="footer-links"><button onClick={() => scrollTo('project')}>À propos</button><button onClick={() => scrollTo('faq')}>FAQ</button><a href="mailto:contact@news-fx.com">Contact</a><button onClick={() => openAuth('login')}>Espace membre</button></div></div><div className="footer-bottom section-wrap"><span>© {new Date().getFullYear()} NEWS FX · Tous droits réservés.</span><span>Information générale — pas un conseil financier.</span><button onClick={() => setMessage('Les documents juridiques complets seront publiés avant l’ouverture du service.')}>Conditions & confidentialité</button></div></footer>

      {message && !authView && <div className="toast" role="status">{message}<button aria-label="Fermer" onClick={() => setMessage('')}>×</button></div>}

      {authView && <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && authView !== 'verify') setAuthView(null) }}><section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={() => { setAuthView(null); setMessage('') }} aria-label="Fermer">×</button><div className="auth-brand"><img src="/news-fx-logo.jpeg" alt="NEWS FX" /></div><div className="eyebrow">SÉCURITÉ DU COMPTE</div><h2 id="auth-title">{authView === 'register' ? 'Créer votre compte.' : authView === 'login' ? 'Ravi de vous revoir.' : authView === 'verify' ? 'Vérifiez votre e-mail.' : authView === 'forgot' ? 'Mot de passe oublié ?' : 'Choisissez un nouveau mot de passe.'}</h2><p className="auth-intro">{authView === 'register' ? 'Un compte pour suivre le projet et préparer votre espace membre.' : authView === 'login' ? 'Une connexion protégée en deux étapes.' : authView === 'verify' ? 'Saisissez le code à 6 chiffres envoyé à votre adresse. Il expire dans 10 minutes.' : authView === 'forgot' ? 'Nous vous enverrons un lien de réinitialisation si votre adresse est associée à un compte.' : 'Le lien est à usage unique et limité dans le temps.'}</p>
        {authView === 'verify' ? <form onSubmit={submit} className="auth-form"><label htmlFor="verification-code">Code envoyé par e-mail</label><input id="verification-code" className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" required /><p className="field-hint">Le code n’est jamais demandé par téléphone ou message privé.</p>{message && <p className="form-message" role="status">{message}</p>}<button className="button button-gold auth-submit" disabled={busy || code.length !== 6}>{busy ? 'Vérification…' : 'Valider et ouvrir ma session'} <span>↗</span></button><button className="text-button" type="button" onClick={() => void resendCode()} disabled={busy}>Renvoyer un nouveau code</button></form> : <form onSubmit={submit} className="auth-form">{authView === 'register' && <><label htmlFor="name">Nom complet</label><input id="name" name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="Votre nom" required /></>}{(authView === 'login' || authView === 'register' || authView === 'forgot') && <><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="vous@exemple.com" required /></>}{(authView === 'login' || authView === 'register' || authView === 'reset') && <><label htmlFor="password">{authView === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}</label><input id="password" name="password" type="password" autoComplete={authView === 'login' ? 'current-password' : 'new-password'} minLength={authView === 'login' ? 1 : 10} placeholder={authView === 'login' ? 'Votre mot de passe' : '10 caractères minimum'} required />{authView !== 'login' && <><label htmlFor="password_confirmation">Confirmer le mot de passe</label><input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={10} placeholder="Confirmez le mot de passe" required /></>}</>}{message && <p className="form-message" role="status">{message}</p>}<button className="button button-gold auth-submit" disabled={busy}>{busy ? 'Veuillez patienter…' : authView === 'register' ? 'Créer le compte' : authView === 'login' ? 'Continuer' : authView === 'forgot' ? 'Envoyer le lien' : 'Mettre à jour le mot de passe'} <span>↗</span></button></form>}
        <div className="auth-switch">{authView === 'login' && <><button className="text-button" onClick={() => openAuth('forgot')}>Mot de passe oublié ?</button><p>Pas encore de compte ? <button onClick={() => openAuth('register')}>Créer un compte</button></p></>}{authView === 'register' && <p>Déjà membre ? <button onClick={() => openAuth('login')}>Se connecter</button></p>}{authView === 'forgot' && <p>Vous vous souvenez ? <button onClick={() => openAuth('login')}>Retour à la connexion</button></p>}{authView === 'reset' && <p><button onClick={() => openAuth('login')}>Retour à la connexion</button></p>}{authView === 'verify' && <p>Besoin d’aide ? <a href="mailto:contact@news-fx.com">Contacter l’assistance</a></p>}</div><p className="auth-privacy">Vos identifiants ne sont jamais partagés. Le code e-mail est aléatoire, temporaire et stocké sous forme hachée.</p>
      </section></div>}
    </div>
  )
}

export default App
