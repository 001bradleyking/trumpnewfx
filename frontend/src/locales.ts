export const locales = ['en', 'fr', 'es', 'pt', 'zh', 'ja'] as const
export type Locale = typeof locales[number]

export const localeLabels: Record<Locale, string> = {
  en: 'English', fr: 'Français', es: 'Español', pt: 'Português', zh: '中文', ja: '日本語',
}

const copy: Record<Locale, Record<string, string>> = {
  en: {
    project: 'Project', objective: 'Objective', offers: 'Offers', faq: 'FAQ', login: 'Sign in', join: 'Become a founder',
    prep: 'IN PREPARATION', headline: 'Information that brings clarity.', headline2: 'Context that matters.',
    lead: 'A structured watch on political and economic announcements, with sources, timestamps and measured analysis. Built for traders who want to better understand the news.',
    joinCta: 'Join the founders', discover: 'Discover the project', proof: 'Transparency comes first.', proof2: 'No promises of returns. Sources and context.',
    api: 'API ACCESS GOAL', estimate: '*Working estimate to be confirmed with the provider.', sources: 'Sources identified', authorized: 'When permitted', context: 'Context, not certainty', risk: 'General information · markets carry risk',
    principles: 'Project principles', transparent: 'Transparent sources', analysis: 'Analysis with context', noProfit: 'No profit promises',
    ambition: 'OUR AMBITION', signal: 'From signal to understanding.', desc: 'NEWS FX is building a financial information service that clearly distinguishes facts, sources and interpretations.',
    regions: 'MARKET COVERAGE', regionsTitle: 'A global view for traders.', regionsDesc: 'Follow market context across major time zones. Regional coverage is organized by market area; availability depends on verified sources.',
    asia: 'Asia-Pacific', europe: 'Europe', americas: 'Americas', mena: 'Middle East & Africa', global: 'Global markets', regionDetail: 'Regional market context',
  },
  fr: {
    project: 'Le projet', objective: 'Objectif', offers: 'Offres', faq: 'FAQ', login: 'Connexion', join: 'Devenir fondateur',
    prep: 'EN PRÉPARATION', headline: 'L’information qui éclaire.', headline2: 'Le contexte qui compte.',
    lead: 'Une veille structurée sur les annonces politiques et économiques, avec sources, horodatages et analyses mesurées. Pensée pour les traders qui veulent mieux comprendre l’actualité.',
    joinCta: 'Rejoindre les fondateurs', discover: 'Découvrir le projet', proof: 'La transparence avant tout.', proof2: 'Pas de promesse de gains. Des sources et du contexte.',
    api: 'OBJECTIF D’ACCÈS API', estimate: '*Estimation de travail à confirmer auprès du fournisseur.', sources: 'Sources identifiées', authorized: 'Quand elles sont autorisées', context: 'Du contexte, pas des certitudes', risk: 'Information générale · marché à risque',
    principles: 'Principes du projet', transparent: 'Sources transparentes', analysis: 'Analyse avec contexte', noProfit: 'Aucune promesse de profit',
    ambition: 'NOTRE AMBITION', signal: 'Du signal à la compréhension.', desc: 'NEWS FX construit un service d’information financière qui distingue clairement les faits, les sources et les interprétations.',
    regions: 'COUVERTURE DES MARCHÉS', regionsTitle: 'Une vision mondiale pour les traders.', regionsDesc: 'Suivez le contexte des marchés dans les principaux fuseaux horaires. La couverture est organisée par région et dépend des sources vérifiées.',
    asia: 'Asie-Pacifique', europe: 'Europe', americas: 'Amériques', mena: 'Moyen-Orient et Afrique', global: 'Marchés mondiaux', regionDetail: 'Contexte des marchés régionaux',
  },
  es: {
    project: 'Proyecto', objective: 'Objetivo', offers: 'Planes', faq: 'Preguntas', login: 'Iniciar sesión', join: 'Ser fundador',
    prep: 'EN PREPARACIÓN', headline: 'Información que aporta claridad.', headline2: 'El contexto que importa.',
    lead: 'Seguimiento estructurado de anuncios políticos y económicos, con fuentes, marcas de tiempo y análisis prudentes. Diseñado para traders que quieren entender mejor la actualidad.',
    joinCta: 'Unirse a los fundadores', discover: 'Descubrir el proyecto', proof: 'La transparencia es lo primero.', proof2: 'Sin promesas de ganancias. Fuentes y contexto.',
    api: 'OBJETIVO DE ACCESO A LA API', estimate: '*Estimación provisional por confirmar con el proveedor.', sources: 'Fuentes identificadas', authorized: 'Cuando esté permitido', context: 'Contexto, no certezas', risk: 'Información general · mercado de riesgo',
    principles: 'Principios del proyecto', transparent: 'Fuentes transparentes', analysis: 'Análisis con contexto', noProfit: 'Sin promesas de ganancias',
    ambition: 'NUESTRA AMBICIÓN', signal: 'De la señal a la comprensión.', desc: 'NEWS FX está creando un servicio de información financiera que distingue claramente los hechos, las fuentes y las interpretaciones.',
    regions: 'COBERTURA DE MERCADOS', regionsTitle: 'Una visión global para traders.', regionsDesc: 'Sigue el contexto de los mercados en las principales zonas horarias. La cobertura se organiza por región y depende de fuentes verificadas.',
    asia: 'Asia-Pacífico', europe: 'Europa', americas: 'Américas', mena: 'Oriente Medio y África', global: 'Mercados globales', regionDetail: 'Contexto de mercado regional',
  },
  pt: {
    project: 'Projeto', objective: 'Objetivo', offers: 'Planos', faq: 'Perguntas', login: 'Entrar', join: 'Tornar-se fundador',
    prep: 'EM PREPARAÇÃO', headline: 'Informação que traz clareza.', headline2: 'Contexto que importa.',
    lead: 'Acompanhamento estruturado de anúncios políticos e económicos, com fontes, horários e análises ponderadas. Feito para traders que querem compreender melhor as notícias.',
    joinCta: 'Juntar-se aos fundadores', discover: 'Conhecer o projeto', proof: 'A transparência em primeiro lugar.', proof2: 'Sem promessas de ganhos. Fontes e contexto.',
    api: 'OBJETIVO DE ACESSO À API', estimate: '*Estimativa de trabalho a confirmar com o fornecedor.', sources: 'Fontes identificadas', authorized: 'Quando autorizado', context: 'Contexto, não certezas', risk: 'Informação geral · mercado de risco',
    principles: 'Princípios do projeto', transparent: 'Fontes transparentes', analysis: 'Análise com contexto', noProfit: 'Sem promessas de lucro',
    ambition: 'A NOSSA AMBIÇÃO', signal: 'Do sinal à compreensão.', desc: 'A NEWS FX está a criar um serviço de informação financeira que distingue claramente factos, fontes e interpretações.',
    regions: 'COBERTURA DOS MERCADOS', regionsTitle: 'Uma visão global para traders.', regionsDesc: 'Acompanhe o contexto dos mercados nos principais fusos horários. A cobertura é organizada por região e depende de fontes verificadas.',
    asia: 'Ásia-Pacífico', europe: 'Europa', americas: 'Américas', mena: 'Médio Oriente e África', global: 'Mercados globais', regionDetail: 'Contexto dos mercados regionais',
  },
  zh: {
    project: '项目', objective: '目标', offers: '方案', faq: '常见问题', login: '登录', join: '成为创始成员',
    prep: '筹备中', headline: '让信息更清晰。', headline2: '关注真正重要的背景。',
    lead: '系统追踪政治与经济公告，提供来源、时间戳和审慎分析。为希望更好理解新闻的交易者而设计。',
    joinCta: '加入创始成员', discover: '了解项目', proof: '透明至上。', proof2: '不承诺收益。提供来源与背景。',
    api: 'API 接入目标', estimate: '*暂定估算，需与供应商确认。', sources: '已识别来源', authorized: '在获得许可时', context: '提供背景，不做确定预测', risk: '一般信息 · 市场有风险',
    principles: '项目原则', transparent: '透明的来源', analysis: '结合背景分析', noProfit: '不承诺利润',
    ambition: '我们的愿景', signal: '从信号到理解。', desc: 'NEWS FX 正在打造金融资讯服务，清晰区分事实、来源与解读。',
    regions: '市场覆盖', regionsTitle: '面向交易者的全球视角。', regionsDesc: '关注主要时区的市场动态。内容按区域整理，具体取决于已核实的信息来源。',
    asia: '亚太地区', europe: '欧洲', americas: '美洲', mena: '中东和非洲', global: '全球市场', regionDetail: '区域市场背景',
  },
  ja: {
    project: 'プロジェクト', objective: '目標', offers: 'プラン', faq: 'よくある質問', login: 'ログイン', join: '創設メンバーになる',
    prep: '準備中', headline: '情報をわかりやすく。', headline2: '大切なのは背景。',
    lead: '政治・経済の発表を体系的に追跡し、出典、時刻、慎重な分析を提供します。ニュースを深く理解したいトレーダー向けです。',
    joinCta: '創設メンバーに参加', discover: 'プロジェクトを見る', proof: '透明性を最優先。', proof2: '利益の約束はありません。出典と背景を提供します。',
    api: 'API 利用目標', estimate: '*暫定見積もり。提供元への確認が必要です。', sources: '出典を確認', authorized: '許可された場合', context: '確実な予測ではなく背景を提供', risk: '一般情報 · 市場にはリスクがあります',
    principles: 'プロジェクトの原則', transparent: '透明性のある出典', analysis: '背景を含む分析', noProfit: '利益を約束しません',
    ambition: '私たちの目標', signal: '情報から理解へ。', desc: 'NEWS FX は事実、出典、解釈を明確に区別する金融情報サービスを構築しています。',
    regions: '市場カバレッジ', regionsTitle: 'トレーダーのための世界的な視点。', regionsDesc: '主要なタイムゾーンの市場背景を追跡します。地域別に整理し、確認済みの情報源に基づいて提供します。',
    asia: 'アジア太平洋', europe: 'ヨーロッパ', americas: '南北アメリカ', mena: '中東・アフリカ', global: '世界市場', regionDetail: '地域市場の背景',
  },
}

export function detectLocale(): Locale {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of preferred) {
    const base = language.toLowerCase().split('-')[0]
    if (locales.includes(base as Locale)) return base as Locale
  }
  return 'en'
}

export function translate(locale: Locale, key: string): string {
  return copy[locale][key] ?? copy.en[key] ?? key
}
