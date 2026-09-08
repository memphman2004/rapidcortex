# RCCallAssistBot — Complete Lex V2 Build Specification
## `RCCallAssistBot-dev` · `IJIBJOJG2L` · alias `live-dev` / `0CNPVSCF4V`
## Locales: `en_US` (Ruth, neural) · `es_US` (Lupe, neural)

---

## HOW TO USE THIS DOCUMENT

Each intent section contains:
- **Trigger utterances** — paste directly into the Lex Console "Sample utterances" field
- **Slots** — required information to collect, in collection order
- **Slot prompts** — exact text Lex speaks when eliciting each slot
- **Confirmation prompt** — what the bot reads back before fulfillment
- **Closing response** — what the bot says after Lambda fulfillment returns

All `{SlotName}` references use Lex V2 slot reference syntax.

All intents route to the fulfillment Lambda: `RCCallAssistFulfillment-dev`.

---

## GLOBAL DESIGN RULES

1. **Emergency utterances on EmergencyEscalation carry highest intent priority.** In Lex V2 Console: set EmergencyEscalation to priority 1. Do not put emergency phrases on other intents.

2. **Every intent includes a "request human" escape.** Utterances like "let me talk to someone" and "I want to speak to an officer" are on the `RequestHuman` intent and override all slot collection mid-conversation.

3. **Confirmation is mandatory before Lambda fires.** Every non-emergency intent uses confirmation so the bot reads back what it collected. Caller confirms or corrects before the incident is created.

4. **Voice is conversational, not robotic.** Prompts are written as Ruth/Lupe would naturally speak — contractions allowed, short sentences preferred.

5. **SSML breaks** — use `<break time="300ms"/>` between key information in confirmations to give callers time to process. These are written in the prompts below.

---

## INTENT PRIORITY ORDER (set in Lex V2 Console)

```
Priority 1  → EmergencyEscalation
Priority 2  → RequestHuman
Priority 3  → SuspiciousPerson        (weapons mentions make this second-highest risk)
Priority 4  → WelfareCheck
Priority 5  → VehicleBurglary
Priority 6  → TheftReport
Priority 7  → AbandonedVehicle
Priority 8  → NoiseComplaint
Priority 9  → ParkingComplaint
Priority 10 → TowComplaint
Priority 11 → TrafficAccidentReportOnly
Priority 12 → VandalismDamage
Priority 13 → AnimalComplaint
Priority 14 → CodeEnforcementComplaint
Priority 15 → PublicWorksIssue
Priority 16 → OnlineReportEligibility
Priority 17 → RepeatCallCheck
Priority 18 → InformationRequest
Priority 19 → FallbackIntent
```

---

## SLOT TYPES (define once, reuse across intents)

### `LocationAddress`
Type: Custom | Resolution strategy: Top resolution
Values: free-form address, intersection, landmark, business name
Used by: all incident intents

### `VehicleColor`
Type: Custom | Add synonyms for each color
- Red: red, crimson, maroon, dark red, bright red
- Blue: blue, navy, dark blue, light blue, sky blue, royal blue
- Black: black, dark, jet black
- White: white, cream, off-white, pearl
- Silver: silver, gray, grey, metallic
- Green: green, olive, dark green, forest green
- Gold: gold, tan, beige, champagne
- Brown: brown, bronze, copper, rust

### `VehicleType`
Type: Custom
- car, sedan, coupe, convertible
- truck, pickup, pickup truck
- SUV, crossover, van, minivan
- motorcycle, bike, moped, scooter
- semi, eighteen-wheeler, box truck, delivery truck

### `IncidentTimeframe`
Type: Custom
- right now, happening now, currently, still going on
- just happened, a few minutes ago, minutes ago, just now
- about an hour ago, earlier today, this morning, this afternoon, tonight
- yesterday, last night, a while ago, not sure, I don't know

---

## INTENT 1: `EmergencyEscalation`
**Priority: 1 — fires before any other intent. Lambda routes to Demo Dispatcher queue.**

### Sample Utterances — English
```
someone is shooting
there's a shooter
shots fired
active shooter
he has a gun
she has a gun
they have a gun
there's a gun
he's pointing a gun at me
help me
I need help right now
there's a stabbing
he stabbed someone
she's not breathing
he's not breathing
someone is unconscious
there's a fire
call 911
this is an emergency
send police right now
there's a dead body
someone is being attacked
they're trying to kill me
I'm being robbed right now
he's going to hurt me
domestic violence happening right now
he's hitting her
someone is drowning
there's been an explosion
I can smell gas
gas leak
she just collapsed
he just collapsed
they're breaking in right now
someone is breaking into my house
home invasion
car crash with injuries
the car is on fire
I need an ambulance right now
medical emergency
heart attack
someone is having a seizure
I think he has a weapon
she threatened to kill me
he threatened to shoot
they have a knife
```

### Sample Utterances — Spanish (es_US)
```
hay un tiroteo
alguien está disparando
disparos
hay una pistola
él tiene un arma
me está atacando
ayuda
necesito ayuda ahora
hay un incendio
alguien está inconsciente
no está respirando
llamen al novecientos once
es una emergencia
hay un cuerpo
me están robando
violencia doméstica
me está golpeando
se está ahogando
huele a gas
accidente con heridos
infarto
está convulsionando
me amenazó con matarme
tiene un cuchillo
```

### Fulfillment
Lambda receives: `intentName: "EmergencyEscalation"`
Action: Immediately set contact attribute `emergency=true`, route to dispatcher queue.
Do NOT speak a confirmation prompt. Transfer is immediate.

---

## INTENT 2: `RequestHuman`
**Priority: 2 — caller explicitly wants a person at any point.**

### Sample Utterances — English
```
let me talk to someone
I want to speak to an officer
can I talk to a real person
transfer me to a dispatcher
I need a dispatcher
give me a human
I don't want to talk to a machine
I need to talk to someone
can you transfer me
connect me to dispatch
operator
talk to someone real
I'd rather talk to a person
```

### Sample Utterances — Spanish
```
quiero hablar con alguien
pásame con una persona
quiero hablar con un oficial
necesito un despachador
transfiérame
con una persona real
no quiero hablar con una máquina
```

### Prompt (no slots needed)
```
Of course. I'm connecting you to a Kansas City Police officer now. Stay on the line.
```

### Fulfillment
Lambda: transfer to human queue. No confirmation. No slots.

---

## INTENT 3: `NoiseComplaint`
**Most common non-emergency call type. Collect address and noise type before confirming.**

### Sample Utterances — English
```
my neighbor is being too loud
there's too much noise
noise complaint
it's really loud outside
there's a loud party
my neighbor won't turn down the music
someone is playing loud music
there's a party going on
people are being loud
there's a loud gathering
someone is making a lot of noise
neighbors are loud
the music is too loud
the bass is shaking my walls
people are yelling outside
there's screaming outside
they've been loud for hours
this has been going on all night
fireworks in the neighborhood
someone is setting off fireworks
loud engine running outside
car alarm going off
dog won't stop barking
there's a dog barking constantly
there's noise outside my apartment
loud motorcycle
```

### Sample Utterances — Spanish
```
mis vecinos hacen mucho ruido
hay una fiesta muy ruidosa
queja de ruido
la música está muy alta
están haciendo mucho escándalo
hay gritos afuera
la fiesta sigue y no para
los vecinos tienen el estéreo muy alto
el perro no deja de ladrar
hay cohetes en el vecindario
alguien tiene el carro con la música muy fuerte
```

### Slots

**Slot 1: `NoiseLocation`** (type: LocationAddress)
Prompt EN: `What's the address or location of the noise?`
Prompt ES: `¿Cuál es la dirección o el lugar donde está el ruido?`

**Slot 2: `NoiseType`** (type: Custom — noise descriptor)
Prompt EN: `What kind of noise is it — music, people yelling, a party, something else?`
Prompt ES: `¿Qué tipo de ruido es — música, gritos, una fiesta, o algo más?`

**Slot 3: `NoiseStillHappening`** (type: AMAZON.Confirmation)
Prompt EN: `Is the noise still happening right now?`
Prompt ES: `¿El ruido todavía está ocurriendo ahora mismo?`

**Slot 4: `CallbackNumber`** (type: AMAZON.PhoneNumber — optional)
Prompt EN: `And what's a good callback number in case we need to reach you?`
Prompt ES: `¿Y cuál es un número de teléfono para contactarle si es necesario?`

### Confirmation Prompt
EN: `Just to confirm — I have a noise complaint at <break time="300ms"/> {NoiseLocation}, <break time="200ms"/> {NoiseType}, <break time="200ms"/> and it's {NoiseStillHappening, values: ["Yes": "still happening", "No": "no longer happening"]}. Is that right?`

ES: `Para confirmar — tengo una queja de ruido en <break time="300ms"/> {NoiseLocation}, <break time="200ms"/> {NoiseType}, <break time="200ms"/> y {NoiseStillHappening, values: ["Yes": "todavía está ocurriendo", "No": "ya no está ocurriendo"]}. ¿Es correcto?`

### Closing Response (after Lambda)
EN: `I've created a report for Kansas City Police. An officer will follow up. Your reference number is {referenceNumber}. Is there anything else I can help you with?`
ES: `He creado un reporte para la Policía de Kansas City. Un oficial hará seguimiento. Su número de referencia es {referenceNumber}. ¿Hay algo más en que pueda ayudarle?`

---

## INTENT 4: `SuspiciousPerson`
**High priority. Collect location and description. Watch for weapon mentions mid-conversation — Lambda must check every turn for escalation signals.**

### Sample Utterances — English
```
there's a suspicious person
someone looks suspicious
there's a guy acting weird
there's a strange person
someone is lurking
suspicious male
suspicious female
there's someone walking around looking in cars
a person is peering into windows
someone is casing houses
there's a man watching kids
suspicious activity
someone doesn't belong here
there's a person who looks out of place
someone is hanging around
someone is just sitting there watching
there's a sketchy person
person acting strangely
someone is following me
I think someone is following my car
there's a person I don't recognize acting oddly
someone is trying to break into a car
person looks like they're on drugs
someone is wandering around confused
there's a man yelling at people
a person is making people uncomfortable
```

### Sample Utterances — Spanish
```
hay una persona sospechosa
alguien actúa de manera extraña
hay un hombre mirando por las ventanas
una persona sospechosa merodeando
alguien que no pertenece aquí
hay alguien muy raro afuera
me están siguiendo
un hombre está siguiendo a los niños
alguien está viendo los carros
comportamiento sospechoso
hay alguien acechando
```

### Slots

**Slot 1: `SuspiciousLocation`** (type: LocationAddress)
Prompt EN: `Where is this person right now — what's the address or nearest intersection?`
Prompt ES: `¿Dónde está esta persona ahora — cuál es la dirección o la intersección más cercana?`

**Slot 2: `PersonDescription`** (type: free text via AMAZON.AlphaNumeric — Lambda extracts structured fields)
Prompt EN: `Can you describe the person? Things like what they're wearing, their approximate age, height, or anything that stands out.`
Prompt ES: `¿Puede describir a la persona? Por ejemplo, qué ropa lleva, su edad aproximada, estatura, o algo que llame la atención.`

**Slot 3: `PersonDirection`** (type: AMAZON.AlphaNumeric — direction of travel)
Prompt EN: `Do you know which direction they're heading, or are they still in the same spot?`
Prompt ES: `¿Sabe hacia dónde se dirigen, o siguen en el mismo lugar?`

**Slot 4: `WeaponVisible`** (type: AMAZON.Confirmation)
Prompt EN: `Have you seen any weapons — anything in their hands or visible on them?`
Prompt ES: `¿Ha visto algún arma — algo en sus manos o visible en ellos?`

*If WeaponVisible = Yes → Lambda fires EmergencyEscalation transfer immediately. Do not collect more slots.*

**Slot 5: `CallbackNumber`** (type: AMAZON.PhoneNumber)
Prompt EN: `What's your callback number in case an officer needs to reach you?`
Prompt ES: `¿Cuál es su número de teléfono para que un oficial pueda contactarle?`

**Slot 6: `CallerSafeLocation`** (type: AMAZON.Confirmation)
Prompt EN: `Are you in a safe location right now?`
Prompt ES: `¿Está en un lugar seguro ahora mismo?`

### Confirmation Prompt
EN: `I have a suspicious person at <break time="300ms"/> {SuspiciousLocation}. <break time="200ms"/> Description: {PersonDescription}. <break time="200ms"/> Direction: {PersonDirection}. <break time="200ms"/> Does that sound right?`

### Closing Response
EN: `I've sent this to Kansas City Police. Officers will be looking out for this person. Please stay in a safe location and call back if anything changes. Your reference number is {referenceNumber}.`

---

## INTENT 5: `AbandonedVehicle`

### Sample Utterances — English
```
there's an abandoned car
abandoned vehicle
a car has been sitting here for days
this car hasn't moved in a week
there's a car that's been parked here forever
I want to report an abandoned vehicle
there's a car with no plates
a car has flat tires and looks abandoned
someone left their car here
there's a car that's been here for over 24 hours
abandoned truck
abandoned motorcycle
this vehicle looks like nobody owns it
car has been here for three days
junk car sitting on the street
can you tow this abandoned car
```

### Sample Utterances — Spanish
```
hay un carro abandonado
quiero reportar un vehículo abandonado
un carro lleva días aquí
este carro no se ha movido
hay un carro sin placas
alguien dejó su carro aquí
un carro abandonado en la calle
```

### Slots

**Slot 1: `VehicleLocation`** (type: LocationAddress)
Prompt EN: `What's the address or nearest intersection where the vehicle is located?`
Prompt ES: `¿Cuál es la dirección o la intersección más cercana donde está el vehículo?`

**Slot 2: `VehicleDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `Can you describe the vehicle? Color, make or model if you know it, and any license plate?`
Prompt ES: `¿Puede describir el vehículo? Color, marca o modelo si lo sabe, y placa si es posible.`

**Slot 3: `HowLongAbandoned`** (type: IncidentTimeframe)
Prompt EN: `About how long has the vehicle been there?`
Prompt ES: `¿Aproximadamente cuánto tiempo lleva el vehículo ahí?`

**Slot 4: `AbandonedVehicleHazard`** (type: AMAZON.Confirmation)
Prompt EN: `Is the vehicle blocking traffic, a driveway, or a fire hydrant?`
Prompt ES: `¿El vehículo está bloqueando el tráfico, una entrada, o un hidrante?`

### Confirmation Prompt
EN: `I have an abandoned vehicle at <break time="300ms"/> {VehicleLocation}. <break time="200ms"/> {VehicleDescription}, <break time="200ms"/> there approximately {HowLongAbandoned}. Is that correct?`

### Closing Response
EN: `I've reported this to Kansas City Police. Depending on how long the vehicle has been there, an officer may be able to arrange a tow. Your reference number is {referenceNumber}.`

---

## INTENT 6: `VehicleBurglary`

### Sample Utterances — English
```
someone broke into my car
my car was broken into
car break-in
my window was smashed
someone smashed my car window
stuff was stolen from my car
my car was burglarized
items were taken from my vehicle
someone went through my car
my car got broken into last night
car burglary
theft from vehicle
they broke my car window
my car was vandalized and stuff was taken
someone stole things from my car
my radio was stolen
my laptop was stolen from my car
my car was ransacked
```

### Sample Utterances — Spanish
```
rompieron el vidrio de mi carro
me entraron al carro
me robaron cosas del carro
mi carro fue robado
alguien abrió mi carro
me rompieron la ventana del carro
me robaron del carro
entraron a mi vehículo
```

### Slots

**Slot 1: `BurglaryVehicleLocation`** (type: LocationAddress)
Prompt EN: `Where is your vehicle right now — what's the address?`
Prompt ES: `¿Dónde está su vehículo ahora — cuál es la dirección?`

**Slot 2: `BurglaryVehicleDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What's the year, make, model, and color of your vehicle?`
Prompt ES: `¿Cuál es el año, marca, modelo y color de su vehículo?`

**Slot 3: `BurglaryVehiclePlate`** (type: AMAZON.AlphaNumeric)
Prompt EN: `And the license plate number if you have it?`
Prompt ES: `¿Y el número de placa si lo tiene?`

**Slot 4: `ItemsStolen`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What was taken or what damage was done?`
Prompt ES: `¿Qué le robaron o qué daños hubo?`

**Slot 5: `WhenOccurred`** (type: IncidentTimeframe)
Prompt EN: `Do you know approximately when this happened?`
Prompt ES: `¿Sabe aproximadamente cuándo ocurrió esto?`

**Slot 6: `SuspectSeen`** (type: AMAZON.Confirmation)
Prompt EN: `Did you see anyone in or near your vehicle?`
Prompt ES: `¿Vio a alguien dentro o cerca de su vehículo?`

**Slot 7: `CARFAXCheck`** — Lambda evaluates eligibility; bot does not ask
*Lambda checks: vehicle identified + items stolen + non-injury + historical. If eligible, Lambda sends CARFAX SMS link.*

**Slot 8: `CallbackNumber`** (type: AMAZON.PhoneNumber)
Prompt EN: `What's the best number to reach you?`
Prompt ES: `¿Cuál es el mejor número para contactarle?`

### Confirmation Prompt
EN: `I have a vehicle burglary. Your {BurglaryVehicleDescription} at <break time="300ms"/> {BurglaryVehicleLocation}. <break time="200ms"/> Items taken: {ItemsStolen}. <break time="200ms"/> Is that right?`

### Closing Response
EN: `I've created a police report. {carfaxMessage} Your reference number is {referenceNumber}. An officer will be in touch at {CallbackNumber}.`
*(carfaxMessage is injected by Lambda: "Your vehicle may be eligible for online reporting through CarFax — I've sent a link to your phone." or empty string)*

---

## INTENT 7: `TheftReport`
**Non-vehicle theft. Covers shoplifting, package theft, property theft.**

### Sample Utterances — English
```
I want to report a theft
someone stole from me
I was robbed
my property was stolen
someone stole my package
package was stolen from my porch
porch pirate
someone took my bike
my bicycle was stolen
shoplifting
someone shoplifted from my store
employee theft
theft at a business
my purse was snatched
my wallet was stolen
something was taken from me
I'd like to file a theft report
can I report stolen property
someone took my phone
my phone was stolen
theft of services
```

### Sample Utterances — Spanish
```
quiero reportar un robo
me robaron
alguien me robó
me robaron el paquete
me robaron la bicicleta
robo en una tienda
alguien me robó la bolsa
me robaron el teléfono
me robaron la cartera
quiero hacer un reporte de robo
```

### Slots

**Slot 1: `TheftLocation`** (type: LocationAddress)
Prompt EN: `Where did the theft occur?`
Prompt ES: `¿Dónde ocurrió el robo?`

**Slot 2: `TheftItemDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What was taken? Can you describe the items and their approximate value?`
Prompt ES: `¿Qué le robaron? ¿Puede describir los artículos y su valor aproximado?`

**Slot 3: `TheftWhenOccurred`** (type: IncidentTimeframe)
Prompt EN: `When did this happen?`
Prompt ES: `¿Cuándo ocurrió?`

**Slot 4: `TheftSuspectInfo`** (type: AMAZON.AlphaNumeric — optional)
Prompt EN: `Do you have any description of the person who took it, or did you see how they left?`
Prompt ES: `¿Tiene alguna descripción de la persona que lo tomó, o vio cómo se fueron?`

**Slot 5: `TheftCallbackNumber`** (type: AMAZON.PhoneNumber)
Prompt EN: `What's the best number to reach you?`
Prompt ES: `¿Cuál es el mejor número para contactarle?`

### Confirmation Prompt
EN: `I have a theft report. Location: <break time="300ms"/> {TheftLocation}. <break time="200ms"/> Items taken: {TheftItemDescription}. <break time="200ms"/> Occurred: {TheftWhenOccurred}. <break time="200ms"/> Is that all correct?`

### Closing Response
EN: `Your theft report has been filed. {onlineReportMessage} Your reference number is {referenceNumber}.`

---

## INTENT 8: `ParkingComplaint`

### Sample Utterances — English
```
there's a parking violation
someone is illegally parked
car parked in a handicap spot without a placard
blocking my driveway
someone is blocking the fire hydrant
car is double parked
someone parked in a no parking zone
parking complaint
illegally parked vehicle
car blocking the alley
someone parked in a fire lane
car parked on the sidewalk
they parked on my lawn
someone keeps parking in my spot
car blocking my mailbox
wrong way parking
expired tags parked on street
```

### Sample Utterances — Spanish
```
un carro estacionado ilegalmente
están bloqueando mi entrada
un carro en zona de no estacionamiento
queja de estacionamiento
carro bloqueando la salida de incendio
están estacionados en el pavimento
alguien se estacionó en mi espacio
carro bloqueando el hidrante
estacionado en zona de discapacitados sin placa
```

### Slots

**Slot 1: `ParkingLocation`** (type: LocationAddress)
Prompt EN: `What's the address where the vehicle is illegally parked?`
Prompt ES: `¿Cuál es la dirección donde el vehículo está estacionado ilegalmente?`

**Slot 2: `ParkingVehicleDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `Can you describe the vehicle — color, make, model, and license plate if you have it?`
Prompt ES: `¿Puede describir el vehículo — color, marca, modelo y placa si la tiene?`

**Slot 3: `ParkingViolationType`** (type: Custom — violation type)
Prompt EN: `What's the violation — blocking a driveway, fire hydrant, handicap spot, no parking zone, or something else?`
Prompt ES: `¿Cuál es la infracción — bloqueando una entrada, un hidrante, zona de discapacitados, zona de no estacionamiento, u otra?`

### Confirmation Prompt
EN: `Got it — parking complaint at {ParkingLocation}, {ParkingVehicleDescription}, violation: {ParkingViolationType}. Is that correct?`

### Closing Response
EN: `A parking enforcement officer will be sent to that location. Your reference number is {referenceNumber}.`

---

## INTENT 9: `WelfareCheck`

### Sample Utterances — English
```
I need a welfare check
can you check on someone
I'm worried about my neighbor
I haven't seen my neighbor in days
I'm concerned about someone
can you send someone to check on a person
welfare check on my elderly neighbor
I think someone might be in trouble
I can't get in touch with my family member
my friend isn't answering the door
can someone go check on my roommate
I'm worried something happened to someone
my elderly parent isn't answering
haven't heard from my friend
someone isn't responding
I need someone checked on
can you do a wellness check
check on elderly person
check on my mom
check on my dad
```

### Sample Utterances — Spanish
```
quiero un chequeo de bienestar
estoy preocupado por mi vecino
no he visto a mi vecino en días
no contesta la puerta
quiero que vayan a ver a alguien
estoy preocupado por un familiar
chequeo de bienestar para persona mayor
mi mamá no contesta
no he sabido nada de mi amigo
```

### Slots

**Slot 1: `WelfareCheckAddress`** (type: LocationAddress)
Prompt EN: `What's the address of the person you're concerned about?`
Prompt ES: `¿Cuál es la dirección de la persona por la que está preocupado?`

**Slot 2: `WelfareCheckPersonName`** (type: AMAZON.AlphaNumeric — optional)
Prompt EN: `What's the name of the person, if you know it?`
Prompt ES: `¿Cuál es el nombre de la persona, si lo sabe?`

**Slot 3: `WelfareCheckRelationship`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What's your relationship to this person — neighbor, family member, friend?`
Prompt ES: `¿Cuál es su relación con esta persona — vecino, familiar, amigo?`

**Slot 4: `WelfareCheckLastContact`** (type: IncidentTimeframe)
Prompt EN: `When did you last have contact with them?`
Prompt ES: `¿Cuándo fue la última vez que tuvo contacto con ellos?`

**Slot 5: `WelfareCheckWhyConcerned`** (type: AMAZON.AlphaNumeric)
Prompt EN: `Can you tell me why you're concerned? Is there anything specific that made you call today?`
Prompt ES: `¿Puede decirme por qué está preocupado? ¿Hay algo específico que le hizo llamar hoy?`

**Slot 6: `WelfareCheckCallerCallback`** (type: AMAZON.PhoneNumber)
Prompt EN: `And what's the best number to reach you?`
Prompt ES: `¿Y cuál es el mejor número para contactarle?`

### Confirmation Prompt
EN: `I'm going to send officers to check on {WelfareCheckPersonName} at <break time="300ms"/> {WelfareCheckAddress}. <break time="200ms"/> Last contact was {WelfareCheckLastContact}. <break time="200ms"/> Is that correct?`

### Closing Response
EN: `Officers will respond to check on this person. They may contact you at {WelfareCheckCallerCallback} with an update. Your reference number is {referenceNumber}.`

---

## INTENT 10: `AnimalComplaint`

### Sample Utterances — English
```
there's an animal complaint
stray dog
loose dog
aggressive dog
dog attacked me
dog bit someone
vicious dog
dog running loose
dog off leash
there's a dog in the road
animal cruelty
someone is hurting an animal
neglected animal
dog left in a hot car
stray cat
injured animal
there's a raccoon in my house
animal in my yard
coyote sighting
stray animal
```

### Sample Utterances — Spanish
```
hay un perro suelto
perro agresivo
el perro me mordió
alguien lastima a un animal
animal callejero
crueldad animal
animal en la calle
coyote suelto
un animal abandonado
gato callejero
perro en el carro caliente
```

### Slots

**Slot 1: `AnimalLocation`** (type: LocationAddress)
Prompt EN: `Where is the animal right now?`
Prompt ES: `¿Dónde está el animal ahora mismo?`

**Slot 2: `AnimalType`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What kind of animal is it — a dog, cat, or something else?`
Prompt ES: `¿Qué tipo de animal es — un perro, gato, u otro?`

**Slot 3: `AnimalThreatLevel`** (type: Custom — threat level)
Values: aggressive/attacking, injured, loose/stray, cruelty/neglect, nuisance
Prompt EN: `Is the animal injured, aggressive, or acting threatening? Or is it more of a stray or nuisance situation?`
Prompt ES: `¿El animal está herido, es agresivo, o amenazante? ¿O es más un animal callejero o una molestia?`

*If AnimalThreatLevel = aggressive/attacking → increase priority flag in Lambda*

### Confirmation Prompt
EN: `I have an animal call — {AnimalType} at {AnimalLocation}, situation: {AnimalThreatLevel}. Is that right?`

### Closing Response
EN: `Animal Control will be dispatched to that location. Your reference number is {referenceNumber}.`

---

## INTENT 11: `TowComplaint`

### Sample Utterances — English
```
I need a tow complaint
my car was towed illegally
my car was towed without notice
they towed my car
I want to report an illegal tow
my vehicle was towed and I don't know why
my car was towed from private property
tow truck scam
I think my car was towed wrongfully
towing complaint
predatory towing
my car was booted
someone put a boot on my car
```

### Sample Utterances — Spanish
```
me grúaron el carro
se llevaron mi carro sin aviso
queja de grúa
me grúaron ilegalmente
pusieron una bota en mi carro
```

### Slots

**Slot 1: `TowLocation`** (type: LocationAddress)
Prompt EN: `Where was your vehicle when it was towed from?`
Prompt ES: `¿De dónde se llevaron su vehículo?`

**Slot 2: `TowVehicleDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What's the year, make, model, color, and license plate of your vehicle?`
Prompt ES: `¿Cuál es el año, marca, modelo, color y placa de su vehículo?`

**Slot 3: `TowCompanyInfo`** (type: AMAZON.AlphaNumeric — optional)
Prompt EN: `Do you know the name of the tow company, or did you see the truck?`
Prompt ES: `¿Sabe el nombre de la empresa de grúa, o vio el camión?`

**Slot 4: `TowCallbackNumber`** (type: AMAZON.PhoneNumber)
Prompt EN: `What's the best number to reach you?`
Prompt ES: `¿Cuál es el mejor número para contactarle?`

### Confirmation Prompt
EN: `I have a tow complaint. Your {TowVehicleDescription} was towed from {TowLocation}. Is that correct?`

### Closing Response
EN: `I've filed a tow complaint. An officer will follow up. If you need to find your vehicle right now, Kansas City maintains a tow database at kcpd.org. Your reference number is {referenceNumber}.`

---

## INTENT 12: `VandalismDamage`

### Sample Utterances — English
```
vandalism
someone vandalized my property
graffiti
someone tagged my building
my fence was damaged
someone keyed my car
my car was keyed
someone broke my window
property damage
someone spray painted my wall
they broke my mailbox
someone smashed my sign
damage to my property
eggs on my car
someone threw rocks through my window
my fence was knocked over
```

### Sample Utterances — Spanish
```
vandalismo
pintaron grafiti en mi propiedad
dañaron mi propiedad
le rayaron mi carro
rompieron mi ventana
tiraron huevos a mi carro
me rompieron el buzón
pintaron mi barda
daños a la propiedad
```

### Slots

**Slot 1: `VandalismLocation`** (type: LocationAddress)
Prompt EN: `What's the address of the property that was damaged?`
Prompt ES: `¿Cuál es la dirección de la propiedad que fue dañada?`

**Slot 2: `VandalismDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What was damaged and how?`
Prompt ES: `¿Qué fue dañado y cómo?`

**Slot 3: `VandalismWhenOccurred`** (type: IncidentTimeframe)
Prompt EN: `When did you discover the damage?`
Prompt ES: `¿Cuándo descubrió el daño?`

**Slot 4: `VandalismSuspectInfo`** (type: AMAZON.AlphaNumeric — optional)
Prompt EN: `Did you see anyone do this or do you have any idea who's responsible?`
Prompt ES: `¿Vio a alguien hacerlo o sabe quién pudo ser responsable?`

### Confirmation Prompt
EN: `I have a vandalism report at {VandalismLocation}. Damage: {VandalismDescription}. Discovered: {VandalismWhenOccurred}. Is that correct?`

### Closing Response
EN: `Your vandalism report has been filed. Your reference number is {referenceNumber}. {onlineReportMessage}`

---

## INTENT 13: `CodeEnforcementComplaint`

### Sample Utterances — English
```
code enforcement complaint
property violation
there's trash piled up at a house
overgrown grass
high grass
tall weeds
junk cars in the yard
abandoned property
condemned building
illegal business operating
someone is running a business out of their house
illegal construction
building without a permit
health hazard
property is a mess
nuisance property
```

### Sample Utterances — Spanish
```
queja de código de construcción
hay basura acumulada en una casa
pasto muy alto
carros en el patio
propiedad abandonada
negocio ilegal en casa
construcción sin permiso
```

### Slots

**Slot 1: `CodeEnforcementAddress`** (type: LocationAddress)
Prompt EN: `What's the address of the property?`
Prompt ES: `¿Cuál es la dirección de la propiedad?`

**Slot 2: `CodeViolationDescription`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What's the violation? For example, high grass, trash, junk cars, or something else?`
Prompt ES: `¿Cuál es la infracción? Por ejemplo, pasto alto, basura, carros en desuso, u otra cosa?`

### Confirmation Prompt
EN: `I have a code enforcement complaint at {CodeEnforcementAddress} — {CodeViolationDescription}. Is that right?`

### Closing Response
EN: `Your code enforcement complaint has been submitted. Code Enforcement will follow up. Your reference number is {referenceNumber}.`

---

## INTENT 14: `PublicWorksIssue`
**Routes to 311 external transfer after collecting enough information.**

### Sample Utterances — English
```
public works issue
water main break
water is flooding the street
the street is flooded
pothole
there's a big pothole
streetlight is out
the stoplight is broken
the traffic light isn't working
water leak in the street
sewer backup
manhole cover is missing
road is damaged
sign is knocked down
tree fell in the road
there's a sinkhole
a pipe burst
water coming up from the street
water is gushing from the ground
the street caved in
```

### Sample Utterances — Spanish
```
problema de obras públicas
se rompió una tubería
hay agua en la calle
el semáforo no funciona
la luz de la calle está apagada
hay un hoyo en el camino
drenaje bloqueado
se cayó un árbol en la calle
la coladera no tiene tapa
está saliendo agua del suelo
```

### Slots

**Slot 1: `PublicWorksLocation`** (type: LocationAddress)
Prompt EN: `What's the location — address or nearest intersection?`
Prompt ES: `¿Cuál es la ubicación — dirección o intersección más cercana?`

**Slot 2: `PublicWorksIssueType`** (type: AMAZON.AlphaNumeric)
Prompt EN: `What's the issue — a water main, pothole, traffic light, streetlight, or something else?`
Prompt ES: `¿Cuál es el problema — tubería, bache, semáforo, luz de calle, u otra cosa?`

### Closing Response
EN: `This sounds like a public works issue handled by Kansas City's 311 service. I'm going to transfer you to 311 now, and I'll share a summary of what you've told me. One moment.`
ES: `Este parece ser un problema de obras públicas manejado por el servicio 311 de Kansas City. Voy a transferirle a 311 ahora y compartiré un resumen de lo que me ha dicho. Un momento.`

*Lambda: fires external transfer to 311 queue with warm transfer summary.*

---

## INTENT 15: `TrafficAccidentReportOnly`
**Non-injury, historical. No units needed — report only.**

### Sample Utterances — English
```
I was in an accident
fender bender
minor car accident
I need to file an accident report
hit and run
someone hit my car and drove off
my parked car was hit
someone backed into my car
car accident to report
accident with no injuries
car crash no one was hurt
accident report
I need a report number for insurance
vehicle accident report
```

### Sample Utterances — Spanish
```
estuve en un accidente
choque menor
me golpearon el carro y se fueron
necesito un reporte de accidente
choque y fuga
alguien me golpeó el carro estacionado
accidente sin heridos
necesito el número de reporte para el seguro
```

### Slots

**Slot 1: `AccidentLocation`** (type: LocationAddress)
Prompt EN: `Where did the accident happen?`
Prompt ES: `¿Dónde ocurrió el accidente?`

**Slot 2: `AccidentWhen`** (type: IncidentTimeframe)
Prompt EN: `When did it happen?`
Prompt ES: `¿Cuándo ocurrió?`

**Slot 3: `AccidentInjuries`** (type: AMAZON.Confirmation)
Prompt EN: `Were there any injuries?`
Prompt ES: `¿Hubo heridos?`

*If AccidentInjuries = Yes → Lambda escalates priority and flags for immediate officer response.*

**Slot 4: `OtherVehicleDescription`** (type: AMAZON.AlphaNumeric — optional)
Prompt EN: `Can you describe the other vehicle involved, if there was one?`
Prompt ES: `¿Puede describir el otro vehículo involucrado, si hubo alguno?`

**Slot 5: `AccidentCallbackNumber`** (type: AMAZON.PhoneNumber)
Prompt EN: `What's the best number to reach you?`
Prompt ES: `¿Cuál es el mejor número para contactarle?`

### Confirmation Prompt
EN: `I have a traffic accident to report at {AccidentLocation}, {AccidentWhen}, no injuries. Is that correct?`

### Closing Response
EN: `Your accident report has been filed. {onlineReportMessage} Your report number is {referenceNumber}. Officers may follow up at {AccidentCallbackNumber}.`

---

## INTENT 16: `OnlineReportEligibility`
**Caller is asking if they can file a report online — not starting a specific report type.**

### Sample Utterances — English
```
can I file a report online
where can I file a report
how do I report something online
can I do this on the website
I want to file a report online
can I fill out a report myself
do I need to talk to someone or can I do it online
where do I report vandalism online
can this be done online
I'd rather file this online
how do I make a report without calling
```

### Sample Utterances — Spanish
```
¿puedo hacer un reporte en línea?
¿dónde puedo reportar esto?
¿puedo hacerlo en el sitio web?
quiero hacer un reporte por internet
¿cómo hago un reporte sin llamar?
```

### Closing Response
EN: `Kansas City Police offers online reporting for certain non-emergency incidents like theft, vandalism, lost property, and vehicle burglary. I can send you a link to the online reporting portal right now. Would you like that sent to your phone?`

*Lambda: if caller agrees, send SMS with KCPD online report portal link.*

---

## INTENT 17: `RepeatCallCheck`
**Caller indicates they've already called about this.**

### Sample Utterances — English
```
I already called about this
I called earlier
I reported this already
I've been calling for hours
no one came
I called last night
I made a report but nothing happened
I called and no one showed up
I was told someone would come
following up on my earlier call
I have a reference number
checking on my report
```

### Sample Utterances — Spanish
```
ya llamé antes sobre esto
llamé más temprano
ya reporté esto
nadie llegó
llamé anoche
tengo un número de referencia
quiero saber qué pasó con mi reporte
nadie vino
```

### Slots

**Slot 1: `PriorReferenceNumber`** (type: AMAZON.AlphaNumeric — optional)
Prompt EN: `Do you have a reference number from your earlier call?`
Prompt ES: `¿Tiene un número de referencia de su llamada anterior?`

**Slot 2: `PriorCallbackNumber`** (type: AMAZON.PhoneNumber — optional)
Prompt EN: `What phone number did you call from before, so we can look up your report?`
Prompt ES: `¿Desde qué número llamó antes para que podamos buscar su reporte?`

### Closing Response
EN: `I'm connecting you to a dispatcher who can look up your previous report and check its status. One moment.`

*Lambda: transfer to human queue with `priorCallFlag: true` contact attribute.*

---

## INTENT 18: `InformationRequest`
**General questions about KCPD services, hours, policies, contact numbers.**

### Sample Utterances — English
```
I have a question
I need information
where is the police station
what are the police station hours
how do I get a police report copy
how do I get a copy of an incident report
how do I contest a parking ticket
how do I get a restraining order
how do I file a complaint against an officer
what's the non-emergency number
can I get a fingerprint done
sex offender registry
how do I register my alarm
are there sex offenders in my area
who do I call for noise complaints
how do I get a gun permit
```

### Sample Utterances — Spanish
```
tengo una pregunta
necesito información
¿dónde está la estación de policía?
¿cuáles son las horas de la estación?
¿cómo obtengo una copia del reporte?
¿cómo contesto una multa de estacionamiento?
¿cómo solicito una orden de restricción?
número de teléfono no emergencias
¿cómo registro mi alarma?
¿cómo obtengo un permiso de arma?
```

### Slots

**Slot 1: `InformationTopic`** (type: AMAZON.AlphaNumeric)
Prompt EN: `Sure — what do you need information about?`
Prompt ES: `Claro — ¿sobre qué necesita información?`

### Closing Response
*Lambda queries Agency Knowledge Base. If grounded answer found:*
EN: `{groundedAnswer} Is there anything else I can help you with?`

*If no grounded answer:*
EN: `I don't have specific information about that available right now. I can connect you to the KCPD non-emergency line, or you can visit kcpd.org for more information. Would you like me to transfer you?`

---

## INTENT 19: `FallbackIntent`
**Fires after 3 failed recognition attempts. Always transfers to human.**

### Fallback Response
EN: `I'm sorry, I'm having trouble understanding. Let me connect you to a Kansas City Police officer who can help. Stay on the line.`
ES: `Disculpe, tengo dificultad para entenderle. Voy a conectarle con un oficial de la Policía de Kansas City que le puede ayudar. Por favor no cuelgue.`

*Lambda: transfer to dispatcher queue. Set contact attribute `fallbackTransfer: true`.*

---

## GLOBAL BOT PROMPTS

### Opening Greeting
EN: `Thank you for calling Kansas City Police non-emergency. I'm an automated assistant that will gather your information and get you to the right place. This call may be recorded. If this is a life-threatening emergency, please hang up and dial 9-1-1, or say emergency now. How can I help you today?`

ES: `Gracias por llamar a la línea de no emergencias de la Policía de Kansas City. Soy un asistente automatizado que recopilará su información y le dirigirá al lugar correcto. Esta llamada puede ser grabada. Si esto es una emergencia que pone en riesgo la vida, por favor cuelgue y marque nueve-uno-uno, o diga emergencia ahora. ¿En qué le puedo ayudar hoy?`

### No Input (first timeout)
EN: `I didn't hear anything. How can I help you today?`
ES: `No escuché nada. ¿En qué le puedo ayudar hoy?`

### No Input (second timeout)
EN: `I still didn't catch that. You can tell me why you're calling, or press zero to speak with an officer.`
ES: `Todavía no le escucho. Puede decirme el motivo de su llamada, o presione cero para hablar con un oficial.`

### No Input (third timeout → FallbackIntent)
EN: `I'm going to connect you to an officer now. Please stay on the line.`
ES: `Voy a conectarle con un oficial ahora. Por favor no cuelgue.`

### Misrecognition (first attempt)
EN: `I didn't quite catch that. Could you say that again?`
ES: `No le entendí bien. ¿Puede repetirlo?`

### Misrecognition (second attempt)
EN: `I'm still having a little trouble understanding. Try saying just the main thing — for example, noise complaint, suspicious person, or stolen car.`
ES: `Todavía tengo dificultad para entender. Intente decir solo lo principal — por ejemplo, queja de ruido, persona sospechosa, o carro robado.`

### DTMF 0 Pressed (any point)
EN: `Connecting you to a Kansas City Police officer now. Stay on the line.`
ES: `Conectándole con un oficial de la Policía de Kansas City ahora. No cuelgue.`

### After Confirmation — Denied (caller says no/incorrect)
EN: `I'm sorry about that. Let me start over. What would you like to correct?`
ES: `Disculpe. Empecemos de nuevo. ¿Qué quisiera corregir?`

### Caller States They Are Anonymous
EN: `That's completely okay. You don't need to give your name. Can you tell me what's happening and where?`
ES: `Está bien. No necesita dar su nombre. ¿Puede decirme qué está pasando y dónde?`

### Language Switch Detection
*If Spanish utterances detected after English greeting, Lex should switch to es_US locale. Configure this in the Lex V2 Console under "Fallback language."*
EN→ES trigger: `If sessionState.activeContexts contains no language set AND first utterance is in Spanish → set locale to es_US and re-prompt in Spanish.`

---

## DEPLOYMENT CHECKLIST

After entering all intents in the Lex V2 Console:

```
□ Intent priority order set (EmergencyEscalation = 1)
□ All intents tested in Lex test console before building
□ en_US locale built and published to live-dev alias
□ es_US locale built and published to live-dev alias
□ Lambda fulfillment associated on every intent
□ Fallback intent configured with 3-retry escalation
□ DTMF 0 handled at Connect contact flow level (not Lex)
□ No-input timeout: 5 seconds (first), 5 seconds (second), 4 seconds (third)
□ Session timeout: 5 minutes (resets per turn)
□ Opening greeting recorded or set as SSML in Connect contact flow (not Lex)
□ Smoke tests: NoiseComplaint, SuspiciousPerson (gun mid-call), Silence/Fallback, Spanish caller
□ Connect contact flow re-published after any Lambda association change
```

---

*RCCallAssistBot — KCPD Non-Emergency Call Handling*
*Rapid Cortex — Intelligence at the speed of response.*
