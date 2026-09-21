# Update QR codes and NFC tags

This guide is for **Campus Safety**, **Venue Operations**, and **Transit Operations**. It is not 911 Help. PSAP dispatchers do not manage these codes.

Training access is **unlimited**. Open this article as often as you need — there is no seat cap or view quota.

## Who can update codes

Roles with `locations.qrcodes.manage` can create, download, reassign cameras, and deactivate codes:

- Campus Admin and Campus Supervisor
- Venue Admin, Venue Supervisor, and Venue Operator
- Transit Admin and Transit Supervisor

Campus Security, Venue Security, and similar field roles can **view and download** when granted, but they cannot deactivate.

PSAP roles (dispatcher, supervisor, agency admin) cannot manage campus/venue/transit QR or NFC.

## Two kinds of codes

**Named report codes (Field app)** live on **QR Codes** in the campus, venue, or transit console. These are the codes guests, students, and riders scan or tap to open a report.

**Location QR (RCLI)** are building/zone scan points with an RCLI identifier. On campus they are under **QR Codes → Location QR (RCLI)**. Venue QR pages use this location list as the posted zone codes.

## Update a named report code

1. Open **QR Codes** from your console sidebar (Staff Guide is a different page).
2. Find the reporting point by name (gate, building, vehicle, station).
3. **Download PNG** and reprint the posted sign if the artwork changed or is damaged.
4. **Copy QR URL** if you need the scan destination for print vendors.
5. **Copy NFC URL** for the tap destination (`?medium=nfc`).
6. **Assign cameras** (campus, venue, transit) so a scan opens the cameras for that area. Save vehicle / station / route on transit codes.
7. If the code was turned off, use the **Active** control to turn it back on.

There is no “rename in place” editor. To change the public name of a reporting point, create a new code with the correct name, post it, then deactivate the old code so leftover signs stop working.

## Reprogram an NFC tag

The Rapid Cortex Field app writes the NFC URL to the tag. You do not paste the URL on the phone.

1. Order **NTAG213** NFC stickers (typically sold in packs of 100).
2. Open the Rapid Cortex Field app (Campus, Venue, or Transit).
3. Open this location code, then tap **Program NFC Tag**.
4. Hold an NTAG213 to the back of the device until the write succeeds.
5. Stick the programmed tag on the back of the posted sign.

Any modern iPhone (7+) or Android can **read** the tag. The person reporting does not need the Field app.

If a tag was programmed to the wrong location, reprogram it with the correct code. Do not leave a tag live after you deactivate the code in the dashboard — taps will fail.

## After you update

- Walk the post: scan the QR and tap the NFC once before the event, class change, or pull-out.
- Confirm the report page shows the right building, section, vehicle, or station.
- If cameras should open on scan, verify the assignment on the code row.
