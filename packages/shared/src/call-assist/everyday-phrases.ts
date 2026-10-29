import type { MunicipalDepartmentId } from "./municipal-services.js";

/** Languages Nexiq can take a live call in, including French for typed configs. */
export const CALLER_REASON_LANGUAGES = ["en", "es", "zh", "yue", "tl", "vi", "ar", "fr"] as const;
export type CallerReasonLanguage = (typeof CALLER_REASON_LANGUAGES)[number];

export type EverydayCallPhrase = {
  serviceId: string;
  departmentId: MunicipalDepartmentId;
  label: string;
  phrases: readonly string[];
};

/**
 * How residents actually describe a high-volume reason, in every Nexiq language.
 * Catalog titles still match. These phrases cover the wording people use instead.
 */
export const EVERYDAY_CALL_PHRASES: readonly EverydayCallPhrase[] = [
  phrase("NC311-0246", "SANITATION", "missed trash pickup", [
    "didn't pick up the trash", "they missed my trash", "trash was not picked up", "no trash pickup",
    "no recogieron la basura", "no pasaron por la basura", "se olvidaron la basura",
    "垃圾没收", "没有收垃圾", "垃圾未有收", "冇收垃圾",
    "hindi kinuha ang basura", "nakaligtaan ang basura",
    "không thu rác", "quên lấy rác",
    "لم يجمعوا القمامة", "ما أخذوا الزبالة",
    "ils n'ont pas ramassé les ordures", "oubli des ordures",
  ]),
  phrase("NC311-0247", "SANITATION", "missed recycling pickup", [
    "didn't pick up the recycling", "missed my recycling", "recycling was not picked up",
    "no recogieron el reciclaje", "no pasó el reciclaje",
    "回收没收", "没有收回收", "回收未有收",
    "hindi kinuha ang recycling", "không thu rác tái chế", "لم يجمعوا إعادة التدوير",
    "ils n'ont pas pris le recyclage",
  ]),
  phrase("NC311-0265", "SANITATION", "sharps disposal", [
    "throw away needles", "needle disposal", "syringe disposal", "where do i take needles",
    "tirar agujas", "desechar jeringas", "donde tiro las agujas",
    "丢针头", "针头怎么扔", "丢针", "針頭點丟",
    "itapon ang karayom", "saan itatapon ang karayom",
    "vứt kim tiêm", "bỏ kim tiêm ở đâu",
    "أين أرمي الإبر", "التخلص من الإبر",
    "jeter des aiguilles", "où jeter les seringues",
  ]),
  phrase("NC311-0155", "PUBLIC_WORKS", "pothole", [
    "hole in the street", "hole in the road", "the road has a hole",
    "bache en la calle", "hoyo en la calle", "hay un bache",
    "路面有坑", "马路上有洞", "路面有坑洞", "路有窿",
    "butas sa kalsada", "lubak sa daan",
    "ổ gà", "lỗ trên đường",
    "حفرة في الشارع", "حفرة بالطريق",
    "nid de poule", "trou dans la rue",
  ]),
  phrase("NC311-0204", "PUBLIC_WORKS_ELECTRICAL", "streetlight outage", [
    "street light is out", "light pole is dark", "the street is dark",
    "luz de la calle apagada", "el poste no prende", "farol apagado",
    "路灯不亮", "路灯坏了", "街灯不亮", "街燈壞咗",
    "patay ang ilaw sa kalye", "hindi umaandar ang streetlight",
    "đèn đường tắt", "đèn đường hỏng",
    "عامود الإنارة مطفي", "لمبة الشارع لا تعمل",
    "lampadaire éteint", "lumière de rue en panne",
  ]),
  phrase("NC311-0331", "WATER_SEWER_AUTHORITY", "no water", [
    "no water", "water is off", "no water coming out", "we have no water",
    "no hay agua", "se fue el agua", "no sale agua",
    "没水", "停水了", "沒有水", "冇水",
    "walang tubig", "nawalan ng tubig",
    "mất nước", "không có nước",
    "ما في ماء", "انقطع الماء", "ماكو ماء",
    "plus d'eau", "il n'y a pas d'eau",
  ]),
  phrase("NC311-0328", "WATER_SEWER_AUTHORITY", "water leak", [
    "water leak", "pipe is leaking", "water bubbling in the street",
    "fuga de agua", "tubería goteando", "hay una fuga",
    "漏水", "水管漏水", "漏水呀",
    "tagas ng tubig", "tumutulo ang tubo",
    "rò rỉ nước", "ống nước bị rò",
    "تسرب ماء", "الماسورة تسرب",
    "fuite d'eau", "tuyau qui fuit",
  ]),
  phrase("NC311-0349", "WATER_SEWER_AUTHORITY", "sewer backup", [
    "sewer backup", "sewage in the street", "sewer is backing up",
    "alcantarilla tapada", "aguas negras", "drenaje tapado",
    "下水道堵了", "污水倒灌", "渠堵塞", "渠塞咗",
    "barado ang alkantarilya", "umagos ang dumi",
    "cống tắc", "nước thải tràn",
    "مجاري مسدودة", "صرف صحي طافح",
    "égout bouché", "refoulement d'égout",
  ]),
  phrase("NC311-0027", "POLICE_NON_EMERGENCY", "abandoned vehicle", [
    "car has been sitting", "car left on the street", "abandoned car",
    "carro abandonado", "coche abandonado", "vehículo abandonado",
    "废弃车辆", "车停了很久", "棄車", "架車停咗好耐",
    "iniwang na kotse", "sasakyang nakatiwangwang",
    "xe bỏ hoang", "ô tô bỏ lại",
    "سيارة متروكة", "سيارة مهجورة",
    "voiture abandonnée", "véhicule abandonné",
  ]),
  phrase("NC311-0023", "POLICE_NON_EMERGENCY", "noise complaint", [
    "loud music next door", "neighbors are too loud", "party is too loud",
    "música muy alta", "vecinos muy ruidosos", "fiesta muy alta",
    "噪音太大", "隔壁太吵", "嘈到爆", "隔篱好嘈",
    "masyadong maingay", "malakas ang musika",
    "nhạc quá to", "hàng xóm ồn ào",
    "موسيقى عالية", "الجيران مزعجين",
    "musique trop forte", "voisins trop bruyants",
  ]),
  phrase("NC311-0492", "ANIMAL_CONTROL", "loose dog", [
    "loose dog", "stray dog", "dog running loose",
    "perro suelto", "perro callejero", "hay un perro suelto",
    "流浪狗", "狗没拴", "流浪犬", "有隻狗走失",
    "ligaw na aso", "nakawala ang aso",
    "chó thả rông", "chó đi lạc",
    "كلب سائب", "كلب ضال",
    "chien errant", "chien en liberté",
  ]),
  phrase("NC311-0163", "URBAN_FORESTRY", "fallen tree", [
    "tree fell down", "fallen tree", "tree is down",
    "árbol caído", "se cayó un árbol",
    "树倒了", "倒树", "樹倒咗",
    "bumagsak na puno", "natumba ang puno",
    "cây đổ", "cây bị đổ",
    "شجرة وقعت", "شجرة ساقطة",
    "arbre tombé", "arbre est tombé",
  ]),
  phrase("NC311-0279", "SANITATION", "illegal dumping", [
    "someone dumped trash", "illegal dumping", "trash dumped in the alley",
    "tiraron basura", "basurero clandestino", "vertieron basura",
    "乱倒垃圾", "有人倒垃圾", "亂拋垃圾",
    "nagtapon ng basura", "basurang itinapon",
    "đổ rác bừa bãi", "vứt rác trái phép",
    "رمي نفايات", "حد رمى زبالة",
    "dépôt sauvage", "quelqu'un a jeté des ordures",
  ]),
  phrase("NC311-0318", "TAX_FINANCE", "water bill", [
    "water bill is high", "question about my water bill", "my water bill",
    "factura del agua", "recibo del agua muy alto", "cuenta del agua",
    "水费太高", "水费账单", "水費單", "水費好貴",
    "bill ng tubig", "mataas ang bill sa tubig",
    "hóa đơn nước", "tiền nước cao",
    "فاتورة الماء", "فاتورة المياه غالية",
    "facture d'eau", "ma facture d'eau",
  ]),
  phrase("NC311-0808", "ELECTIONS", "voter registration", [
    "where do i vote", "register to vote", "am i registered to vote",
    "dónde voto", "registrarme para votar", "dónde me registro para votar",
    "在哪里投票", "选民登记", "去邊投票", "選民登記",
    "saan boboto", "magparehistro para bumoto",
    "đi bầu ở đâu", "đăng ký bỏ phiếu",
    "أين أصوت", "تسجيل الناخبين",
    "où voter", "inscription électorale",
  ]),
  phrase("NC311-0825", "LIBRARY", "library hours", [
    "what time does the library open", "library hours", "is the library open",
    "horario de la biblioteca", "a qué hora abre la biblioteca",
    "图书馆几点开门", "图书馆开放时间", "圖書館幾點開",
    "oras ng aklatan", "bukas ba ang library",
    "giờ mở cửa thư viện", "thư viện mở cửa lúc mấy giờ",
    "ساعات المكتبة", "متى تفتح المكتبة",
    "horaires de la bibliothèque", "la bibliothèque est ouverte",
  ]),
  phrase("NC311-0814", "COURTS", "jury duty", [
    "i have jury duty", "jury summons", "where do i go for jury duty",
    "tengo que ser jurado", "citación de jurado", "servicio de jurado",
    "陪审义务", "陪审传票", "陪審員",
    "jury duty", "ipinatawag bilang hurado",
    "nghĩa vụ bồi thẩm", "giấy gọi bồi thẩm",
    "واجب هيئة المحلفين", "استدعاء هيئة المحلفين",
    "devoir de juré", "convocation de juré",
  ]),
  phrase("NC311-0801", "CITY_CLERK", "birth certificate", [
    "need a birth certificate", "copy of my birth certificate",
    "acta de nacimiento", "copia del acta de nacimiento",
    "出生证明", "出生纸", "出世紙",
    "birth certificate", "kopya ng birth certificate",
    "giấy khai sinh", "bản sao giấy khai sinh",
    "شهادة ميلاد", "نسخة شهادة الميلاد",
    "certificat de naissance", "copie de l'acte de naissance",
  ]),
  phrase("NC311-0543", "ENVIRONMENTAL_QUALITY", "rodents", [
    "there are rats", "rat problem", "mice in the building",
    "hay ratas", "problema de ratones", "ratas en el edificio",
    "有老鼠", "老鼠太多", "有鼠",
    "may daga", "problema sa daga",
    "có chuột", "chuột trong nhà",
    "في جرذان", "مشكلة جرذان",
    "il y a des rats", "problème de souris",
  ]),
  phrase("NC311-0098", "FIRE_MARSHAL_NON_EMERGENCY", "hydrant obstruction", [
    "car blocking the hydrant", "fire hydrant is blocked",
    "coche tapa el hidrante", "hidrante bloqueado",
    "车挡住消防栓", "消防栓被挡", "車擋住消防栓",
    "may kotse sa fire hydrant", "harang ang hydrant",
    "xe chắn trụ cứu hỏa", "trụ nước bị chặn",
    "سيارة تسد صنبور الحريق", "صنبور الحريق مسدود",
    "voiture devant la borne", "borne incendie bloquée",
  ]),
  phrase("NC311-1107", "TRANSIT_AUTHORITY", "ferry schedule", [
    "what time is the ferry", "ferry schedule", "is the ferry running",
    "horario del ferry", "a qué hora sale el ferry",
    "渡轮时刻", "渡轮几点", "渡輪時間",
    "iskedyul ng ferry", "anong oras ang ferry",
    "lịch phà", "phà chạy lúc mấy giờ",
    "جدول العبارة", "متى تتحرك العبارة",
    "horaire du traversier", "à quelle heure est le traversier",
  ]),
];

function phrase(
  serviceId: string,
  departmentId: MunicipalDepartmentId,
  label: string,
  phrases: string[],
): EverydayCallPhrase {
  return { serviceId, departmentId, label, phrases };
}

export function normalizeCallerText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchEverydayCallPhrase(text: string): EverydayCallPhrase | null {
  const haystack = normalizeCallerText(text);
  if (!haystack) return null;
  let best: { row: EverydayCallPhrase; length: number } | null = null;
  for (const row of EVERYDAY_CALL_PHRASES) {
    for (const phraseText of row.phrases) {
      const needle = normalizeCallerText(phraseText);
      if (needle.length < 2) continue;
      const hit = needle.includes(" ")
        ? ` ${haystack} `.includes(` ${needle} `)
        : new RegExp(`(?:^|\\s)${needle}(?:\\s|$)`, "u").test(` ${haystack} `);
      if (!hit) continue;
      if (!best || needle.length > best.length) best = { row, length: needle.length };
    }
  }
  return best?.row ?? null;
}
