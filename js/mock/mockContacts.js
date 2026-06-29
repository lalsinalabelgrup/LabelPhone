/**
 * mockContacts.js
 * Demo contact list used by the mock gateway in development / demo mode.
 * Loaded conditionally (only when appConfig.telephonyGateway.mode === 'mock').
 */

const MOCK_CONTACTS = [
  { id: 1,  name: 'Ana García',    company: 'LabelGrup',     phone: '+34 600 100 001', color1: '#FF6B6B', color2: '#C0392B', favorite: true  },
  { id: 2,  name: 'Bernat Puig',   company: 'TechSolucions', phone: '+34 600 100 002', color1: '#4ECDC4', color2: '#16A085', favorite: true  },
  { id: 3,  name: 'Carme Vidal',   company: 'InnovaB2C',     phone: '+34 600 100 003', color1: '#45B7D1', color2: '#2980B9', favorite: false },
  { id: 4,  name: 'David Martí',   company: 'LabelGrup',     phone: '+34 600 100 004', color1: '#96CEB4', color2: '#27AE60', favorite: false },
  { id: 5,  name: 'Elena Soler',   company: 'GeniusCTI',     phone: '+34 600 100 005', color1: '#FECA57', color2: '#F39C12', favorite: true  },
  { id: 6,  name: 'Ferran Costa',  company: 'SIPworks',      phone: '+34 600 100 006', color1: '#FF9FF3', color2: '#8E44AD', favorite: false },
  { id: 7,  name: 'Glòria Roca',   company: 'LabelGrup',     phone: '+34 600 100 007', color1: '#54A0FF', color2: '#2980B9', favorite: false },
  { id: 8,  name: 'Hèctor Llopis', company: 'B2Com Systems', phone: '+34 600 100 008', color1: '#5F27CD', color2: '#341f97', favorite: false },
  { id: 9,  name: 'Irene Mas',     company: 'CloudVoice',    phone: '+34 600 100 009', color1: '#00D2D3', color2: '#0097A7', favorite: false },
  { id: 10, name: 'Jordi Navarro', company: 'LabelGrup',     phone: '+34 600 100 010', color1: '#FF6348', color2: '#C0392B', favorite: true  },
  { id: 11, name: 'Karla Miró',    company: 'UnicomGroup',   phone: '+34 600 100 011', color1: '#A29BFE', color2: '#6C5CE7', favorite: false },
  { id: 12, name: 'Lluis Alsina',  company: 'LabelGrup',     phone: 'Ext. 1001',       color1: '#3B6FD4', color2: '#1D4ED8', favorite: false },
];
