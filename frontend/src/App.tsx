import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { Portal } from './Portal'
import { detectLocale, localeLabels, locales, translate, type Locale } from './locales'

type User = { id: number; name: string; email: string; is_admin: boolean }
type Announcement = { first_name: string; last_name: string; comments: Partial<Record<'fr' | 'en' | 'es' | 'pt', string>> }
type Stats = { target_usd: number; raised_usd: number; founders_count: number; campaign_end_at: string | null; standard_duration_months: number; verified: boolean; status: string; announcement?: Announcement | null }
type AuthView = 'login' | 'register' | 'verify' | 'forgot' | 'reset'
type Page = 'home' | 'account' | 'payment' | 'admin'
type ApiResult = { message?: string; user?: User | null; requires_2fa?: boolean; csrf_token?: string; errors?: Record<string, string[]>; payment?: { id: number }; [key: string]: unknown }

const emptyStats: Stats = { target_usd: 100000, raised_usd: 0, founders_count: 0, campaign_end_at: null, standard_duration_months: 0, verified: false, status: 'preparation' }
function App() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [authView, setAuthView] = useState<AuthView | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [code, setCode] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = window.localStorage.getItem('newsfx-locale')
    return saved && locales.includes(saved as Locale) ? saved as Locale : detectLocale()
  })
  const [page, setPage] = useState<Page>(() => ({ '/account': 'account', '/payment': 'payment', '/admin': 'admin' }[window.location.pathname] as Page | undefined ?? 'home'))
  const csrf = useRef('')
  const pendingPage = useRef<Page | null>(null)
  const pendingOffer = useRef<string | null>(null)
  const t = (key: string) => translate(locale, key)

  useEffect(() => {
    document.documentElement.lang = page === 'admin' ? 'fr' : locale
    window.localStorage.setItem('newsfx-locale', locale)
  }, [locale, page])

  useEffect(() => {
    const syncPage = () => setPage(({ '/account': 'account', '/payment': 'payment', '/admin': 'admin' } as Record<string, Page>)[window.location.pathname] ?? 'home')
    window.addEventListener('popstate', syncPage)
    const params = new URLSearchParams(window.location.search)
    const googleState = params.get('auth')
    if (googleState === 'google_verify') {
      setAuthView('verify')
      setMessage('Connexion Google reconnue. Saisissez le code envoyé à votre adresse e-mail pour terminer la connexion.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (googleState?.startsWith('google_')) {
      const googleMessages: Record<string, string> = {
        google_unavailable: 'La connexion Google n’est pas encore configurée sur le serveur.',
        google_unverified: 'Google n’a pas confirmé cette adresse e-mail. Essayez une autre adresse.',
        google_account_conflict: 'Cette adresse est déjà reliée à un autre compte Google. Contactez l’assistance.',
        google_account_unavailable: 'Ce compte est suspendu. Contactez l’assistance.',
        google_failed: 'La connexion Google a échoué. Réessayez ou connectez-vous par e-mail.',
      }
      setMessage(googleMessages[googleState] ?? 'La connexion Google a échoué.')
      if (googleState !== 'google_unavailable') setAuthView('login')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (window.location.pathname === '/reset-password' && params.has('token')) {
      setAuthView('reset')
      setAuthEmail(params.get('email') ?? '')
    }

    void (async () => {
      try {
        const csrfResponse = await fetch('/api/csrf', { credentials: 'include' })
        csrf.current = ((await csrfResponse.json()) as ApiResult).csrf_token ?? ''
        const me = await fetch('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } })
        const currentUser = ((await me.json()) as ApiResult).user ?? null
        setUser(currentUser)
        if (!currentUser && window.location.pathname !== '/') {
          const wanted = ({ '/account': 'account', '/payment': 'payment', '/admin': 'admin' } as Record<string, Page>)[window.location.pathname] ?? 'home'
          pendingPage.current = wanted
          setAuthView('login')
          if (wanted !== 'admin') {
            window.history.replaceState({}, '', '/')
            setPage('home')
          }
        } else if (currentUser && window.location.pathname === '/admin' && !currentUser.is_admin) {
          window.history.replaceState({}, '', '/')
          setPage('home')
          setMessage('Cette adresse ne dispose pas de l’accès administrateur.')
        }
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
    return () => { observer.disconnect(); window.removeEventListener('popstate', syncPage) }
  }, [])

  useEffect(() => {
    if (page !== 'home') {
      setActiveSection('')
      return
    }

    const sectionObserver = new IntersectionObserver((entries) => {
      const visibleSections = entries.filter((entry) => entry.isIntersecting).sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)
      setActiveSection(visibleSections[0]?.target.id ?? '')
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 })
    document.querySelectorAll('#project, #objective, #offers, #faq').forEach((element) => sectionObserver.observe(element))
    return () => sectionObserver.disconnect()
  }, [page])

  async function request(url: string, payload?: Record<string, unknown>, method?: string): Promise<ApiResult> {
    if (!csrf.current) {
      const csrfResponse = await fetch('/api/csrf', { credentials: 'include', headers: { Accept: 'application/json' } })
      csrf.current = ((await csrfResponse.json()) as ApiResult).csrf_token ?? ''
    }

    const response = await fetch(url, {
      method: method ?? (payload ? 'POST' : 'GET'),
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

  function navigate(nextPage: Page, query = '', replace = false) {
    setPage(nextPage)
    const path = `${nextPage === 'home' ? '/' : `/${nextPage}`}${query}`
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setMobileMenu(false)
    if (nextPage === 'home') {
      void fetch('/api/public/stats', { headers: { Accept: 'application/json' } }).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setStats(data as Stats) })
    }
  }

  async function startCheckout(offer: string, justAuthenticated = false) {
    if (!user && !justAuthenticated) {
      pendingOffer.current = offer
      pendingPage.current = 'payment'
      openAuth('login')
      return
    }
    setBusy(true)
    try {
      const result = await request('/api/member/checkout', { offer })
      const payment = result.payment as { id: number }
      navigate('payment', `?id=${payment.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de préparer le paiement.')
    } finally { setBusy(false) }
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
        const verifiedUser = result.user ?? null
        setUser(verifiedUser)
        setAuthView(null)
        setCode('')
        setMessage('')
        if (pendingOffer.current) {
          const requestedOffer = pendingOffer.current
          pendingOffer.current = null
          await startCheckout(requestedOffer, true)
        } else {
          const destination = pendingPage.current ?? 'account'
          pendingPage.current = null
          navigate(destination)
        }
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
      csrf.current = ''
      setUser(null)
      navigate('home')
      setMessage('Vous êtes déconnecté.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La déconnexion a échoué.')
    } finally {
      setBusy(false)
    }
  }

  const progress = Math.max(0, Math.min(100, (stats.raised_usd / (stats.target_usd || 100000)) * 100))
  const announcementText = stats.announcement?.comments[locale as 'fr' | 'en' | 'es' | 'pt'] || stats.announcement?.comments.en
  const announcementLocale = stats.announcement?.comments[locale as 'fr' | 'en' | 'es' | 'pt'] ? locale : 'en'
  const scrollTo = (id: string) => {
    if (page !== 'home') navigate('home')
    if (['project', 'objective', 'offers', 'faq'].includes(id)) setActiveSection(id)
    setMobileMenu(false)
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 40)
  }

  return (
    <div className={page === 'admin' ? 'admin-isolated-shell' : 'site-shell'}>
      {page !== 'admin' && <><div className="ambient ambient-one" /><div className="ambient ambient-two" />
      {page === 'home' && stats.announcement && announcementText && <aside className="community-announcement" lang={announcementLocale} aria-label="Message de la communauté"><span className="announcement-mark" aria-hidden="true">✦</span><p><span className="announcement-message">{announcementText}</span><span className="announcement-author">{stats.announcement.first_name} {stats.announcement.last_name}</span></p></aside>}
      <header className="site-header">
        <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); scrollTo('top') }} aria-label="NEWS FX accueil"><img src="/news-fx-logo.jpeg" alt="NEWS FX — Informer, analyser, anticiper" /></a>
        <button className="menu-button" aria-label="Ouvrir le menu" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><span /><span /></button>
        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'} aria-label="Main navigation">
          <button className={activeSection === 'project' ? 'is-active' : ''} aria-current={activeSection === 'project' ? 'location' : undefined} onClick={() => scrollTo('project')}>{t('project')}</button><button className={activeSection === 'objective' ? 'is-active' : ''} aria-current={activeSection === 'objective' ? 'location' : undefined} onClick={() => scrollTo('objective')}>{t('objective')}</button><button className={activeSection === 'offers' ? 'is-active' : ''} aria-current={activeSection === 'offers' ? 'location' : undefined} onClick={() => scrollTo('offers')}>{t('offers')}</button><button className={activeSection === 'faq' ? 'is-active' : ''} aria-current={activeSection === 'faq' ? 'location' : undefined} onClick={() => scrollTo('faq')}>{t('faq')}</button>
        </nav>
        <div className="nav-actions"><label className="language-select"><span className="sr-only">Interface language</span><select aria-label="Interface language" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>{locales.map((language) => <option value={language} key={language}>{localeLabels[language]}</option>)}</select></label>{user ? <><button className="button button-quiet" onClick={() => navigate('account')}>My account</button>{user.is_admin && <button className="button button-quiet" onClick={() => navigate('admin')}>Admin</button>}</> : <button className="button button-quiet" onClick={() => { pendingPage.current = 'account'; openAuth('login') }}>{t('login')}</button>}<button className="button button-gold button-small" onClick={() => user ? navigate('account') : openAuth('register')}>{user ? 'Member area' : t('join')}<span aria-hidden="true">↗</span></button></div>
      </header></>}

      <main id="top" lang={page === 'admin' ? 'fr' : locale}>
        {page === 'home' ? <>
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> {t('prep')} <span className="eyebrow-divider" /> NEWS FX</div>
            <h1>{t('headline')}<br /><span>{t('headline2')}</span></h1>
            <p className="hero-lead">{t('lead')}</p>
            <div className="hero-actions"><button className="button button-gold button-large" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>{t('joinCta')} <span aria-hidden="true">↗</span></button><button className="button button-outline button-large" onClick={() => scrollTo('project')}><span className="play-icon">▶</span> {t('discover')}</button></div>
            <div className="hero-proof"><div className="proof-mark">✳</div><p><b>{t('proof')}</b><br /><span>{t('proof2')}</span></p></div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="signal-card glass-card">
              <div className="signal-top"><span className="signal-label"><span className="live-dot" /> {t('prep')}</span><span className="signal-time">NEWS FX</span></div>
              <img className="hero-logo" src="/news-fx-logo.jpeg" alt="Logo NEWS FX" />
              <div className="signal-rule" />
              <div className="signal-bottom"><div><span className="mini-label">{t('api')}</span><b>100 000 <small>USD*</small></b></div><div className="signal-orbit"><span>FX</span></div></div>
              <p className="signal-note">{t('estimate')}</p>
            </div>
            <div className="float-chip chip-top"><span className="chip-icon">◉</span><div><b>{t('sources')}</b><small>{t('authorized')}</small></div></div>
            <div className="float-chip chip-bottom"><span className="chip-icon gold-icon">↗</span><div><b>{t('context')}</b><small>{t('risk')}</small></div></div>
            <div className="hero-grid-lines" />
          </div>
        </section>

        <section className="trust-strip section-wrap" aria-label={t('principles')}><div><span>01</span><b>{t('transparent')}</b></div><i /><div><span>02</span><b>{t('analysis')}</b></div><i /><div><span>03</span><b>{t('noProfit')}</b></div></section>

        <section className="section-wrap project-section" id="project">
          <div className="section-heading reveal"><div><div className="eyebrow">{t('ambition')}</div><h2>{t('signal')}</h2></div><p>{t('desc')}</p></div>
          <div className="feature-grid">
            <article className="feature-card reveal"><span className="feature-number">01 / SOURCES</span><div className="feature-icon">⌁</div><h3>{t('sourcesTitle')}</h3><p>{t('sourcesBody')}</p></article>
            <article className="feature-card reveal delay-one"><span className="feature-number">02 / CONTEXTE</span><div className="feature-icon">◌</div><h3>{t('contextTitle')}</h3><p>{t('contextBody')}</p></article>
            <article className="feature-card reveal delay-two"><span className="feature-number">03 / COMMUNAUTÉ</span><div className="feature-icon">↗</div><h3>{t('memberTitle')}</h3><p>{t('memberBody')}</p></article>
          </div>
        </section>

        <section className="section-wrap regions-section"><div className="section-heading reveal"><div><div className="eyebrow">{t('regions')}</div><h2>{t('regionsTitle')}</h2></div><p>{t('regionsDesc')}</p></div><div className="regions-grid">{(['asia', 'europe', 'americas', 'mena', 'global'] as const).map((region, index) => <article className="region-card reveal" key={region}><span className="region-index">0{index + 1}</span><span className="region-globe" aria-hidden="true">{['◉', '◎', '◌', '◍', '✳'][index]}</span><h3>{t(region)}</h3><p>{t('regionDetail')}</p></article>)}</div></section>

        <section className="objective-section" id="objective"><div className="section-wrap objective-grid">
          <div className="objective-copy reveal"><div className="eyebrow">{t('step')}</div><h2>{t('prepare')}<br /><span>{t('trust')}</span></h2><p>{t('objectiveBody')}</p><div className="objective-footnote"><span>↗</span> {t('adminCampaign')}</div></div>
          <div className="progress-card glass-card reveal delay-one"><div className="progress-head"><div><span className="mini-label">{t('verified')}</span><h3>{t('goalStatus')}</h3></div><span className="status-pill"><span className="live-dot" /> {t(({ preparation: 'preparation', open: 'open', paused: 'paused', closed: 'closed' } as Record<string, string>)[stats.status] ?? stats.status.toUpperCase())}</span></div><div className="progress-values"><strong>{new Intl.NumberFormat(locale).format(stats.raised_usd)} <small>USD</small></strong><span>{t('raised')} {new Intl.NumberFormat(locale).format(stats.target_usd)} USD</span></div><div className="progress-track" role="progressbar" aria-label={t('goalStatus')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><div className="progress-meta"><span>{progress.toLocaleString(locale, { maximumFractionDigits: 1 })} % {t('goal')}</span><span>{stats.founders_count} {t('founders')}</span></div><div className="progress-divider" /><div className="countdown-row"><div><span className="mini-label">{t('campaignEnd')}</span><b>{stats.campaign_end_at ? new Date(stats.campaign_end_at).toLocaleDateString(locale) : t('dateTbd')}</b></div><span className="calendar-icon">▦</span></div><p className="progress-disclaimer">{t('verifiedOnly')}</p></div>
        </div></section>

        <section className="section-wrap referral-section"><div className="referral-panel reveal"><div className="referral-copy"><div className="eyebrow">{t('referralEyebrow')}</div><h2>{t('referralTitle')}<br /><span>{t('referralTitle2')}</span></h2><p>{t('referralBody')}</p><button className="button button-outline" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>{t('referralCta')} <span>↗</span></button></div><div className="referral-board"><div className="board-head"><span>{t('leaderboard')}</span><span>{t('comingSoon')}</span></div><div className="board-empty"><div className="board-circles"><span>✳</span><span>✳</span><span>✳</span></div><b>{t('firstMembers')}</b><p>{t('leaderboardBody')}</p></div><div className="board-footer"><span>{t('rewardsOff')}</span><span>•••</span></div></div></div></section>

        <section className="section-wrap offers-section" id="offers"><div className="section-heading reveal"><div><div className="eyebrow">{t('offersEyebrow')}</div><h2>{t('offersTitle')}</h2></div><p>{t('offerIntro')}</p></div><div className="offer-grid">
          <article className="offer-card offer-featured reveal"><div className="offer-top"><span className="offer-label">{t('launchOffer')}</span><span className="offer-spark">✳</span></div><h3>{t('founderMember')}</h3><p>{t('founderOfferBody')}</p><div className="offer-price">100 <small>USD</small></div><div className="offer-period">{t('plannedPeriod')}</div><div className="offer-line" /><ul><li>{t('privateAlerts')}</li><li>{t('paymentActivation')}</li><li>{t('usdtOnly')}</li></ul><button className="button button-gold offer-button" onClick={() => void startCheckout('founder')}>{t('chooseOffer')} <span>↗</span></button></article>
          <article className="offer-card reveal delay-one"><div className="offer-top"><span className="offer-label">{t('standardOffer')}</span><span className="offer-spark muted-spark">◌</span></div><h3>{t('standardMember')}</h3><p>{t('standardOfferBody')}</p><div className="offer-price">1 000 <small>USD</small></div><div className="offer-period">{t('plannedDuration')} {stats.standard_duration_months || t('toDefine')}</div><div className="offer-line" /><ul><li>{t('privateAnalysis')}</li><li>{t('secureCommunity')}</li><li>{t('usdtOnly')}</li></ul><button className="button button-outline offer-button" onClick={() => void startCheckout('standard')}>{t('chooseOffer')} <span>↗</span></button></article>
        </div></section>

        <section className="section-wrap process-section"><div className="section-heading reveal"><div><div className="eyebrow">{t('howItWorks')}</div><h2>{t('simpleClear')}</h2></div></div><div className="process-list"><div className="process-item reveal"><span>01</span><div><h3>{t('supplierTitle')}</h3><p>{t('supplierBody')}</p></div><i>↘</i></div><div className="process-item reveal"><span>02</span><div><h3>{t('infoTitle')}</h3><p>{t('infoBody')}</p></div><i>↘</i></div><div className="process-item reveal"><span>03</span><div><h3>{t('deliveryTitle')}</h3><p>{t('deliveryBody')}</p></div><i>↗</i></div></div><div className="notice-card reveal"><span className="notice-mark">i</span><p><b>{t('noticeTitle')}</b> {t('noticeBody')}</p></div></section>

        <section className="section-wrap faq-section" id="faq"><div className="section-heading reveal"><div><div className="eyebrow">{t('faqTitle')}</div><h2>{t('faqHeading')}</h2></div></div><div className="faq-list"><details className="faq-item reveal"><summary>{t('faqReady')}<span>＋</span></summary><p>{t('faqReadyBody')}</p></details><details className="faq-item reveal"><summary>{t('faqVerified')}<span>＋</span></summary><p>{t('faqVerifiedBody')}</p></details><details className="faq-item reveal"><summary>{t('faqPay')}<span>＋</span></summary><p>{t('faqPayBody')}</p></details><details className="faq-item reveal"><summary>{t('faqAdvice')}<span>＋</span></summary><p>{t('faqAdviceBody')}</p></details><details className="faq-item reveal"><summary>{t('faqAccess')}<span>＋</span></summary><p>{t('faqAccessBody')}</p></details></div></section>

        <section className="final-cta section-wrap"><div className="cta-inner reveal"><img src="/news-fx-logo.jpeg" alt="" /><div><div className="eyebrow">{t('finalEyebrow')}</div><h2>{t('finalTitle')}</h2><p>{t('finalBody')}</p></div><button className="button button-gold button-large" onClick={() => user ? scrollTo('member-space') : openAuth('register')}>{t('createAccount')} <span>↗</span></button></div></section>

        {user && <section className="section-wrap member-section" id="member-space"><div className="member-card glass-card"><div><div className="eyebrow">{t('personalArea')}</div><h2>{t('hello')} {user.name.split(' ')[0]}.</h2><p>{t('connectedWith')} {user.email}. {t('verifiedSession')}</p><div className="member-status"><span className="live-dot" /> {t('verifiedAccount')}</div><p className="member-note">{t('memberNote')}</p></div><button className="button button-outline" onClick={() => navigate('account')}>{t('openAccount')}</button></div></section>}
        </> : <Portal page={page} request={request} navigate={(destination, query) => navigate(destination, query)} userName={user?.name ?? ''} logout={() => void logout()} locale={locale} />}
      </main>

      {page !== 'admin' && <footer className="site-footer"><div className="footer-top section-wrap"><a className="footer-logo" href="#top" onClick={(event) => { event.preventDefault(); navigate('home') }}><img src="/news-fx-logo.jpeg" alt="NEWS FX" /></a><p>NEWS FX<br /><span>{t('footerClaim')}</span></p><div className="footer-links"><button onClick={() => scrollTo('project')}>{t('about')}</button><button onClick={() => scrollTo('faq')}>FAQ</button><a href="mailto:contact@news-fx.com">Contact</a><button onClick={() => user ? navigate('account') : (pendingPage.current = 'account', openAuth('login'))}>{t('memberArea')}</button></div></div><div className="footer-bottom section-wrap"><span>© {new Date().getFullYear()} NEWS FX · {t('rights')}</span><span>{t('generalInfo')}</span><button onClick={() => setMessage(t('legal'))}>{t('legal')}</button></div></footer>}

      {message && !authView && <div className="toast" role="status">{message}<button aria-label={t('close')} onClick={() => setMessage('')}>×</button></div>}

      {authView && <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && authView !== 'verify') setAuthView(null) }}><section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={() => { setAuthView(null); setMessage('') }} aria-label={t('close')}>×</button><div className="auth-brand"><img src="/news-fx-logo.jpeg" alt="NEWS FX" /></div><div className="eyebrow">{t('authSecurity')}</div><h2 id="auth-title">{t(({ register: 'registerTitle', login: 'loginTitle', verify: 'verifyTitle', forgot: 'forgotTitle', reset: 'resetTitle' } as Record<AuthView, string>)[authView])}</h2><p className="auth-intro">{t(({ register: 'registerIntro', login: 'loginIntro', verify: 'verifyIntro', forgot: 'forgotIntro', reset: 'resetIntro' } as Record<AuthView, string>)[authView])}</p>
        {(authView === 'login' || authView === 'register') && <a className="google-auth-button" href="/auth/google"><span aria-hidden="true">G</span> {t('googleContinue')}</a>}
        {authView === 'verify' ? <form onSubmit={submit} className="auth-form"><label htmlFor="verification-code">{t('emailCode')}</label><input id="verification-code" className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" required /><p className="field-hint">{t('codeHint')}</p>{message && <p className="form-message" role="status">{message}</p>}<button className="button button-gold auth-submit" disabled={busy || code.length !== 6}>{busy ? t('wait') : t('verifyButton')} <span>↗</span></button><button className="text-button" type="button" onClick={() => void resendCode()} disabled={busy}>{t('resendCode')}</button></form> : <form onSubmit={submit} className="auth-form">{authView === 'register' && <><label htmlFor="name">{t('fullName')}</label><input id="name" name="name" autoComplete="name" minLength={2} maxLength={100} placeholder={t('yourName')} required /></>}{(authView === 'login' || authView === 'register' || authView === 'forgot') && <><label htmlFor="email">{t('email')}</label><input id="email" name="email" type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" required /></>}{(authView === 'login' || authView === 'register' || authView === 'reset') && <><label htmlFor="password">{authView === 'reset' ? t('newPassword') : t('password')}</label><input id="password" name="password" type="password" autoComplete={authView === 'login' ? 'current-password' : 'new-password'} minLength={authView === 'login' ? 1 : 10} placeholder={authView === 'login' ? t('yourPassword') : t('minPassword')} required />{authView !== 'login' && <><label htmlFor="password_confirmation">{t('confirmPassword')}</label><input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={10} placeholder={t('confirmPassword')} required /></>}</>}{message && <p className="form-message" role="status">{message}</p>}<button className="button button-gold auth-submit" disabled={busy}>{busy ? t('wait') : t(({ register: 'createAccountButton', login: 'continue', forgot: 'sendLink', reset: 'updatePassword' } as Partial<Record<AuthView, string>>)[authView] ?? 'continue')} <span>↗</span></button></form>}
        <div className="auth-switch">{authView === 'login' && <><button className="text-button" onClick={() => openAuth('forgot')}>{t('forgotTitle')}</button><p>{t('noAccount')} <button onClick={() => openAuth('register')}>{t('createOne')}</button></p></>}{authView === 'register' && <p>{t('alreadyMember')} <button onClick={() => openAuth('login')}>{t('signIn')}</button></p>}{authView === 'forgot' && <p>{t('remember')} <button onClick={() => openAuth('login')}>{t('backToLogin')}</button></p>}{authView === 'reset' && <p><button onClick={() => openAuth('login')}>{t('backToLogin')}</button></p>}{authView === 'verify' && <p>{t('needHelp')} <a href="mailto:contact@news-fx.com">{t('contactSupport')}</a></p>}</div><p className="auth-privacy">{t('privacyNote')}</p>
      </section></div>}
    </div>
  )
}

export default App
