/**
 * contactsRepository.js
 * Sole gateway between the UI and the user's local address book. The UI must
 * never read/write localStorage directly — everything goes through this
 * repository, so a future REST/CRM/LDAP/Google/M365-backed implementation
 * can replace the storage layer without any UI change. Every method returns
 * a Promise, even though today's implementation is synchronous, so call
 * sites never need to change when the backing provider does.
 */

const ContactsRepository = (() => {

  const STORAGE_KEY = 'lp-contacts';

  function _uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function _seedFromMockContacts() {
    if (typeof MOCK_CONTACTS === 'undefined' || !Array.isArray(MOCK_CONTACTS)) return [];
    const now = new Date().toISOString();
    return MOCK_CONTACTS.map((c) => {
      const [firstName, ...rest] = (c.name || '').split(' ');
      const isExtension = /^ext\.?\s*/i.test(c.phone || '');
      return {
        id: _uuid(),
        firstName: firstName || '',
        lastName: rest.join(' '),
        company: c.company || '',
        phone: isExtension ? '' : (c.phone || ''),
        extension: isExtension ? (c.phone || '').replace(/^ext\.?\s*/i, '') : '',
        email: '',
        notes: '',
        favorite: !!c.favorite,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  function _load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seeded = _seedFromMockContacts();
      _persist(seeded);
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function _persist(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function _validate(data) {
    if (!data.firstName || !data.firstName.trim()) {
      throw new Error('first_name_required');
    }
    if ((!data.phone || !data.phone.trim()) && (!data.extension || !data.extension.trim())) {
      throw new Error('phone_or_extension_required');
    }
  }

  function loadContacts() {
    return Promise.resolve(_load());
  }

  function getContactById(id) {
    return Promise.resolve(_load().find((c) => c.id === id) || null);
  }

  function getContactByPhone(phone) {
    const list = _load();
    const match = list.find(
      (c) => PhoneUtils.equals(c.phone, phone) || PhoneUtils.equals(c.extension, phone),
    );
    return Promise.resolve(match || null);
  }

  function searchContacts(query) {
    const q = (query || '').toLowerCase().trim();
    const list = _load();
    if (!q) return Promise.resolve(list);
    const normalizedQ = PhoneUtils.normalize(query);
    return Promise.resolve(
      list.filter((c) =>
        (c.firstName || '').toLowerCase().includes(q) ||
        (c.lastName || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.extension || '').toLowerCase().includes(q) ||
        (normalizedQ && (PhoneUtils.normalize(c.phone) === normalizedQ || PhoneUtils.normalize(c.extension) === normalizedQ)),
      ),
    );
  }

  function saveContact(data) {
    try {
      _validate(data);
    } catch (err) {
      return Promise.reject(err);
    }
    const now = new Date().toISOString();
    const contact = {
      id: _uuid(),
      firstName: data.firstName.trim(),
      lastName: (data.lastName || '').trim(),
      company: (data.company || '').trim(),
      phone: (data.phone || '').trim(),
      extension: (data.extension || '').trim(),
      email: (data.email || '').trim(),
      notes: (data.notes || '').trim(),
      favorite: !!data.favorite,
      createdAt: now,
      updatedAt: now,
    };
    const list = _load();
    list.push(contact);
    _persist(list);
    return Promise.resolve(contact);
  }

  function updateContact(id, data) {
    try {
      _validate(data);
    } catch (err) {
      return Promise.reject(err);
    }
    const list = _load();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return Promise.reject(new Error('contact_not_found'));

    const updated = {
      ...list[idx],
      firstName: data.firstName.trim(),
      lastName: (data.lastName || '').trim(),
      company: (data.company || '').trim(),
      phone: (data.phone || '').trim(),
      extension: (data.extension || '').trim(),
      email: (data.email || '').trim(),
      notes: (data.notes || '').trim(),
      favorite: !!data.favorite,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    _persist(list);
    return Promise.resolve(updated);
  }

  function deleteContact(id) {
    const list = _load();
    const next = list.filter((c) => c.id !== id);
    _persist(next);
    return Promise.resolve();
  }

  return {
    loadContacts,
    saveContact,
    updateContact,
    deleteContact,
    searchContacts,
    getContactById,
    getContactByPhone,
  };
})();
