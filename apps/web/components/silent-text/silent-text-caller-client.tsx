"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SilentTextPublicSession } from "rapid-cortex-shared";
import { DEFAULT_CALLER_QUICK_REPLIES, isLikelyRightToLeftLanguage } from "rapid-cortex-shared";

/**
 * Top languages spoken at home in the USA (ACS / Census), with English first.
 * Labels use the language’s own name for fast recognition on a small screen.
 */
type LocaleKey = "en" | "es" | "zh" | "tl" | "vi" | "ar" | "fr" | "ko" | "ru" | "de";

const LOCALES: { key: LocaleKey; label: string }[] = [
  { key: "en", label: "English" },
  { key: "es", label: "Español" },
  { key: "zh", label: "中文" },
  { key: "tl", label: "Tagalog" },
  { key: "vi", label: "Tiếng Việt" },
  { key: "ar", label: "العربية" },
  { key: "fr", label: "Français" },
  { key: "ko", label: "한국어" },
  { key: "ru", label: "Русский" },
  { key: "de", label: "Deutsch" },
];

type UiCopy = {
  title: string;
  subtitle: string;
  lead: string;
  end: string;
  quickExit: string;
  hide: string;
  show: string;
  stealthTitle: string;
  stealthHint: string;
  placeholder: string;
  send: string;
  ended: string;
  expired: string;
  closed: string;
  err: string;
  connecting: string;
};

const COPY: Record<LocaleKey, UiCopy> = {
  en: {
    title: "Secure text with dispatch",
    subtitle: "Emergency services",
    lead: "If speaking is not safe, reply here by text. Short answers are OK — yes/no is fine.",
    end: "End session",
    quickExit: "Quick exit",
    hide: "Hide chat",
    show: "Show chat",
    stealthTitle: "Notes",
    stealthHint: "Discreet view — your messages still go to dispatch.",
    placeholder: "Type a short message…",
    send: "Send",
    ended: "This session has ended. You can close this tab.",
    expired: "This link has expired. If you still need help, call your local emergency number when it is safe.",
    closed: "This session is closed.",
    err: "Could not send. Check your connection and try again.",
    connecting: "Connecting…",
  },
  es: {
    title: "Texto seguro con despacho",
    subtitle: "Servicios de emergencia",
    lead: "Si no es seguro hablar, responda aquí por texto. Respuestas cortas están bien.",
    end: "Terminar sesión",
    quickExit: "Salida rápida",
    hide: "Ocultar chat",
    show: "Mostrar chat",
    stealthTitle: "Notas",
    stealthHint: "Vista discreta — sus mensajes siguen llegando a despacho.",
    placeholder: "Escriba un mensaje breve…",
    send: "Enviar",
    ended: "Esta sesión terminó. Puede cerrar esta pestaña.",
    expired: "Este enlace expiró. Si aún necesita ayuda, llame al número de emergencia local cuando sea seguro.",
    closed: "Esta sesión está cerrada.",
    err: "No se pudo enviar. Compruebe la conexión e intente de nuevo.",
    connecting: "Conectando…",
  },
  zh: {
    title: "与调度安全短信",
    subtitle: "紧急服务",
    lead: "如果说话不安全，请在此用文字回复。简短回答即可——是/否也可以。",
    end: "结束会话",
    quickExit: "快速退出",
    hide: "隐藏聊天",
    show: "显示聊天",
    stealthTitle: "笔记",
    stealthHint: "隐蔽视图 — 您的消息仍会发送给调度。",
    placeholder: "输入简短消息…",
    send: "发送",
    ended: "会话已结束。您可以关闭此标签页。",
    expired: "此链接已过期。如仍需帮助，请在安全时拨打当地紧急电话。",
    closed: "此会话已关闭。",
    err: "发送失败。请检查网络后重试。",
    connecting: "连接中…",
  },
  tl: {
    title: "Ligtas na text sa dispatch",
    subtitle: "Mga serbisyong pang-emerhensiya",
    lead: "Kung hindi ligtas magsalita, sumagot dito sa text. OK ang maikling sagot — oo/hindi ay fine.",
    end: "Tapusin ang session",
    quickExit: "Mabilisang labas",
    hide: "Itago ang chat",
    show: "Ipakita ang chat",
    stealthTitle: "Mga tala",
    stealthHint: "Diskretong view — papunta pa rin sa dispatch ang iyong mga mensahe.",
    placeholder: "Mag-type ng maikling mensahe…",
    send: "Ipadala",
    ended: "Tapos na ang session. Maaari mong isara ang tab na ito.",
    expired: "Nag-expire na ang link. Kung kailangan mo pa ng tulong, tumawag sa lokal na emergency number kapag ligtas.",
    closed: "Sarado na ang session na ito.",
    err: "Hindi maipadala. Suriin ang koneksyon at subukan ulit.",
    connecting: "Kumokonekta…",
  },
  vi: {
    title: "Nhắn tin an toàn với điều phối",
    subtitle: "Dịch vụ khẩn cấp",
    lead: "Nếu nói không an toàn, hãy trả lời bằng tin nhắn. Câu trả lời ngắn cũng được — có/không là ổn.",
    end: "Kết thúc phiên",
    quickExit: "Thoát nhanh",
    hide: "Ẩn trò chuyện",
    show: "Hiện trò chuyện",
    stealthTitle: "Ghi chú",
    stealthHint: "Chế độ kín đáo — tin nhắn vẫn gửi tới điều phối.",
    placeholder: "Nhập tin nhắn ngắn…",
    send: "Gửi",
    ended: "Phiên đã kết thúc. Bạn có thể đóng tab này.",
    expired: "Liên kết đã hết hạn. Nếu vẫn cần giúp, hãy gọi số khẩn cấp địa phương khi an toàn.",
    closed: "Phiên này đã đóng.",
    err: "Không gửi được. Kiểm tra kết nối và thử lại.",
    connecting: "Đang kết nối…",
  },
  ar: {
    title: "رسائل آمنة مع غرفة العمليات",
    subtitle: "خدمات الطوارئ",
    lead: "إذا لم يكن الكلام آمناً، أجب هنا بالنص. الإجابات القصيرة مقبولة — نعم/لا تكفي.",
    end: "إنهاء الجلسة",
    quickExit: "خروج سريع",
    hide: "إخفاء المحادثة",
    show: "إظهار المحادثة",
    stealthTitle: "ملاحظات",
    stealthHint: "عرض سري — رسائلك تصل إلى غرفة العمليات.",
    placeholder: "اكتب رسالة قصيرة…",
    send: "إرسال",
    ended: "انتهت هذه الجلسة. يمكنك إغلاق هذه الصفحة.",
    expired: "انتهت صلاحية هذا الرابط. إذا كنت لا تزال بحاجة للمساعدة، اتصل برقم الطوارئ المحلي عندما يكون ذلك آمناً.",
    closed: "هذه الجلسة مغلقة.",
    err: "تعذر الإرسال. تحقق من الاتصال وحاول مرة أخرى.",
    connecting: "جارٍ الاتصال…",
  },
  fr: {
    title: "Texto sécurisé avec le dispatch",
    subtitle: "Services d’urgence",
    lead: "Si parler n’est pas sûr, répondez ici par texto. Les réponses courtes sont OK — oui/non suffit.",
    end: "Terminer la session",
    quickExit: "Sortie rapide",
    hide: "Masquer le chat",
    show: "Afficher le chat",
    stealthTitle: "Notes",
    stealthHint: "Vue discrète — vos messages vont toujours au dispatch.",
    placeholder: "Tapez un message court…",
    send: "Envoyer",
    ended: "Cette session est terminée. Vous pouvez fermer cet onglet.",
    expired: "Ce lien a expiré. Si vous avez encore besoin d’aide, appelez le numéro d’urgence local quand c’est sûr.",
    closed: "Cette session est fermée.",
    err: "Envoi impossible. Vérifiez la connexion et réessayez.",
    connecting: "Connexion…",
  },
  ko: {
    title: "관제실과 안전한 문자",
    subtitle: "응급 서비스",
    lead: "말하기가 안전하지 않으면 여기서 문자로 답하세요. 짧은 답변도 괜찮습니다 — 예/아니요도 됩니다.",
    end: "세션 종료",
    quickExit: "빠른 종료",
    hide: "채팅 숨기기",
    show: "채팅 보기",
    stealthTitle: "메모",
    stealthHint: "조용한 화면 — 메시지는 관제실로 계속 전달됩니다.",
    placeholder: "짧은 메시지 입력…",
    send: "보내기",
    ended: "세션이 종료되었습니다. 이 탭을 닫으셔도 됩니다.",
    expired: "이 링크가 만료되었습니다. 도움이 더 필요하면 안전할 때 지역 긴급 번호로 전화하세요.",
    closed: "이 세션은 종료되었습니다.",
    err: "전송할 수 없습니다. 연결을 확인하고 다시 시도하세요.",
    connecting: "연결 중…",
  },
  ru: {
    title: "Безопасный текст с диспетчером",
    subtitle: "Экстренные службы",
    lead: "Если говорить небезопасно, ответьте здесь текстом. Короткие ответы подходят — да/нет достаточно.",
    end: "Завершить сеанс",
    quickExit: "Быстрый выход",
    hide: "Скрыть чат",
    show: "Показать чат",
    stealthTitle: "Заметки",
    stealthHint: "Скрытый вид — ваши сообщения всё равно идут диспетчеру.",
    placeholder: "Короткое сообщение…",
    send: "Отправить",
    ended: "Сеанс завершён. Можно закрыть эту вкладку.",
    expired: "Срок ссылки истёк. Если помощь всё ещё нужна, позвоните в местную службу экстренной помощи, когда это безопасно.",
    closed: "Этот сеанс закрыт.",
    err: "Не удалось отправить. Проверьте соединение и попробуйте снова.",
    connecting: "Подключение…",
  },
  de: {
    title: "Sicherer Text mit der Leitstelle",
    subtitle: "Notfalldienste",
    lead: "Wenn Sprechen nicht sicher ist, antworten Sie hier per Text. Kurze Antworten sind OK — ja/nein reicht.",
    end: "Sitzung beenden",
    quickExit: "Schnell verlassen",
    hide: "Chat ausblenden",
    show: "Chat anzeigen",
    stealthTitle: "Notizen",
    stealthHint: "Diskrete Ansicht — Ihre Nachrichten gehen weiterhin an die Leitstelle.",
    placeholder: "Kurze Nachricht tippen…",
    send: "Senden",
    ended: "Diese Sitzung ist beendet. Sie können diesen Tab schließen.",
    expired: "Dieser Link ist abgelaufen. Wenn Sie noch Hilfe brauchen, rufen Sie die örtliche Notrufnummer an, wenn es sicher ist.",
    closed: "Diese Sitzung ist geschlossen.",
    err: "Senden fehlgeschlagen. Verbindung prüfen und erneut versuchen.",
    connecting: "Verbinden…",
  },
};

/** Localized labels/text for one-tap chips (same ids as DEFAULT_CALLER_QUICK_REPLIES). */
const QUICK_REPLY_I18N: Record<LocaleKey, Record<string, { label: string; text: string }>> = {
  en: Object.fromEntries(DEFAULT_CALLER_QUICK_REPLIES.map((q) => [q.id, { label: q.label, text: q.text }])),
  es: {
    yes: { label: "Sí", text: "Sí" },
    no: { label: "No", text: "No" },
    cannot_talk: { label: "No puedo hablar", text: "No puedo hablar" },
    someone_here: { label: "Alguien está aquí", text: "Alguien está aquí" },
    help_now: { label: "Envíen ayuda ya", text: "Envíen ayuda ya" },
    hiding: { label: "Estoy escondido/a", text: "Estoy escondido/a" },
    police: { label: "Necesito policía", text: "Necesito policía" },
    ambulance: { label: "Necesito ambulancia", text: "Necesito ambulancia" },
    fire: { label: "Necesito bomberos", text: "Necesito bomberos" },
  },
  zh: {
    yes: { label: "是", text: "是" },
    no: { label: "否", text: "否" },
    cannot_talk: { label: "不能说话", text: "不能说话" },
    someone_here: { label: "有人在这里", text: "有人在这里" },
    help_now: { label: "立刻派人来", text: "立刻派人来" },
    hiding: { label: "我在躲藏", text: "我在躲藏" },
    police: { label: "需要警察", text: "需要警察" },
    ambulance: { label: "需要救护车", text: "需要救护车" },
    fire: { label: "需要消防", text: "需要消防" },
  },
  tl: {
    yes: { label: "Oo", text: "Oo" },
    no: { label: "Hindi", text: "Hindi" },
    cannot_talk: { label: "Hindi makapagsalita", text: "Hindi makapagsalita" },
    someone_here: { label: "May tao dito", text: "May tao dito" },
    help_now: { label: "Magpadala ng tulong ngayon", text: "Magpadala ng tulong ngayon" },
    hiding: { label: "Nagtatago ako", text: "Nagtatago ako" },
    police: { label: "Kailangan ng pulis", text: "Kailangan ng pulis" },
    ambulance: { label: "Kailangan ng ambulansya", text: "Kailangan ng ambulansya" },
    fire: { label: "Kailangan ng bumbero", text: "Kailangan ng bumbero" },
  },
  vi: {
    yes: { label: "Có", text: "Có" },
    no: { label: "Không", text: "Không" },
    cannot_talk: { label: "Không nói được", text: "Không nói được" },
    someone_here: { label: "Có người ở đây", text: "Có người ở đây" },
    help_now: { label: "Cứu ngay", text: "Cứu ngay" },
    hiding: { label: "Tôi đang trốn", text: "Tôi đang trốn" },
    police: { label: "Cần cảnh sát", text: "Cần cảnh sát" },
    ambulance: { label: "Cần xe cấp cứu", text: "Cần xe cấp cứu" },
    fire: { label: "Cần cứu hỏa", text: "Cần cứu hỏa" },
  },
  ar: {
    yes: { label: "نعم", text: "نعم" },
    no: { label: "لا", text: "لا" },
    cannot_talk: { label: "لا أستطيع الكلام", text: "لا أستطيع الكلام" },
    someone_here: { label: "هناك شخص هنا", text: "هناك شخص هنا" },
    help_now: { label: "أرسلوا المساعدة الآن", text: "أرسلوا المساعدة الآن" },
    hiding: { label: "أنا مختبئ/ة", text: "أنا مختبئ/ة" },
    police: { label: "أحتاج الشرطة", text: "أحتاج الشرطة" },
    ambulance: { label: "أحتاج إسعاف", text: "أحتاج إسعاف" },
    fire: { label: "أحتاج الإطفاء", text: "أحتاج الإطفاء" },
  },
  fr: {
    yes: { label: "Oui", text: "Oui" },
    no: { label: "Non", text: "Non" },
    cannot_talk: { label: "Je ne peux pas parler", text: "Je ne peux pas parler" },
    someone_here: { label: "Quelqu’un est là", text: "Quelqu’un est là" },
    help_now: { label: "Envoyez de l’aide maintenant", text: "Envoyez de l’aide maintenant" },
    hiding: { label: "Je suis caché(e)", text: "Je suis caché(e)" },
    police: { label: "Besoin de police", text: "Besoin de police" },
    ambulance: { label: "Besoin d’ambulance", text: "Besoin d’ambulance" },
    fire: { label: "Besoin des pompiers", text: "Besoin des pompiers" },
  },
  ko: {
    yes: { label: "예", text: "예" },
    no: { label: "아니요", text: "아니요" },
    cannot_talk: { label: "말할 수 없음", text: "말할 수 없음" },
    someone_here: { label: "누군가 여기 있음", text: "누군가 여기 있음" },
    help_now: { label: "지금 도움 보내주세요", text: "지금 도움 보내주세요" },
    hiding: { label: "숨어 있음", text: "숨어 있음" },
    police: { label: "경찰 필요", text: "경찰 필요" },
    ambulance: { label: "구급차 필요", text: "구급차 필요" },
    fire: { label: "소방 필요", text: "소방 필요" },
  },
  ru: {
    yes: { label: "Да", text: "Да" },
    no: { label: "Нет", text: "Нет" },
    cannot_talk: { label: "Не могу говорить", text: "Не могу говорить" },
    someone_here: { label: "Кто-то здесь", text: "Кто-то здесь" },
    help_now: { label: "Пришлите помощь сейчас", text: "Пришлите помощь сейчас" },
    hiding: { label: "Я прячусь", text: "Я прячусь" },
    police: { label: "Нужна полиция", text: "Нужна полиция" },
    ambulance: { label: "Нужна скорая", text: "Нужна скорая" },
    fire: { label: "Нужны пожарные", text: "Нужны пожарные" },
  },
  de: {
    yes: { label: "Ja", text: "Ja" },
    no: { label: "Nein", text: "Nein" },
    cannot_talk: { label: "Kann nicht sprechen", text: "Kann nicht sprechen" },
    someone_here: { label: "Jemand ist hier", text: "Jemand ist hier" },
    help_now: { label: "Jetzt Hilfe schicken", text: "Jetzt Hilfe schicken" },
    hiding: { label: "Ich verstecke mich", text: "Ich verstecke mich" },
    police: { label: "Polizei nötig", text: "Polizei nötig" },
    ambulance: { label: "Rettungswagen nötig", text: "Rettungswagen nötig" },
    fire: { label: "Feuerwehr nötig", text: "Feuerwehr nötig" },
  },
};

function isLocaleKey(v: string | undefined | null): v is LocaleKey {
  return Boolean(v && v in COPY);
}

function apiPath(token: string, sub?: string) {
  const enc = encodeURIComponent(token);
  return sub ? `/api/public/silent-text/${enc}/${sub}` : `/api/public/silent-text/${enc}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("empty");
  return JSON.parse(text) as T;
}

export function SilentTextCallerClient({ token }: { token: string }) {
  const [locale, setLocale] = useState<LocaleKey>("en");
  const [session, setSession] = useState<SilentTextPublicSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const openedRef = useRef(false);
  const appliedSessionLocaleRef = useRef(false);
  const localeRef = useRef<LocaleKey>(locale);
  localeRef.current = locale;
  const t = COPY[locale];
  const rtl = isLikelyRightToLeftLanguage(locale);

  const selectLocale = useCallback(
    (next: LocaleKey) => {
      setLocale(next);
      void fetch(apiPath(token, "presence"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "caller_web", locale: next }),
      }).catch(() => {});
    },
    [token],
  );

  const load = useCallback(async () => {
    const res = await fetch(apiPath(token), { cache: "no-store" });
    if (res.status === 410) {
      setCode("expired");
      return;
    }
    if (res.status === 409) {
      setCode("closed");
      return;
    }
    if (!res.ok) {
      setErr(COPY[localeRef.current].err);
      return;
    }
    const s = await readJson<SilentTextPublicSession>(res);
    setSession(s);
    if (!appliedSessionLocaleRef.current && isLocaleKey(s.callerLocale)) {
      appliedSessionLocaleRef.current = true;
      setLocale(s.callerLocale);
    }
    setErr(null);
    setCode(null);
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 2200);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void fetch(apiPath(token, "opened"), { method: "POST" }).catch(() => {});
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetch(apiPath(token, "presence"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "caller_web", locale: localeRef.current }),
      }).catch(() => {});
    }, 50_000);
    return () => window.clearInterval(id);
  }, [token]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(apiPath(token, "message"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            client: { language: localeRef.current, userAgent: navigator.userAgent.slice(0, 512) },
          }),
        });
        if (!res.ok) {
          setErr(COPY[localeRef.current].err);
          return;
        }
        setDraft("");
        await load();
      } catch {
        setErr(COPY[localeRef.current].err);
      } finally {
        setBusy(false);
      }
    },
    [load, token],
  );

  const endSession = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(apiPath(token, "end"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, token]);

  const quickExit = useCallback(() => {
    window.location.replace("https://www.google.com");
  }, []);

  const stealth = Boolean(session?.stealthAppearance);
  const shellClass = stealth
    ? "min-h-[100dvh] bg-zinc-200 text-zinc-900"
    : "min-h-[100dvh] bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100";

  if (code === "expired") {
    return (
      <main dir={rtl ? "rtl" : "ltr"} className="mx-auto flex max-w-lg flex-col justify-center gap-4 px-4 py-16 text-center text-sm text-amber-100">
        {t.expired}
      </main>
    );
  }

  if (!session && !code) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-24 text-sm text-slate-400">
        {t.connecting}
      </main>
    );
  }

  if (code === "closed" || session?.status === "ended" || session?.status === "canceled") {
    return (
      <main dir={rtl ? "rtl" : "ltr"} className="mx-auto flex max-w-lg flex-col justify-center gap-4 px-4 py-16 text-center text-sm text-slate-300">
        {session?.status === "ended" ? t.ended : t.closed}
      </main>
    );
  }

  if (!session) {
    return null;
  }

  const quickReplies = DEFAULT_CALLER_QUICK_REPLIES.map((q) => {
    const i18n = QUICK_REPLY_I18N[locale][q.id];
    return { id: q.id, label: i18n?.label ?? q.label, text: i18n?.text ?? q.text };
  });

  return (
    <main dir={rtl ? "rtl" : "ltr"} className={`mx-auto max-w-lg ${shellClass}`}>
      <div className={stealth ? "px-3 py-3" : "px-4 py-6"}>
        <header className={hidden ? "sr-only" : ""}>
          <p
            className={`text-[10px] font-semibold uppercase tracking-widest ${
              stealth ? "text-zinc-600" : "text-sky-300/90"
            }`}
          >
            {stealth ? t.stealthHint : t.subtitle}
          </p>
          <h1 className={`mt-1 text-xl font-semibold ${stealth ? "text-zinc-800" : "text-white"}`}>
            {stealth ? t.stealthTitle : t.title}
          </h1>
          {!stealth ? (
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]" role="group" aria-label="Language">
              {LOCALES.map((lang) => (
                <button
                  key={lang.key}
                  type="button"
                  className={`rounded-full px-2.5 py-1 ${
                    locale === lang.key ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                  onClick={() => selectLocale(lang.key)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          ) : null}
          <p className={`mt-4 text-sm leading-relaxed ${stealth ? "text-zinc-700" : "text-slate-300"}`}>{t.lead}</p>
        </header>

        {err ? (
          <p className="mt-3 rounded-md border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-100" role="alert">
            {err}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-medium ${
              stealth ? "bg-zinc-300 text-zinc-900" : "border border-slate-700 bg-slate-900 text-slate-200"
            }`}
          >
            {hidden ? t.show : t.hide}
          </button>
          <button
            type="button"
            onClick={quickExit}
            className="min-h-[44px] rounded-xl bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-600"
          >
            {t.quickExit}
          </button>
        </div>

        {!hidden ? (
          <>
            <div
              className={`mt-4 max-h-[45vh] space-y-2 overflow-y-auto rounded-xl border p-3 ${
                stealth ? "border-zinc-300 bg-white" : "border-slate-800 bg-slate-900/50"
              }`}
            >
              {(session?.messages ?? []).map((m) => {
                const display =
                  m.from === "dispatcher" ? (m.translatedForCaller ?? m.body) : m.body;
                return (
                <div
                  key={m.messageId}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.from === "dispatcher"
                      ? stealth
                        ? "ml-6 bg-zinc-100 text-zinc-900"
                        : "ml-6 bg-violet-950/50 text-violet-100"
                      : stealth
                        ? "mr-6 bg-zinc-200 text-zinc-900"
                        : "mr-6 bg-slate-800 text-slate-100"
                  }`}
                >
                  <span className="text-[10px] uppercase opacity-60">{m.from}</span>
                  <p className="mt-1 whitespace-pre-wrap leading-snug">{display}</p>
                  {m.from === "caller" && m.translatedForDispatcher ? (
                    <p className="mt-1 text-[11px] opacity-70">English: {m.translatedForDispatcher}</p>
                  ) : null}
                </div>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickReplies.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendText(q.text)}
                  className={`min-h-[48px] rounded-xl px-2 text-sm font-medium ${
                    stealth ? "bg-zinc-300 text-zinc-900 hover:bg-zinc-400" : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  } disabled:opacity-40`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.placeholder}
                className={`min-h-[48px] min-w-0 flex-1 rounded-xl border px-3 text-base ${
                  stealth ? "border-zinc-400 bg-white text-zinc-900" : "border-slate-700 bg-slate-950 text-slate-100"
                }`}
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void sendText(draft)}
                className="min-h-[48px] shrink-0 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {busy ? "…" : t.send}
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void endSession()}
              className="mt-4 w-full min-h-[48px] rounded-xl border border-rose-900/60 bg-rose-950/40 text-sm font-semibold text-rose-100 hover:bg-rose-950/60"
            >
              {t.end}
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
