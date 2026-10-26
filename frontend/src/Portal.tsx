import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { translate, type Locale } from './locales'

type PortalPage = 'account' | 'payment' | 'admin'
type Member = { user: { name: string; email: string }; payments: Payment[]; channels: { discord: boolean; telegram: boolean } }
type Payment = { id: number; offer: string; amount_usd: number; network: string; status: string; transaction_id: string | null; created_at: string; expires_at?: string | null }
type AdminUser = { id: number; name: string; email: string; email_verified_at: string | null; is_active: boolean; created_at: string }
type AdminData = { settings: Settings; payments: Array<Payment & { user: { name: string; email: string } }>; users: AdminUser[]; events: Array<{ id: number; event_type: string; ip_address: string; country: string | null; region: string | null; city: string | null; path: string; created_at: string; user?: { name: string; email: string } | null }>; counts: { users: number; verified_users: number; visitors: number; login_failures: number } }
type Settings = { target_usd: number; campaign_end_at: string; campaign_status: string; standard_duration_months: number; discord_enabled: boolean; discord_invite_url: string; telegram_enabled: boolean; telegram_invite_url: string; announcement_enabled: boolean; announcement_first_name: string; announcement_last_name: string; announcement_fr: string; announcement_en: string; announcement_es: string; announcement_pt: string }
type PaymentOrder = { id: number; offer: string; amount_usd: number; status: string; transaction_id?: string | null }
type Request = (url: string, payload?: Record<string, unknown>, method?: string) => Promise<Record<string, any>>

type Props = { page: PortalPage; request: Request; navigate: (page: 'home' | PortalPage, query?: string) => void; userName: string; logout: () => void; locale: Locale }

const defaultSettings: Settings = { target_usd: 100000, campaign_end_at: '', campaign_status: 'preparation', standard_duration_months: 0, discord_enabled: false, discord_invite_url: '', telegram_enabled: false, telegram_invite_url: '', announcement_enabled: false, announcement_first_name: '', announcement_last_name: '', announcement_fr: '', announcement_en: '', announcement_es: '', announcement_pt: '' }
const statusLabel: Record<string, string> = { awaiting_payment: 'En attente du versement', submitted: 'Transaction à vérifier', approved: 'Paiement confirmé', expired: 'Accès expiré', rejected: 'Paiement refusé' }

export function Portal({ page, request, navigate, userName, logout, locale }: Props) {
  const t = (key: string) => translate(locale, key)
  const paymentStatus = (status: string) => t(({ awaiting_payment: 'awaitingPayment', submitted: 'submitted', approved: 'approved', expired: 'expired', rejected: 'rejected' } as Record<string, string>)[status] ?? status)
  const [member, setMember] = useState<Member | null>(null)
  const [order, setOrder] = useState<Record<string, any> | null>(null)
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [transactionId, setTransactionId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userLastPage, setUserLastPage] = useState(1)
  const paymentId = new URLSearchParams(window.location.search).get('id')

  async function loadAdmin() {
    const data = await request('/api/admin/dashboard') as unknown as AdminData
    const users = await request('/api/admin/users') as unknown as { data: AdminUser[]; current_page: number; last_page: number }
    setAdmin({ ...data, users: users.data })
    setUserPage(users.current_page)
    setUserLastPage(users.last_page)
    setSettings({ ...defaultSettings, ...data.settings })
  }

  async function searchUsers(event?: FormEvent<HTMLFormElement>, page = 1) {
    event?.preventDefault()
    setBusy(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (userSearch.trim()) params.set('q', userSearch.trim())
      const result = await request(`/api/admin/users?${params.toString()}`) as unknown as { data: AdminUser[]; current_page: number; last_page: number }
      setAdmin((current) => current ? { ...current, users: result.data } : current)
      setUserPage(result.current_page)
      setUserLastPage(result.last_page)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'La recherche des comptes a échoué.') } finally { setBusy(false) }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>, item: AdminUser) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await request(`/api/admin/users/${item.id}`, { name: String(form.get('name') ?? '').trim(), email: String(form.get('email') ?? '').trim(), is_active: form.get('is_active') === 'on', email_verified: form.get('email_verified') === 'on' }, 'PATCH')
      setNotice(String(result.message ?? 'Compte mis à jour.'))
      await loadAdmin()
      if (userSearch.trim()) await searchUsers(undefined, userPage)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Le compte n’a pas été modifié.') } finally { setBusy(false) }
  }

  async function sendPasswordReset(id: number) {
    setBusy(true)
    try {
      const result = await request(`/api/admin/users/${id}/reset-password`, {}, 'POST')
      setNotice(String(result.message ?? 'Lien envoyé.'))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Le lien n’a pas été envoyé.') } finally { setBusy(false) }
  }

  useEffect(() => {
    let active = true
    if (page === 'account') {
      void request('/api/member').then((data) => { if (active) setMember(data as unknown as Member) }).catch((error) => setNotice(error instanceof Error ? error.message : 'Impossible de charger votre espace.'))
    }
    if (page === 'payment' && paymentId) {
      let polling: number | undefined
      const refreshPayment = () => request(`/api/member/payments/${paymentId}`).then((data) => {
        if (!active) return
        setOrder(data)
        if ((data.payment as PaymentOrder | undefined)?.status === 'submitted' && polling === undefined) {
          polling = window.setInterval(() => { void refreshPayment().catch((error) => { if (active) setNotice(error instanceof Error ? error.message : 'La session a expiré. Reconnectez-vous pour consulter le paiement.'); if (polling !== undefined) window.clearInterval(polling) }) }, 8000)
        } else if ((data.payment as PaymentOrder | undefined)?.status !== 'submitted' && polling !== undefined) {
          window.clearInterval(polling)
          polling = undefined
        }
      })
      void refreshPayment().catch((error) => setNotice(error instanceof Error ? error.message : 'Cette commande n’est pas accessible.'))
      return () => { active = false; if (polling !== undefined) window.clearInterval(polling) }
    }
    if (page === 'admin') void loadAdmin().catch((error) => setNotice(error instanceof Error ? error.message : 'Accès administrateur indisponible.'))
    return () => { active = false }
  }, [page, paymentId])

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!paymentId) return
    setBusy(true)
    try {
      const result = await request(`/api/member/payments/${paymentId}/submit`, { transaction_id: transactionId })
      setNotice(String(result.message ?? 'Transaction transmise.'))
      const updated = await request(`/api/member/payments/${paymentId}`)
      setOrder(updated)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Envoi impossible.') } finally { setBusy(false) }
  }

  async function reviewPayment(id: number, decision: 'approved' | 'rejected') {
    setBusy(true)
    try {
      const result = await request(`/api/admin/payments/${id}/review`, { decision })
      setNotice(String(result.message ?? 'Décision enregistrée.'))
      await loadAdmin()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'La décision n’a pas été enregistrée.') } finally { setBusy(false) }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await request('/api/admin/settings', settings as unknown as Record<string, unknown>, 'PUT')
      setNotice(String(result.message ?? 'Paramètres enregistrés.'))
      await loadAdmin()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Les paramètres n’ont pas été enregistrés.') } finally { setBusy(false) }
  }

  async function geolocate(id: number) {
    setBusy(true)
    try {
      await request(`/api/admin/events/${id}/geolocate`, {}, 'POST')
      await loadAdmin()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Localisation indisponible.') } finally { setBusy(false) }
  }

  return <section className="portal section-wrap">
    <div className="portal-heading"><div><div className="eyebrow">{page === 'admin' ? 'ADMINISTRATION PRIVÉE' : page === 'payment' ? t('securePayment') : t('accountHeading')}</div><h1>{page === 'admin' ? 'Tableau de bord' : page === 'payment' ? t('payUsdt') : `${t('hello')} ${userName.split(' ')[0]}.`}</h1><p>{page === 'admin' ? 'Espace réservé à l’adresse administrateur configurée. Les sessions privées des membres ne sont pas accessibles ici.' : page === 'payment' ? t('paymentIntro') : t('accountIntro')}</p></div><div className="portal-actions">{page !== 'admin' && <button className="button button-outline" onClick={() => navigate('home')}>{t('home')}</button>}<button className="button button-outline" onClick={logout}>{page === 'admin' ? 'Se déconnecter' : t('logout')}</button></div></div>
    {notice && <p className="portal-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></p>}

    {page === 'account' && <div className="portal-grid">
      <article className="portal-card"><span className="mini-label">{t('accountVerified')}</span><h2>{member?.user.name ?? userName}</h2><p>{member?.user.email ?? t('loading')}</p><div className="member-status"><span className="live-dot" /> {t('sessionAuth')}</div><p className="portal-muted">{t('sessionInfo')}</p></article>
      <article className="portal-card"><span className="mini-label">{t('orders')}</span><h2>{t('paymentHistory')}</h2>{member?.payments.length ? member.payments.map((payment) => <div className="portal-row" key={payment.id}><div><b>{payment.offer} · {payment.amount_usd.toLocaleString(locale)} USD</b><small>{paymentStatus(payment.status)} · {payment.network}{payment.expires_at ? ` · ${t('accessUntil')} ${new Date(payment.expires_at).toLocaleDateString(locale)}` : ''}</small></div>{payment.status === 'awaiting_payment' && <button className="text-button" onClick={() => navigate('payment', `?id=${payment.id}`)}>{t('continuePayment')}</button>}</div>) : <p className="portal-muted">{t('noPayments')}</p>}</article>
      <article className="portal-card portal-wide"><span className="mini-label">{t('community')}</span><h2>{t('channels')}</h2>{member?.channels.discord || member?.channels.telegram ? <div className="community-actions">{member.channels.discord && <a className="button button-gold" href="/api/member/community/discord">◉ {t('joinDiscord')}</a>}{member.channels.telegram && <a className="button button-outline" href="/api/member/community/telegram">➤ {t('joinTelegram')}</a>}</div> : <p className="portal-muted">{t('invitePending')}</p>}</article>
    </div>}

    {page === 'payment' && (order?.payment?.status === 'approved' ? <article className="portal-card payment-success"><div className="crypto-loader success-loader"><span>₮</span></div><div className="eyebrow">{t('paymentVerified')}</div><h2>{t('welcome')}</h2><p>{t('paidBody')}</p><div className="community-actions">{order.channels?.discord && <a className="button button-gold" href="/api/member/community/discord">◉ {t('joinDiscord')}</a>}{order.channels?.telegram && <a className="button button-outline" href="/api/member/community/telegram">➤ {t('joinTelegram')}</a>}{!order.channels?.discord && !order.channels?.telegram && <p className="portal-muted">{t('noInvites')}</p>}</div><button className="text-button" onClick={() => navigate('account')}>{t('openPersonal')}</button></article> : <div className="portal-grid"><article className="portal-card payment-card"><span className="mini-label">{order?.network ?? 'USDT · TRC20'}</span><h2>{order?.payment?.offer ?? t('order')}</h2><p className="payment-total">{order?.payment?.amount_usd?.toLocaleString(locale) ?? '—'} <small>USDT</small></p><div className="network-alert"><b>{t('requiredNetwork')}</b><br />{t('networkWarning')}</div><img className="payment-qr" src={order?.qr ?? '/payment-qr.jpeg'} alt={t('qrAlt')}/><label className="mini-label" htmlFor="wallet-address">{t('receivingAddress')}</label><div className="wallet-address"><code id="wallet-address">{order?.address ?? t('loadingAddress')}</code><button className="button button-outline" onClick={() => order?.address && void navigator.clipboard.writeText(order.address)}>{t('copy')}</button></div><p className="portal-muted">{t('addressCheck')}</p><p className="portal-muted">{t('qrCheck')}</p></article><article className="portal-card"><span className="mini-label">{t('confirmation')}</span><h2>{order?.payment?.status ? paymentStatus(order.payment.status) : t('loading')}</h2>{order?.payment?.status === 'awaiting_payment' ? <form className="portal-form" onSubmit={submitTransaction}><label htmlFor="tx-id">{t('txidLabel')}</label><input id="tx-id" value={transactionId} onChange={(event) => setTransactionId(event.target.value.trim())} minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" placeholder={t('txidPlaceholder')} required/><p className="portal-muted">{t('txidHint')}</p><button className="button button-gold" disabled={busy || transactionId.length !== 64}>{busy ? t('transmitting') : t('submitPayment')}</button></form> : <>{order?.payment?.status === 'submitted' && <><div className="crypto-loader"><span>₮</span></div><p className="portal-muted">{t('received')}</p></>}<p className="portal-muted">{order?.payment?.status === 'submitted' ? t('doNotPayAgain') : t('requestStatus')}</p></>}{order?.payment?.transaction_id && <p className="portal-muted">TXID : <code>{order.payment.transaction_id}</code></p>}</article></div>)}

    {page === 'admin' && <>{admin ? <>
      <div className="admin-metrics">{[['Comptes', admin.counts.users], ['E-mails vérifiés', admin.counts.verified_users], ['Visites enregistrées', admin.counts.visitors], ['Échecs de connexion', admin.counts.login_failures]].map(([label, value]) => <article className="portal-card" key={label}><span className="mini-label">{label}</span><strong>{value}</strong></article>)}</div>
      <form className="portal-card admin-settings" onSubmit={saveSettings}><span className="mini-label">CAMPAGNE ET ACCÈS COMMUNAUTAIRES</span><h2>Paramètres publics</h2><div className="admin-form-grid"><label>Objectif USD<input type="number" min="1" value={settings.target_usd} onChange={(event) => setSettings({ ...settings, target_usd: Number(event.target.value) })}/></label><label>Fin de campagne<input type="date" value={settings.campaign_end_at?.slice(0, 10) ?? ''} onChange={(event) => setSettings({ ...settings, campaign_end_at: event.target.value })}/></label><label>État de campagne<select value={settings.campaign_status} onChange={(event) => setSettings({ ...settings, campaign_status: event.target.value })}><option value="preparation">Préparation</option><option value="open">Ouverte</option><option value="paused">En pause</option><option value="closed">Terminée</option></select></label><label>Durée de l’offre standard (mois)<input type="number" min="1" max="60" required value={settings.standard_duration_months || ''} onChange={(event) => setSettings({ ...settings, standard_duration_months: Number(event.target.value) })}/></label><fieldset><legend>Discord</legend><label className="check-label"><input type="checkbox" checked={settings.discord_enabled} onChange={(event) => setSettings({ ...settings, discord_enabled: event.target.checked })}/> Activer l’invitation après paiement validé</label><input type="url" placeholder="https://discord.gg/…" value={settings.discord_invite_url} onChange={(event) => setSettings({ ...settings, discord_invite_url: event.target.value })}/></fieldset><fieldset><legend>Telegram</legend><label className="check-label"><input type="checkbox" checked={settings.telegram_enabled} onChange={(event) => setSettings({ ...settings, telegram_enabled: event.target.checked })}/> Activer l’invitation après paiement validé</label><input type="url" placeholder="https://t.me/…" value={settings.telegram_invite_url} onChange={(event) => setSettings({ ...settings, telegram_invite_url: event.target.value })}/></fieldset></div><button className="button button-gold" disabled={busy}>Enregistrer les paramètres</button></form>
      <form className="portal-card admin-settings" onSubmit={saveSettings}><span className="mini-label">MESSAGE À LA UNE · ACCUEIL</span><h2>Message de la communauté</h2><p className="portal-muted">Affiché au-dessus de l’en-tête du site. Les visiteurs voient la traduction correspondant à la langue préférée de leur navigateur. Les champs traduits acceptent les emojis.</p><div className="admin-form-grid"><label>Prénom<input maxLength={80} value={settings.announcement_first_name} onChange={(event) => setSettings({ ...settings, announcement_first_name: event.target.value })}/></label><label>Nom<input maxLength={80} value={settings.announcement_last_name} onChange={(event) => setSettings({ ...settings, announcement_last_name: event.target.value })}/></label><label className="announcement-comment">Commentaire — Français<textarea maxLength={500} rows={3} value={settings.announcement_fr} onChange={(event) => setSettings({ ...settings, announcement_fr: event.target.value })}/></label><label className="announcement-comment">Comment — English<textarea maxLength={500} rows={3} value={settings.announcement_en} onChange={(event) => setSettings({ ...settings, announcement_en: event.target.value })}/></label><label className="announcement-comment">Comentario — Español<textarea maxLength={500} rows={3} value={settings.announcement_es} onChange={(event) => setSettings({ ...settings, announcement_es: event.target.value })}/></label><label className="announcement-comment">Comentário — Português<textarea maxLength={500} rows={3} value={settings.announcement_pt} onChange={(event) => setSettings({ ...settings, announcement_pt: event.target.value })}/></label></div><label className="announcement-toggle"><input type="checkbox" checked={settings.announcement_enabled} onChange={(event) => setSettings({ ...settings, announcement_enabled: event.target.checked })}/> Publier ce message sur la page d’accueil</label><button className="button button-gold" disabled={busy}>Enregistrer le message</button></form>
      <article className="portal-card"><span className="mini-label">PAIEMENTS EN ATTENTE</span><h2>Vérification manuelle</h2><p className="portal-muted">Avant validation, vérifiez dans Tronscan que le TXID est confirmé, que le jeton est bien l’USDT TRC20, que le montant est exact et que le destinataire est l’adresse NEWS FX.</p>{admin.payments.filter((payment) => payment.status === 'submitted').length ? admin.payments.filter((payment) => payment.status === 'submitted').map((payment) => <div className="portal-row admin-payment" key={payment.id}><div><b>{payment.user.name} · {payment.user.email}</b><small>{payment.offer} · {payment.amount_usd} USD · {payment.network}</small><a href={`https://tronscan.org/#/transaction/${payment.transaction_id}`} target="_blank" rel="noreferrer">Ouvrir la transaction sur Tronscan ↗</a><code>{payment.transaction_id}</code></div><button className="button button-gold" disabled={busy} onClick={() => window.confirm('Confirmer uniquement après avoir vérifié la transaction, le jeton USDT TRC20, le montant et l’adresse destinataire.') && void reviewPayment(payment.id, 'approved')}>Valider</button><button className="button button-outline" disabled={busy} onClick={() => window.confirm('Refuser cette transaction ?') && void reviewPayment(payment.id, 'rejected')}>Refuser</button></div>) : <p className="portal-muted">Aucune transaction soumise à vérifier.</p>}</article>
      <article className="portal-card admin-users"><span className="mini-label">COMPTES</span><h2>Gestion des utilisateurs</h2><p className="portal-muted">Modifiez le profil, la vérification e-mail et l’accès au compte. Les réinitialisations de mot de passe sont envoyées au titulaire.</p><form className="user-search" onSubmit={(event) => void searchUsers(event)}><input aria-label="Rechercher un compte" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nom ou adresse e-mail"/><button className="button button-outline" disabled={busy}>Rechercher</button></form><div className="admin-table">{admin.users.map((item) => <details className="admin-user-item" key={item.id}><summary><span><b>{item.name}</b><small>{item.email} · {item.is_active ? 'Actif' : 'Suspendu'} · {item.email_verified_at ? 'E-mail vérifié' : 'Non vérifié'}</small></span><time>{new Date(item.created_at).toLocaleDateString('fr-FR')}</time></summary><form className="admin-user-form" onSubmit={(event) => void saveUser(event, item)}><label>Nom complet<input name="name" defaultValue={item.name} minLength={2} maxLength={100} required/></label><label>E-mail<input name="email" type="email" defaultValue={item.email} maxLength={254} required/></label><label className="check-label"><input name="is_active" type="checkbox" defaultChecked={item.is_active}/> Compte actif</label><label className="check-label"><input name="email_verified" type="checkbox" defaultChecked={Boolean(item.email_verified_at)}/> E-mail vérifié</label><div className="user-actions"><button className="button button-gold" disabled={busy}>Enregistrer</button><button type="button" className="button button-outline" disabled={busy} onClick={() => void sendPasswordReset(item.id)}>Envoyer un lien de réinitialisation</button></div></form></details>)}</div><div className="user-pagination"><button className="button button-outline" disabled={busy || userPage <= 1} onClick={() => void searchUsers(undefined, userPage - 1)}>Précédent</button><span>Page {userPage} sur {userLastPage}</span><button className="button button-outline" disabled={busy || userPage >= userLastPage} onClick={() => void searchUsers(undefined, userPage + 1)}>Suivant</button></div></article>
      <article className="portal-card"><span className="mini-label">JOURNAL DE SÉCURITÉ ET VISITES</span><h2>Événements récents</h2><p className="portal-muted">Une demande de géolocalisation transmet l’adresse IP affichée au service tiers ipwho.is en HTTPS. Elle ne part qu’au clic de l’administrateur.</p><div className="admin-table">{admin.events.map((event) => <div className="portal-row admin-event" key={event.id}><div><b>{event.event_type}</b><small>{event.user?.email ?? 'Visiteur'} · {event.path} · {new Date(event.created_at).toLocaleString('fr-FR')}</small><small>IP {event.ip_address || 'inconnue'} · {[event.city, event.region, event.country].filter(Boolean).join(', ') || 'zone non résolue'}</small></div>{event.ip_address && !event.country && <button className="text-button" disabled={busy} onClick={() => void geolocate(event.id)}>Géolocaliser</button>}</div>)}</div></article>
    </> : <article className="portal-card"><div className="crypto-loader" aria-label="Chargement"><span>₮</span></div><p>Chargement du tableau de bord…</p></article>}</>}
  </section>
}
