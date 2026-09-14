/** Generated from infra/lex/bot-spec.json — do not edit by hand. Run scripts/generate-lex-bot-locales.py */

export type LexSpecSlot = {
  name: string;
  required: boolean;
  promptEn: string;
  promptEs: string;
  promptZhCn?: string;
  promptZhHk?: string;
  promptTl?: string;
  promptVi?: string;
  promptAr?: string;
};

export const LEX_SPEC_INTENT_ORDER = [
  "Welcome",
  "EmergencyEscalation",
  "RequestHuman",
  "NoiseComplaint",
  "SuspiciousPerson",
  "AbandonedVehicle",
  "VehicleBurglary",
  "TheftReport",
  "ParkingComplaint",
  "WelfareCheck",
  "AnimalComplaint",
  "TowComplaint",
  "VandalismDamage",
  "CodeEnforcementComplaint",
  "PublicWorksIssue",
  "TrafficAccidentReportOnly",
  "OnlineReportEligibility",
  "RepeatCallCheck",
  "InformationRequest",
  "FallbackIntent"
] as const;

export const LEX_SPEC_SLOTS: Record<string, LexSpecSlot[]> = {
  "Welcome": [],
  "EmergencyEscalation": [],
  "RequestHuman": [],
  "NoiseComplaint": [
    {
      "name": "NoiseLocation",
      "required": true,
      "promptEn": "What's the address or location of the noise?",
      "promptEs": "¿Cuál es la dirección o el lugar donde está el ruido?",
      "promptZhCn": "噪音是在哪个地址或地点？",
      "promptZhHk": "噪音係喺邊個地址或者地點？",
      "promptTl": "Ano po ang address o lokasyon ng ingay?",
      "promptVi": "Địa chỉ hoặc vị trí của tiếng ồn là ở đâu?",
      "promptAr": "ما هو عنوان أو موقع الضوضاء؟"
    },
    {
      "name": "NoiseType",
      "required": true,
      "promptEn": "What kind of noise is it — music, people yelling, a party, something else?",
      "promptEs": "¿Qué tipo de ruido es — música, gritos, una fiesta, o algo más?",
      "promptZhCn": "是什么噪音——音乐、有人喊叫、派对，还是别的？",
      "promptZhHk": "係咩噪音——音樂、有人嗌、派對，定係其他？",
      "promptTl": "Anong klaseng ingay po — musika, sigawan, party, o iba?",
      "promptVi": "Đó là loại tiếng ồn nào — nhạc, la hét, tiệc, hay khác?",
      "promptAr": "ما نوع الضوضاء — موسيقى، صراخ، حفلة، أم شيء آخر؟"
    },
    {
      "name": "NoiseStillHappening",
      "required": true,
      "promptEn": "Is the noise still happening right now?",
      "promptEs": "¿El ruido todavía está ocurriendo ahora mismo?",
      "promptZhCn": "现在还在响吗？",
      "promptZhHk": "而家仲响緊嗎？",
      "promptTl": "Nagpapatuloy po ba ang ingay ngayon?",
      "promptVi": "Tiếng ồn vẫn đang xảy ra chứ?",
      "promptAr": "هل الضوضاء مستمرة الآن؟"
    },
    {
      "name": "CallbackNumber",
      "required": false,
      "promptEn": "And what's a good callback number in case we need to reach you?",
      "promptEs": "¿Y cuál es un número de teléfono para contactarle si es necesario?",
      "promptZhCn": "方便留一个回拨电话吗？",
      "promptZhHk": "方便留一個回撥電話嗎？",
      "promptTl": "Ano po ang magandang callback number kung kailangan namin kayong tawagan?",
      "promptVi": "Số điện thoại nào để chúng tôi gọi lại nếu cần?",
      "promptAr": "ما رقم الهاتف المناسب للاتصال بكم إذا لزم الأمر؟"
    }
  ],
  "SuspiciousPerson": [
    {
      "name": "SuspiciousLocation",
      "required": true,
      "promptEn": "Where is this person right now — what's the address or nearest intersection?",
      "promptEs": "¿Dónde está esta persona ahora — cuál es la dirección o la intersección más cercana?",
      "promptZhCn": "这个人现在在哪里——地址或最近的路口？",
      "promptZhHk": "呢個人而家喺邊——地址定最近路口？",
      "promptTl": "Nasaan po ngayon ang tao — address o pinakamalapit na intersection?",
      "promptVi": "Người đó hiện ở đâu — địa chỉ hoặc ngã tư gần nhất?",
      "promptAr": "أين هذا الشخص الآن — العنوان أو أقرب تقاطع؟"
    },
    {
      "name": "PersonDescription",
      "required": true,
      "promptEn": "Can you describe the person? Things like what they're wearing, their approximate age, height, or anything that stands out.",
      "promptEs": "¿Puede describir a la persona? Por ejemplo, qué ropa lleva, su edad aproximada, estatura, o algo que llame la atención.",
      "promptZhCn": "能描述一下这个人吗？例如衣服、大概年龄、身高，或其他明显特征。",
      "promptZhHk": "可唔可以形容吓呢個人？例如衫、大概年紀、身高，或者其他特徵。",
      "promptTl": "Pwede niyo po bang ilarawan ang tao? Damit, edad, taas, o anumang kapansin-pansin.",
      "promptVi": "Bạn mô tả được người đó không? Ví dụ quần áo, tuổi, chiều cao, hoặc đặc điểm nổi bật.",
      "promptAr": "هل يمكنك وصف الشخص؟ الملابس أو العمر التقريبي أو الطول أو أي شيء مميز."
    },
    {
      "name": "PersonDirection",
      "required": true,
      "promptEn": "Do you know which direction they're heading, or are they still in the same spot?",
      "promptEs": "¿Sabe hacia dónde se dirigen, o siguen en el mismo lugar?",
      "promptZhCn": "知道他们往哪个方向走了吗，还是还在原地？",
      "promptZhHk": "知唔知佢哋行邊個方向，定仲喺度？",
      "promptTl": "Alam niyo po ba kung saan sila papunta, o nandoon pa sila?",
      "promptVi": "Bạn biết họ đi hướng nào không, hay vẫn ở chỗ cũ?",
      "promptAr": "هل تعرفون إلى أي اتجاه يذهبون، أم ما زالوا في نفس المكان؟"
    },
    {
      "name": "WeaponVisible",
      "required": true,
      "promptEn": "Have you seen any weapons — anything in their hands or visible on them?",
      "promptEs": "¿Ha visto algún arma — algo en sus manos o visible en ellos?",
      "promptZhCn": "有没有看到武器——手里或身上有没有？",
      "promptZhHk": "有冇見到武器——手定身上有冇？",
      "promptTl": "May nakitang armas po ba — sa kamay o nakikita sa kanila?",
      "promptVi": "Bạn có thấy vũ khí không — trên tay hoặc mang theo?",
      "promptAr": "هل رأيتم سلاحاً — في أيديهم أو ظاهراً عليهم؟"
    },
    {
      "name": "CallbackNumber",
      "required": true,
      "promptEn": "What's your callback number in case an officer needs to reach you?",
      "promptEs": "¿Cuál es su número de teléfono para que un oficial pueda contactarle?",
      "promptZhCn": "请留一个电话，方便警员联系您。",
      "promptZhHk": "請留個電話，方便警員搵你。",
      "promptTl": "Ano po ang callback number ninyo kung kailangan kayong tawagan ng opisyal?",
      "promptVi": "Số điện thoại nào để cảnh sát liên lạc với bạn?",
      "promptAr": "ما رقم هاتفكم ليتواصل الضابط معكم؟"
    },
    {
      "name": "CallerSafeLocation",
      "required": true,
      "promptEn": "Are you in a safe location right now?",
      "promptEs": "¿Está en un lugar seguro ahora mismo?",
      "promptZhCn": "您现在是否在安全的地方？",
      "promptZhHk": "你而家係咪喺安全嘅地方？",
      "promptTl": "Ligtas po ba ang kinaroroonan ninyo ngayon?",
      "promptVi": "Bạn hiện đang ở nơi an toàn chứ?",
      "promptAr": "هل أنتم في مكان آمن الآن؟"
    }
  ],
  "AbandonedVehicle": [
    {
      "name": "VehicleLocation",
      "required": true,
      "promptEn": "What's the address or nearest intersection where the vehicle is located?",
      "promptEs": "¿Cuál es la dirección o la intersección más cercana donde está el vehículo?",
      "promptZhCn": "车辆在哪个地址或最近的路口？",
      "promptZhHk": "架車喺邊個地址定最近路口？",
      "promptTl": "Ano po ang address o pinakamalapit na intersection kung nasaan ang sasakyan?",
      "promptVi": "Xe ở địa chỉ hoặc ngã tư nào?",
      "promptAr": "ما عنوان أو أقرب تقاطع لموقع المركبة؟"
    },
    {
      "name": "VehicleDescription",
      "required": true,
      "promptEn": "Can you describe the vehicle? Color, make or model if you know it, and any license plate?",
      "promptEs": "¿Puede describir el vehículo? Color, marca o modelo si lo sabe, y placa si es posible.",
      "promptZhCn": "能描述一下车辆吗？颜色、品牌或型号，以及车牌？",
      "promptZhHk": "可唔可以形容吓架車？顏色、牌子或者型號，同車牌？",
      "promptTl": "Pwede niyo po bang ilarawan ang sasakyan? Kulay, marca o modelo, at plaka kung meron.",
      "promptVi": "Bạn mô tả được xe không? Màu, hãng hoặc đời, và biển số nếu có.",
      "promptAr": "هل يمكنك وصف المركبة؟ اللون أو النوع ورقم اللوحة إن أمكن."
    },
    {
      "name": "HowLongAbandoned",
      "required": true,
      "promptEn": "About how long has the vehicle been there?",
      "promptEs": "¿Aproximadamente cuánto tiempo lleva el vehículo ahí?",
      "promptZhCn": "大概停了多久？",
      "promptZhHk": "大概停咗幾耐？",
      "promptTl": "Mga gaano na po katagal nandoon ang sasakyan?",
      "promptVi": "Xe đã ở đó khoảng bao lâu?",
      "promptAr": "منذ متى تقريباً والمركبة هناك؟"
    },
    {
      "name": "AbandonedVehicleHazard",
      "required": true,
      "promptEn": "Is the vehicle blocking traffic, a driveway, or a fire hydrant?",
      "promptEs": "¿El vehículo está bloqueando el tráfico, una entrada, o un hidrante?",
      "promptZhCn": "是否挡住交通、车道或消防栓？",
      "promptZhHk": "有冇擋住交通、車路或者消防栓？",
      "promptTl": "Hinaharang po ba nito ang trapiko, driveway, o fire hydrant?",
      "promptVi": "Xe có chắn đường, lối vào nhà, hoặc trụ cứu hỏa không?",
      "promptAr": "هل المركبة تعيق المرور أو المدخل أو صنبور الإطفاء؟"
    }
  ],
  "VehicleBurglary": [
    {
      "name": "BurglaryVehicleLocation",
      "required": true,
      "promptEn": "Where is your vehicle right now — what's the address?",
      "promptEs": "¿Dónde está su vehículo ahora — cuál es la dirección?",
      "promptZhCn": "您的车现在在哪个地址？",
      "promptZhHk": "你架車而家喺邊個地址？",
      "promptTl": "Nasaan po ngayon ang sasakyan — ano ang address?",
      "promptVi": "Xe của bạn hiện ở địa chỉ nào?",
      "promptAr": "أين مركبتكم الآن — ما العنوان؟"
    },
    {
      "name": "BurglaryVehicleDescription",
      "required": true,
      "promptEn": "What's the year, make, model, and color of your vehicle?",
      "promptEs": "¿Cuál es el año, marca, modelo y color de su vehículo?",
      "promptZhCn": "车辆的年份、品牌、型号和颜色？",
      "promptZhHk": "架車嘅年份、牌子、型號同顏色？",
      "promptTl": "Ano po ang year, make, model, at kulay ng sasakyan?",
      "promptVi": "Năm, hãng, đời và màu xe là gì?",
      "promptAr": "ما سنة ونوع ولون المركبة؟"
    },
    {
      "name": "BurglaryVehiclePlate",
      "required": true,
      "promptEn": "And the license plate number if you have it?",
      "promptEs": "¿Y el número de placa si lo tiene?",
      "promptZhCn": "车牌号是多少？",
      "promptZhHk": "車牌號碼係幾多？",
      "promptTl": "Ano po ang plaka kung meron kayo?",
      "promptVi": "Biển số xe nếu bạn có?",
      "promptAr": "ورقم اللوحة إن توفر؟"
    },
    {
      "name": "ItemsStolen",
      "required": true,
      "promptEn": "What was taken or what damage was done?",
      "promptEs": "¿Qué le robaron o qué daños hubo?",
      "promptZhCn": "偷了什么，或者造成了什么损坏？",
      "promptZhHk": "偷咗啲咩，或者有咩損壞？",
      "promptTl": "Ano po ang nakuha o anong sira ang nangyari?",
      "promptVi": "Lấy gì hoặc hư hại như thế nào?",
      "promptAr": "ما الذي سُرق أو ما الضرر الذي وقع؟"
    },
    {
      "name": "WhenOccurred",
      "required": true,
      "promptEn": "Do you know approximately when this happened?",
      "promptEs": "¿Sabe aproximadamente cuándo ocurrió esto?",
      "promptZhCn": "大概是什么时候发生的？",
      "promptZhHk": "大概幾時發生？",
      "promptTl": "Kailan po roughly nangyari ito?",
      "promptVi": "Khoảng khi nào việc này xảy ra?",
      "promptAr": "متى تقريباً حدث هذا؟"
    },
    {
      "name": "SuspectSeen",
      "required": true,
      "promptEn": "Did you see anyone in or near your vehicle?",
      "promptEs": "¿Vio a alguien dentro o cerca de su vehículo?",
      "promptZhCn": "有没有看到有人在车里或车附近？",
      "promptZhHk": "有冇見到有人喺車入面或者車附近？",
      "promptTl": "May nakita po ba kayong tao sa loob o malapit sa sasakyan?",
      "promptVi": "Bạn có thấy ai trong hoặc gần xe không?",
      "promptAr": "هل رأيتم أحداً داخل المركبة أو بالقرب منها؟"
    },
    {
      "name": "CallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?",
      "promptZhCn": "方便留一个最好联系的电话吗？",
      "promptZhHk": "方便留一個最好聯絡嘅電話嗎？",
      "promptTl": "Ano po ang pinakamainam na numero para tawagan kayo?",
      "promptVi": "Số nào tốt nhất để liên lạc với bạn?",
      "promptAr": "ما أفضل رقم للوصول إليكم؟"
    }
  ],
  "TheftReport": [
    {
      "name": "TheftLocation",
      "required": true,
      "promptEn": "Where did the theft occur?",
      "promptEs": "¿Dónde ocurrió el robo?",
      "promptZhCn": "盗窃发生在哪里？",
      "promptZhHk": "失竊喺邊度發生？",
      "promptTl": "Saan po nangyari ang nakaw?",
      "promptVi": "Vụ trộm xảy ra ở đâu?",
      "promptAr": "أين وقعت السرقة؟"
    },
    {
      "name": "TheftItemDescription",
      "required": true,
      "promptEn": "What was taken? Can you describe the items and their approximate value?",
      "promptEs": "¿Qué le robaron? ¿Puede describir los artículos y su valor aproximado?",
      "promptZhCn": "偷了什么？能描述物品和大概价值吗？",
      "promptZhHk": "偷咗啲咩？可唔可以形容吓同大概價值？",
      "promptTl": "Ano po ang kinuha? Pwede niyo po bang ilarawan at ang halaga?",
      "promptVi": "Lấy gì? Bạn mô tả món đồ và giá trị khoảng bao nhiêu?",
      "promptAr": "ما الذي سُرق؟ هل يمكن وصف الأغراض وقيمتها التقريبية؟"
    },
    {
      "name": "TheftWhenOccurred",
      "required": true,
      "promptEn": "When did this happen?",
      "promptEs": "¿Cuándo ocurrió?",
      "promptZhCn": "是什么时候发生的？",
      "promptZhHk": "幾時發生？",
      "promptTl": "Kailan po ito nangyari?",
      "promptVi": "Khi nào việc này xảy ra?",
      "promptAr": "متى حدث هذا؟"
    },
    {
      "name": "TheftSuspectInfo",
      "required": false,
      "promptEn": "Do you have any description of the person who took it, or did you see how they left?",
      "promptEs": "¿Tiene alguna descripción de la persona que lo tomó, o vio cómo se fueron?",
      "promptZhCn": "有没有嫌疑人的描述，或者看到他们怎么离开的？",
      "promptZhHk": "有冇疑犯描述，或者見到佢哋點走？",
      "promptTl": "May description po ba ng kumuha, o nakita niyo kung paano umalis?",
      "promptVi": "Bạn có mô tả người lấy không, hoặc thấy họ rời đi thế nào?",
      "promptAr": "هل لديكم وصف للشخص أو رأيتم كيف غادر؟"
    },
    {
      "name": "TheftCallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?",
      "promptZhCn": "方便留一个最好联系的电话吗？",
      "promptZhHk": "方便留一個最好聯絡嘅電話嗎？",
      "promptTl": "Ano po ang pinakamainam na numero para tawagan kayo?",
      "promptVi": "Số nào tốt nhất để liên lạc với bạn?",
      "promptAr": "ما أفضل رقم للوصول إليكم؟"
    }
  ],
  "ParkingComplaint": [
    {
      "name": "ParkingLocation",
      "required": true,
      "promptEn": "What's the address where the vehicle is illegally parked?",
      "promptEs": "¿Cuál es la dirección donde el vehículo está estacionado ilegalmente?",
      "promptZhCn": "违章停车的地址是哪里？",
      "promptZhHk": "違例泊車嘅地址喺邊？",
      "promptTl": "Ano po ang address kung saan ilegal ang paradahan?",
      "promptVi": "Địa chỉ xe đỗ trái phép là ở đâu?",
      "promptAr": "ما عنوان الموقف المخالف؟"
    },
    {
      "name": "ParkingVehicleDescription",
      "required": true,
      "promptEn": "Can you describe the vehicle — color, make, model, and license plate if you have it?",
      "promptEs": "¿Puede describir el vehículo — color, marca, modelo y placa si la tiene?",
      "promptZhCn": "能描述车辆吗——颜色、品牌、型号和车牌？",
      "promptZhHk": "可唔可以形容吓架車——顏色、牌子、型號同車牌？",
      "promptTl": "Pwede niyo po bang ilarawan ang sasakyan — kulay, marca, modelo, at plaka?",
      "promptVi": "Bạn mô tả được xe không — màu, hãng, đời và biển số?",
      "promptAr": "هل يمكنك وصف المركبة — اللون والنوع ورقم اللوحة؟"
    },
    {
      "name": "ParkingViolationType",
      "required": true,
      "promptEn": "What's the violation — blocking a driveway, fire hydrant, handicap spot, no parking zone, or something else?",
      "promptEs": "¿Cuál es la infracción — bloqueando una entrada, un hidrante, zona de discapacitados, zona de no estacionamiento, u otra?",
      "promptZhCn": "是什么违章——挡车道、消防栓、残障车位、禁停区，还是其他？",
      "promptZhHk": "係咩違例——擋車路、消防栓、殘障車位、禁停區，定其他？",
      "promptTl": "Anong violation po — driveway, fire hydrant, handicap, no parking, o iba?",
      "promptVi": "Vi phạm gì — chắn lối, trụ cứu hỏa, chỗ khuyết tật, cấm đỗ, hay khác?",
      "promptAr": "ما المخالفة — سد المدخل، صنبور إطفاء، موقف ذوي الإعاقة، ممنوع الوقوف، أم شيء آخر؟"
    }
  ],
  "WelfareCheck": [
    {
      "name": "WelfareCheckAddress",
      "required": true,
      "promptEn": "What's the address of the person you're concerned about?",
      "promptEs": "¿Cuál es la dirección de la persona por la que está preocupado?",
      "promptZhCn": "您担心的人住在哪个地址？",
      "promptZhHk": "你擔心嗰個人住邊個地址？",
      "promptTl": "Ano po ang address ng taong kinababahala ninyo?",
      "promptVi": "Địa chỉ người bạn lo lắng là ở đâu?",
      "promptAr": "ما عنوان الشخص الذي تقلقون عليه؟"
    },
    {
      "name": "WelfareCheckPersonName",
      "required": false,
      "promptEn": "What's the name of the person, if you know it?",
      "promptEs": "¿Cuál es el nombre de la persona, si lo sabe?",
      "promptZhCn": "如果知道，叫什么名字？",
      "promptZhHk": "如果知，叫咩名？",
      "promptTl": "Ano po ang pangalan kung alam ninyo?",
      "promptVi": "Tên người đó nếu bạn biết?",
      "promptAr": "ما اسم الشخص إن عرفتم؟"
    },
    {
      "name": "WelfareCheckRelationship",
      "required": true,
      "promptEn": "What's your relationship to this person — neighbor, family member, friend?",
      "promptEs": "¿Cuál es su relación con esta persona — vecino, familiar, amigo?",
      "promptZhCn": "您和这个人是什么关系——邻居、家人、朋友？",
      "promptZhHk": "你同呢個人係咩關係——鄰居、家人、朋友？",
      "promptTl": "Ano po ang relasyon ninyo — kapitbahay, pamilya, o kaibigan?",
      "promptVi": "Bạn quan hệ gì với người đó — hàng xóm, gia đình, bạn?",
      "promptAr": "ما صلتكم بهذا الشخص — جار، أهل، صديق؟"
    },
    {
      "name": "WelfareCheckLastContact",
      "required": true,
      "promptEn": "When did you last have contact with them?",
      "promptEs": "¿Cuándo fue la última vez que tuvo contacto con ellos?",
      "promptZhCn": "上次联系是什么时候？",
      "promptZhHk": "上一次聯絡係幾時？",
      "promptTl": "Kailan po last na nakausap o nakita ninyo sila?",
      "promptVi": "Lần liên lạc gần nhất là khi nào?",
      "promptAr": "متى كان آخر تواصل معهم؟"
    },
    {
      "name": "WelfareCheckWhyConcerned",
      "required": true,
      "promptEn": "Can you tell me why you're concerned? Is there anything specific that made you call today?",
      "promptEs": "¿Puede decirme por qué está preocupado? ¿Hay algo específico que le hizo llamar hoy?",
      "promptZhCn": "为什么担心？今天有什么特别情况让您打电话？",
      "promptZhHk": "點解擔心？今日有咩特別令你打電話？",
      "promptTl": "Bakit po kayo nag-aalala? May specific bang dahilan ngayon?",
      "promptVi": "Vì sao bạn lo? Có gì cụ thể khiến bạn gọi hôm nay?",
      "promptAr": "لماذا أنتم قلقون؟ هل هناك شيء محدد دفعكم للاتصال اليوم؟"
    },
    {
      "name": "WelfareCheckCallerCallback",
      "required": true,
      "promptEn": "And what's the best number to reach you?",
      "promptEs": "¿Y cuál es el mejor número para contactarle?",
      "promptZhCn": "方便留一个最好联系的电话吗？",
      "promptZhHk": "方便留一個最好聯絡嘅電話嗎？",
      "promptTl": "Ano po ang pinakamainam na numero para tawagan kayo?",
      "promptVi": "Số nào tốt nhất để liên lạc với bạn?",
      "promptAr": "ما أفضل رقم للوصول إليكم؟"
    }
  ],
  "AnimalComplaint": [
    {
      "name": "AnimalLocation",
      "required": true,
      "promptEn": "Where is the animal right now?",
      "promptEs": "¿Dónde está el animal ahora mismo?",
      "promptZhCn": "动物现在在哪里？",
      "promptZhHk": "隻動物而家喺邊？",
      "promptTl": "Nasaan po ngayon ang hayop?",
      "promptVi": "Con vật hiện ở đâu?",
      "promptAr": "أين الحيوان الآن؟"
    },
    {
      "name": "AnimalType",
      "required": true,
      "promptEn": "What kind of animal is it — a dog, cat, or something else?",
      "promptEs": "¿Qué tipo de animal es — un perro, gato, u otro?",
      "promptZhCn": "是什么动物——狗、猫，还是其他？",
      "promptZhHk": "係咩動物——狗、貓，定其他？",
      "promptTl": "Anong hayop po — aso, pusa, o iba?",
      "promptVi": "Loại động vật gì — chó, mèo, hay khác?",
      "promptAr": "ما نوع الحيوان — كلب، قط، أم شيء آخر؟"
    },
    {
      "name": "AnimalThreatLevel",
      "required": true,
      "promptEn": "Is the animal injured, aggressive, or acting threatening? Or is it more of a stray or nuisance situation?",
      "promptEs": "¿El animal está herido, es agresivo, o amenazante? ¿O es más un animal callejero o una molestia?",
      "promptZhCn": "动物是受伤、有攻击性，还是走失或扰民？",
      "promptZhHk": "隻動物係受傷、有攻擊性，定走失或者滋擾？",
      "promptTl": "Injured po ba, agresibo, astray, o nuisance lang?",
      "promptVi": "Con vật bị thương, hung dữ, đi lạc, hay chỉ gây phiền?",
      "promptAr": "هل الحيوان مصاب أو عدواني أو ضال أو مجرد إزعاج؟"
    }
  ],
  "TowComplaint": [
    {
      "name": "TowLocation",
      "required": true,
      "promptEn": "Where was your vehicle when it was towed from?",
      "promptEs": "¿De dónde se llevaron su vehículo?",
      "promptZhCn": "车辆是从哪里被拖走的？",
      "promptZhHk": "架車係由邊度拖走？",
      "promptTl": "Saan po kinuha ang sasakyan nung tinow?",
      "promptVi": "Xe bị kéo từ đâu?",
      "promptAr": "من أين سُحبت المركبة؟"
    },
    {
      "name": "TowVehicleDescription",
      "required": true,
      "promptEn": "What's the year, make, model, color, and license plate of your vehicle?",
      "promptEs": "¿Cuál es el año, marca, modelo, color y placa de su vehículo?",
      "promptZhCn": "车辆的年份、品牌、型号、颜色和车牌？",
      "promptZhHk": "架車嘅年份、牌子、型號、顏色同車牌？",
      "promptTl": "Ano po ang year, make, model, kulay, at plaka?",
      "promptVi": "Năm, hãng, đời, màu và biển số xe?",
      "promptAr": "ما سنة ونوع ولون ورقم لوحة المركبة؟"
    },
    {
      "name": "TowCompanyInfo",
      "required": false,
      "promptEn": "Do you know the name of the tow company, or did you see the truck?",
      "promptEs": "¿Sabe el nombre de la empresa de grúa, o vio el camión?",
      "promptZhCn": "知道拖车公司的名字吗，或者看到拖车了吗？",
      "promptZhHk": "知唔知拖車公司名，定見到拖車？",
      "promptTl": "Alam niyo po ba ang tow company, o nakita ninyo ang trak?",
      "promptVi": "Bạn biết tên công ty kéo xe không, hoặc thấy xe kéo?",
      "promptAr": "هل تعرفون اسم شركة السحب أو رأيتم الشاحنة؟"
    },
    {
      "name": "TowCallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?",
      "promptZhCn": "方便留一个最好联系的电话吗？",
      "promptZhHk": "方便留一個最好聯絡嘅電話嗎？",
      "promptTl": "Ano po ang pinakamainam na numero para tawagan kayo?",
      "promptVi": "Số nào tốt nhất để liên lạc với bạn?",
      "promptAr": "ما أفضل رقم للوصول إليكم؟"
    }
  ],
  "VandalismDamage": [
    {
      "name": "VandalismLocation",
      "required": true,
      "promptEn": "What's the address of the property that was damaged?",
      "promptEs": "¿Cuál es la dirección de la propiedad que fue dañada?",
      "promptZhCn": "被损坏财产的地址是哪里？",
      "promptZhHk": "被損壞財產嘅地址喺邊？",
      "promptTl": "Ano po ang address ng nasirang ari-arian?",
      "promptVi": "Địa chỉ tài sản bị hư là ở đâu?",
      "promptAr": "ما عنوان العقار المتضرر؟"
    },
    {
      "name": "VandalismDescription",
      "required": true,
      "promptEn": "What was damaged and how?",
      "promptEs": "¿Qué fue dañado y cómo?",
      "promptZhCn": "损坏了什么，怎么损坏的？",
      "promptZhHk": "整壞咗啲咩，點整壞？",
      "promptTl": "Ano po ang nasira at paano?",
      "promptVi": "Cái gì bị hư và hư như thế nào?",
      "promptAr": "ما الذي تضرر وكيف؟"
    },
    {
      "name": "VandalismWhenOccurred",
      "required": true,
      "promptEn": "When did you discover the damage?",
      "promptEs": "¿Cuándo descubrió el daño?",
      "promptZhCn": "您是什么时候发现损坏的？",
      "promptZhHk": "你幾時發現損壞？",
      "promptTl": "Kailan po ninyo nalaman ang sira?",
      "promptVi": "Bạn phát hiện hư hại khi nào?",
      "promptAr": "متى اكتشفتم الضرر؟"
    },
    {
      "name": "VandalismSuspectInfo",
      "required": false,
      "promptEn": "Did you see anyone do this or do you have any idea who's responsible?",
      "promptEs": "¿Vio a alguien hacerlo o sabe quién pudo ser responsable?",
      "promptZhCn": "有没有看到是谁干的，或者知道可能是谁？",
      "promptZhHk": "有冇見到邊個做，定知可能係邊個？",
      "promptTl": "Nakita niyo po ba kung sino, o may idea kung sino ang may gawa?",
      "promptVi": "Bạn có thấy ai làm không, hoặc biết ai có thể chịu trách nhiệm?",
      "promptAr": "هل رأيتم من فعل ذلك أو لديكم فكرة عن المسؤول؟"
    }
  ],
  "CodeEnforcementComplaint": [
    {
      "name": "CodeEnforcementAddress",
      "required": true,
      "promptEn": "What's the address of the property?",
      "promptEs": "¿Cuál es la dirección de la propiedad?",
      "promptZhCn": "该物业的地址是哪里？",
      "promptZhHk": "嗰個物業嘅地址喺邊？",
      "promptTl": "Ano po ang address ng property?",
      "promptVi": "Địa chỉ bất động sản đó là ở đâu?",
      "promptAr": "ما عنوان العقار؟"
    },
    {
      "name": "CodeViolationDescription",
      "required": true,
      "promptEn": "What's the violation? For example, high grass, trash, junk cars, or something else?",
      "promptEs": "¿Cuál es la infracción? Por ejemplo, pasto alto, basura, carros en desuso, u otra cosa?",
      "promptZhCn": "是什么违规？例如杂草、垃圾、报废车，或其他？",
      "promptZhHk": "係咩違規？例如高草、垃圾、廢車，定其他？",
      "promptTl": "Ano po ang violation — mataas na damo, basura, junk cars, o iba?",
      "promptVi": "Vi phạm gì — cỏ cao, rác, xe phế, hay khác?",
      "promptAr": "ما المخالفة؟ عشب طويل أو قمامة أو سيارات تالفة أو شيء آخر؟"
    }
  ],
  "PublicWorksIssue": [
    {
      "name": "PublicWorksLocation",
      "required": true,
      "promptEn": "What's the location — address or nearest intersection?",
      "promptEs": "¿Cuál es la ubicación — dirección o intersección más cercana?",
      "promptZhCn": "地点是哪里——地址或最近的路口？",
      "promptZhHk": "地點喺邊——地址定最近路口？",
      "promptTl": "Saan po — address o pinakamalapit na intersection?",
      "promptVi": "Vị trí ở đâu — địa chỉ hoặc ngã tư gần nhất?",
      "promptAr": "ما الموقع — العنوان أو أقرب تقاطع؟"
    },
    {
      "name": "PublicWorksIssueType",
      "required": true,
      "promptEn": "What's the issue — a water main, pothole, traffic light, streetlight, or something else?",
      "promptEs": "¿Cuál es el problema — tubería, bache, semáforo, luz de calle, u otra cosa?",
      "promptZhCn": "是什么问题——水管、坑洼、红绿灯、路灯，还是其他？",
      "promptZhHk": "係咩問題——水管、坑、紅綠燈、路燈，定其他？",
      "promptTl": "Ano po ang problema — tubo ng tubig, butas sa daan, traffic light, streetlight, o iba?",
      "promptVi": "Vấn đề gì — ống nước, ổ gà, đèn giao thông, đèn đường, hay khác?",
      "promptAr": "ما المشكلة — أنبوب ماء، حفرة، إشارة، إنارة، أم شيء آخر؟"
    }
  ],
  "TrafficAccidentReportOnly": [
    {
      "name": "AccidentLocation",
      "required": true,
      "promptEn": "Where did the accident happen?",
      "promptEs": "¿Dónde ocurrió el accidente?",
      "promptZhCn": "事故发生在哪里？",
      "promptZhHk": "意外喺邊度發生？",
      "promptTl": "Saan po nangyari ang aksidente?",
      "promptVi": "Tai nạn xảy ra ở đâu?",
      "promptAr": "أين وقع الحادث؟"
    },
    {
      "name": "AccidentWhen",
      "required": true,
      "promptEn": "When did it happen?",
      "promptEs": "¿Cuándo ocurrió?",
      "promptZhCn": "是什么时候发生的？",
      "promptZhHk": "幾時發生？",
      "promptTl": "Kailan po ito nangyari?",
      "promptVi": "Khi nào xảy ra?",
      "promptAr": "متى حدث؟"
    },
    {
      "name": "AccidentInjuries",
      "required": true,
      "promptEn": "Were there any injuries?",
      "promptEs": "¿Hubo heridos?",
      "promptZhCn": "有没有人受伤？",
      "promptZhHk": "有冇人受傷？",
      "promptTl": "May nasugatan po ba?",
      "promptVi": "Có ai bị thương không?",
      "promptAr": "هل هناك إصابات؟"
    },
    {
      "name": "OtherVehicleDescription",
      "required": false,
      "promptEn": "Can you describe the other vehicle involved, if there was one?",
      "promptEs": "¿Puede describir el otro vehículo involucrado, si hubo alguno?",
      "promptZhCn": "如果有另一辆车，能描述一下吗？",
      "promptZhHk": "如果有另一架車，可唔可以形容吓？",
      "promptTl": "Pwede niyo po bang ilarawan ang kabilang sasakyan kung meron?",
      "promptVi": "Nếu có xe khác, bạn mô tả được không?",
      "promptAr": "هل يمكن وصف المركبة الأخرى إن وجدت؟"
    },
    {
      "name": "AccidentCallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?",
      "promptZhCn": "方便留一个最好联系的电话吗？",
      "promptZhHk": "方便留一個最好聯絡嘅電話嗎？",
      "promptTl": "Ano po ang pinakamainam na numero para tawagan kayo?",
      "promptVi": "Số nào tốt nhất để liên lạc với bạn?",
      "promptAr": "ما أفضل رقم للوصول إليكم؟"
    }
  ],
  "OnlineReportEligibility": [],
  "RepeatCallCheck": [
    {
      "name": "PriorReferenceNumber",
      "required": false,
      "promptEn": "Do you have a reference number from your earlier call?",
      "promptEs": "¿Tiene un número de referencia de su llamada anterior?",
      "promptZhCn": "您之前的电话有编号吗？",
      "promptZhHk": "你之前嘅電話有冇編號？",
      "promptTl": "May reference number po ba kayo mula sa naunang tawag?",
      "promptVi": "Bạn có số hồ sơ từ lần gọi trước không?",
      "promptAr": "هل لديكم رقم مرجع من الاتصال السابق؟"
    },
    {
      "name": "PriorCallbackNumber",
      "required": false,
      "promptEn": "What phone number did you call from before, so we can look up your report?",
      "promptEs": "¿Desde qué número llamó antes para que podamos buscar su reporte?",
      "promptZhCn": "之前是用哪个号码打的，方便查找记录？",
      "promptZhHk": "之前係用邊個號碼打，方便搵紀錄？",
      "promptTl": "Anong numero po ang ginamit ninyo kanina para mahanap namin ang report?",
      "promptVi": "Số điện thoại lần trước bạn gọi là số nào để chúng tôi tra hồ sơ?",
      "promptAr": "من أي رقم اتصلتم سابقاً لنبحث عن البلاغ؟"
    }
  ],
  "InformationRequest": [
    {
      "name": "InformationTopic",
      "required": true,
      "promptEn": "Sure — what do you need information about?",
      "promptEs": "Claro — ¿sobre qué necesita información?",
      "promptZhCn": "好的——您需要了解什么？",
      "promptZhHk": "好——你需要了解啲咩？",
      "promptTl": "Sige po — tungkol saan ang kailangan ninyong impormasyon?",
      "promptVi": "Được — bạn cần thông tin về việc gì?",
      "promptAr": "حسناً — عن أي موضوع تحتاجون معلومات؟"
    }
  ],
  "FallbackIntent": []
};

export const LEX_SPEC_LOCATION_SLOT_NAMES = ["location", "building", "section", "NoiseLocation", "SuspiciousLocation", "CallerSafeLocation", "VehicleLocation", "BurglaryVehicleLocation", "TheftLocation", "ParkingLocation", "WelfareCheckAddress", "AnimalLocation", "TowLocation", "VandalismLocation", "CodeEnforcementAddress", "PublicWorksLocation", "AccidentLocation"] as const;

export const LEX_SPEC_CALLBACK_SLOT_NAMES = ["callbackNumber", "CallbackNumber", "TheftCallbackNumber", "WelfareCheckCallerCallback", "TowCallbackNumber", "AccidentCallbackNumber", "PriorCallbackNumber"] as const;

export const LEX_SPEC_CONFIRMATION_INTENTS = new Set<string>(
  ["NoiseComplaint", "SuspiciousPerson", "AbandonedVehicle", "VehicleBurglary", "TheftReport", "ParkingComplaint", "WelfareCheck", "AnimalComplaint", "TowComplaint", "VandalismDamage", "CodeEnforcementComplaint", "TrafficAccidentReportOnly"],
);
