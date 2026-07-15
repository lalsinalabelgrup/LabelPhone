We are now implementing the Contacts module for LabelPhone.

The objective is not only to create a contact list, but to build a scalable architecture that will allow future synchronization with LabelGateway, CRM systems, LDAP directories or cloud providers.

The first version will use local storage only, but the implementation must be designed to support future data providers without changing the UI.

---

## GENERAL OBJECTIVE

Implement a complete Contacts module with CRUD operations, search capabilities and direct integration with the existing calling functionality.

The user should be able to manage contacts directly from LabelPhone and call them with a single click.

The implementation must feel like a modern softphone such as 3CX, Zoiper or Linphone.

---

## ARCHITECTURE

Do NOT allow the UI to read or write directly to localStorage.

Instead create a repository/service abstraction.

Example:

ContactsRepository

This repository will be responsible for:

- loadContacts()
- saveContact()
- updateContact()
- deleteContact()
- searchContacts()
- getContactById()

Internally it can use localStorage for now.

The UI must communicate only with this repository.

This will allow replacing localStorage later with:

- REST API
- LabelGateway
- CRM
- Microsoft 365
- Google Contacts
- LDAP
- Company Directory

without changing the UI.

---

## CONTACT MODEL

Each contact should contain:

id
firstName
lastName
company
phone
extension
email
notes
favorite
createdAt
updatedAt

Use UUIDs for identifiers.

---

## VALIDATION

Required:

First Name

AND at least one of:

Phone
OR
Extension

Email is optional.

Company is optional.

Notes are optional.

---

## USER INTERFACE

The Contacts tab should contain:

Search bar

New Contact button

Scrollable contact list

Empty state

Each contact row should display:

Avatar (photo placeholder or initials)

Full name

Company (if available)

Phone number

Extension (if available)

Favorite indicator

Call button

Edit button

Delete button

---

## EMPTY STATE

When there are no contacts display a friendly screen.

Example:

"No contacts yet"

Create your first contact to start calling people more easily.

Show a "Create Contact" button.

---

## SEARCH

Implement live search.

Search should match:

First name

Last name

Company

Phone number

Extension

Search should update while typing.

---

## CREATE CONTACT

The New Contact button should open a modal.

Fields:

First Name

Last Name

Company

Phone

Extension

Email

Notes

Favorite

Buttons:

Save

Cancel

Validation should happen before saving.

---

## EDIT CONTACT

Editing should reuse exactly the same modal.

Fields should be preloaded.

---

## DELETE CONTACT

Deleting must ask for confirmation.

Never delete immediately.

---

## FAVORITES

Users can mark contacts as favorites.

Favorites should appear before non-favorites.

Within each group sort alphabetically.

---

## CALL INTEGRATION

Each contact should have a Call button.

Clicking it should:

Use the existing dialing logic.

Do NOT duplicate telephony code.

If the contact has:

Phone

call the phone.

If it has only:

Extension

call the extension.

If neither exists

disable the Call button.

---

## REGISTRATION STATE

If LabelPhone is not registered:

Disable every Call button.

Do not allow calls.

Reuse the existing registration state.

Do not create a second state variable.

---

## RECENT CALLS INTEGRATION

This is extremely important.

Whenever a recent call contains a phone number matching a contact,

display:

John Smith

instead of

+34931234567

If no matching contact exists,

continue displaying the number.

This lookup should happen automatically.

---

## PHONE NORMALIZATION

Implement phone normalization.

These should be considered the same number:

931234567

+34931234567

0034931234567

Ignore spaces, dashes and formatting.

Centralize the normalization logic.

Do not duplicate it.

---

## PERSISTENCE

Persist contacts locally.

Changes should survive application restarts.

---

## UI REQUIREMENTS

Follow the current LabelPhone design.

Desktop mode

Mobile mode

Compact mode

Dark theme

Light theme

Everything should work correctly.

---

## PERFORMANCE

Search should remain responsive.

Avoid unnecessary re-rendering.

Keep the code modular.

---

## FUTURE READY

Design the module so future providers can be added without changing the UI.

Possible future providers:

Local Storage

LabelGateway

CRM

LDAP

Google Contacts

Microsoft 365

REST API

The UI should never know where the contacts come from.

---

## OPTIONAL NICE TO HAVE

If time permits:

Double-click a contact to call immediately.

Press Enter inside the search box to call the first matching contact.

Keyboard navigation.

---

## IMPORTANT

Reuse as much existing infrastructure as possible.

Do not duplicate call logic.

Do not duplicate registration logic.

Keep the code clean.

Keep components reusable.

Follow the current LabelPhone architecture.

The objective is to build a professional Contacts module that can evolve into a full enterprise address book without requiring future UI redesign.
