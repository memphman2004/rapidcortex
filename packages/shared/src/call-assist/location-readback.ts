import { minutesInTimeZone } from "./routing.js";

const STREET_ADDRESS = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}/;
const INTERSECTION = /\b[\p{L}\p{N}.'-]+(?:\s+[\p{L}\p{N}.'-]+){0,3}\s+and\s+[\p{L}\p{N}.'-]+(?:\s+[\p{L}\p{N}.'-]+){0,3}\b/iu;

/** True when the slot is a place the caller just gave, not a description or a name. */
export function isLocationSlot(slotId: string | null | undefined): boolean {
  return /location|address|cross/i.test(slotId ?? "");
}

/** One spoken check of a street address or cross streets. Empty when the text is not a place. */
export function locationReadback(text: string | null | undefined, language = "en"): string | null {
  const address = (text ?? "").trim().replace(/\s+/g, " ");
  if (address.length < 5 || address.length > 180) return null;
  if (!STREET_ADDRESS.test(address) && !INTERSECTION.test(address)) return null;
  return locationConfirmPrompt(language, address);
}

function locationConfirmPrompt(language: string, address: string): string {
  const lang = language.toLowerCase();
  if (lang.startsWith("es")) return `Tengo la ubicación como ${address}. ¿Es correcto?`;
  if (lang.startsWith("zh")) return `我记下的位置是${address}。对吗？`;
  if (lang.startsWith("yue")) return `我記低嘅位置係${address}。啱唔啱？`;
  if (lang.startsWith("tl")) return `Ang lokasyon na nakuha ko ay ${address}. Tama po ba?`;
  if (lang.startsWith("vi")) return `Tôi ghi địa điểm là ${address}. Đúng không?`;
  if (lang.startsWith("ar")) return `الموقع الذي سجلته هو ${address}. هل هذا صحيح؟`;
  if (lang.startsWith("fr")) return `J'ai noté l'endroit comme ${address}. Est-ce exact?`;
  return `I have the location as ${address}. Is that right?`;
}

export type SameDayReport = {
  sessionId: string;
  createdAt?: string;
  callbackNumber?: string;
  locationText?: string;
};

/** Same callback and same place, already filed today. */
export function findSameDayReport(
  rows: readonly SameDayReport[],
  current: SameDayReport & { now: string },
): SameDayReport | null {
  const phone = digits(current.callbackNumber);
  const place = normPlace(current.locationText);
  if (!phone || !place) return null;
  const day = current.now.slice(0, 10);
  for (const row of rows) {
    if (row.sessionId === current.sessionId) continue;
    if (!row.createdAt?.startsWith(day)) continue;
    if (digits(row.callbackNumber) !== phone) continue;
    if (normPlace(row.locationText) !== place) continue;
    return row;
  }
  return null;
}

function digits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(-10);
}

function normPlace(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Weekday municipal desks are 8:00 to 17:00. The report is still filed. */
export function municipalAfterHoursNote(now: Date, timeZone = "America/Chicago", language = "en"): string | null {
  const { day, minutes } = minutesInTimeZone(now, timeZone);
  const open = day >= 1 && day <= 5 && minutes >= 8 * 60 && minutes < 17 * 60;
  if (open) return null;
  const lang = language.toLowerCase();
  if (lang.startsWith("es")) return "Esa oficina está cerrada ahora. Igual dejo el reporte y lo verán el siguiente día hábil.";
  if (lang.startsWith("zh")) return "这个部门现在下班了。我仍会记下报告，他们会在下一个工作日处理。";
  if (lang.startsWith("yue")) return "呢個部門而家收工。我一樣會記低報告，佢哋下一個工作日會睇。";
  if (lang.startsWith("tl")) return "Sarado ngayon ang opisina. Itatala ko pa rin ang ulat at titingnan nila ito sa susunod na araw ng trabaho.";
  if (lang.startsWith("vi")) return "Văn phòng đang đóng cửa. Tôi vẫn ghi báo cáo và họ sẽ xem vào ngày làm việc tiếp theo.";
  if (lang.startsWith("ar")) return "المكتب مغلق الآن. سأسجل البلاغ على أي حال وسيراجعونه في يوم العمل التالي.";
  if (lang.startsWith("fr")) return "Ce bureau est fermé. Je dépose quand même le signalement. Ils le verront le prochain jour ouvrable.";
  return "That office is closed right now. I'll still file the report, and they will see it on the next business day.";
}

export function closingSurveyPrompt(language = "en"): string {
  const lang = language.toLowerCase();
  if (lang.startsWith("es")) return "Del 1 al 5, ¿lo resolvimos bien?";
  if (lang.startsWith("zh")) return "从1到5，我们这次办对了吗？";
  if (lang.startsWith("yue")) return "由1到5，今次我哋做得啱唔啱？";
  if (lang.startsWith("tl")) return "Mula 1 hanggang 5, nakuha ba namin ito nang tama?";
  if (lang.startsWith("vi")) return "Từ 1 đến 5, chúng tôi có làm đúng không?";
  if (lang.startsWith("ar")) return "من 1 إلى 5، هل أنجزنا هذا بشكل صحيح؟";
  if (lang.startsWith("fr")) return "De 1 à 5, est-ce que nous avons bien compris?";
  return "From 1 to 5, did we get this right?";
}
